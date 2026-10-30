import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StudentSubmission } from '../types';

/**
 * Clone repositories for all students into their existing Moodle folders
 */
export function registerCloneReposCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand('gradingagent.cloneRepos', async () => {
		try {
			// Get workspace folder - assume it's the Moodle submissions folder
			let workspaceFolders = vscode.workspace.workspaceFolders;

			if (!workspaceFolders || workspaceFolders.length === 0) {
				// No workspace open - show message and exit
				vscode.window.showErrorMessage(
					'Please open the folder with Moodle submissions first, then run this command again.'
				);
				return;
			}

			const moodlePath = workspaceFolders[0].uri.fsPath;
			const jsonPath = path.join(moodlePath, 'students_repos.json');

			if (!fs.existsSync(jsonPath)) {
				const response = await vscode.window.showErrorMessage(
					'students_repos.json not found in this folder. Please run "Extract Student\'s Repositories"  first.',
					'Run Extract Repos'
				);

				if (response === 'Run Extract Repos') {
					await vscode.commands.executeCommand('gradingagent.extractRepos');
				}
				return;
			}

			// Read student data
			const fileContent = fs.readFileSync(jsonPath, 'utf-8');
			const students: StudentSubmission[] = JSON.parse(fileContent);

			// Filter students with valid repositories
			const validStudents = students.filter(s =>
				s.repositorio &&
				s.repositorio !== 'Not found' &&
				s.repositorio.startsWith('http')
			);

			if (validStudents.length === 0) {
				vscode.window.showWarningMessage('No valid repositories found to clone.');
				return;
			}

			const invalidCount = students.length - validStudents.length;
			const message = `Found ${validStudents.length} repositories to clone` +
				(invalidCount > 0 ? ` (${invalidCount} skipped - no valid URL)` : '') +
				`. Continue?`;

			const choice = await vscode.window.showInformationMessage(
				message,
				{ modal: true },
				'Clone All'
			);

			if (choice !== 'Clone All') {
				return;
			}

			// Ask for the deadline to checkout (empty means latest commit)
			const deadlineInput = await vscode.window.showInputBox({
				prompt: 'Deadline (YYYY-MM-DD [HH:MM], default time 23:59). Leave empty for latest commit',
				placeHolder: 'YYYY-MM-DD 23:59',
				validateInput: validateDeadline
			});

			if (deadlineInput === undefined) {
				return;
			}

			const deadline = normalizeDeadline(deadlineInput);

			// Clone repositories with progress
			const authHeader = await getGithubAuthHeader(validStudents);
			let successCount = 0;
			let failureCount = 0;
			const failures: { student: string; error: string }[] = [];

			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Cloning and checking out student repositories',
				cancellable: true
			}, async (progress, token) => {

				for (let i = 0; i < validStudents.length; i++) {
					if (token.isCancellationRequested) {
						vscode.window.showWarningMessage(`Cloning cancelled. ${successCount} succeeded, ${failureCount} failed.`);
						return;
					}

					const student = validStudents[i];

					progress.report({
						increment: (100 / validStudents.length),
						message: `[${i + 1}/${validStudents.length}] ${student.nombre}`
					});

					try {
						// Find the student's folder (from carpeta field)
						const studentFolder = path.join(moodlePath, student.carpeta);

						if (!fs.existsSync(studentFolder)) {
							throw new Error(`Student folder not found: ${student.carpeta}`);
						}

						// Create repo subfolder
						const repoFolder = path.join(studentFolder, 'repo');

						if (fs.existsSync(repoFolder)) {
							// Check if it's already a git repository
							const gitPath = path.join(repoFolder, '.git');
							if (fs.existsSync(gitPath)) {
								// Already cloned: fetch latest changes and checkout at deadline
								await checkoutAtDeadline(repoFolder, deadline, student.repositorio, authHeader);
								successCount++;
								continue;
							} else {
								// Remove the folder if it exists but isn't a git repo
								fs.rmSync(repoFolder, { recursive: true, force: true });
							}
						}

						// Create the repo folder
						fs.mkdirSync(repoFolder, { recursive: true });

						// Clone repository into the repo subfolder
						await cloneRepository(student.repositorio, repoFolder, authHeader);

						// Checkout the last commit before the deadline
						await checkoutAtDeadline(repoFolder, deadline, student.repositorio, authHeader);

						successCount++;

					} catch (error) {
						failureCount++;
						const errorMsg = error instanceof Error ? error.message : String(error);
						failures.push({ student: student.nombre, error: errorMsg });
						console.error(`Failed to clone repo for ${student.nombre}:`, errorMsg);
					}
				}
			});

			// Show summary after progress completes
			let summaryMessage = `✅ Cloning completed!\n\n` +
				`Checked out at: ${deadline ?? 'latest commit'}\n` +
				`Success: ${successCount}/${validStudents.length}\n` +
				`Failed: ${failureCount}/${validStudents.length}`;

			if (failures.length > 0 && failures.length <= 5) {
				summaryMessage += '\n\nFailures:\n' +
					failures.map(f => `- ${f.student}: ${f.error}`).join('\n');
			} else if (failures.length > 5) {
				summaryMessage += '\n\nSee console for failure details.';
				console.log('Failed clones:', failures);
			}

			if (failureCount === 0) {
				vscode.window.showInformationMessage(summaryMessage);
			} else {
				vscode.window.showWarningMessage(summaryMessage);
			}

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Error cloning repositories: ${errorMsg}`);
		}
	});

	context.subscriptions.push(disposable);
}

/**
 * Clones a git repository to the target path
 */
async function cloneRepository(repoUrl: string, targetPath: string, authHeader?: string): Promise<void> {
	await runGit(['clone', repoUrl, targetPath], undefined, repoUrl, authHeader);
}

/**
 * Fetches the latest changes and checks out (detached) the last commit of the
 * default branch before the deadline, or the latest commit if no deadline is given
 */
async function checkoutAtDeadline(repoFolder: string, deadline: string | undefined, repoUrl: string, authHeader?: string): Promise<void> {
	await runGit(['fetch', 'origin', '--prune'], repoFolder, repoUrl, authHeader);

	// Make sure origin/HEAD points to the remote default branch
	try {
		await runGit(['rev-parse', '--verify', '--quiet', 'origin/HEAD'], repoFolder);
	} catch {
		await runGit(['remote', 'set-head', 'origin', '--auto'], repoFolder, repoUrl, authHeader);
	}

	let target = 'origin/HEAD';

	if (deadline) {
		const sha = (await runGit(['rev-list', '-n', '1', `--before=${deadline}`, 'origin/HEAD'], repoFolder)).trim();
		if (!sha) {
			throw new Error(`No commits before ${deadline}`);
		}
		target = sha;
	}

	await runGit(['-c', 'advice.detachedHead=false', 'checkout', '--detach', target], repoFolder);
}

/**
 * Runs a git command and returns its stdout. Adds the GitHub auth header when needed
 */
function runGit(args: string[], cwd?: string, repoUrl?: string, authHeader?: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const { execFile } = require('child_process');
		const gitArgs: string[] = [];

		if (authHeader && repoUrl && isGithubHttpsRepo(repoUrl)) {
			gitArgs.push('-c', `http.extraHeader=${authHeader}`);
		}

		gitArgs.push(...args);

		execFile('git', gitArgs, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }, (error: Error | null, stdout: string, stderr: string) => {
			if (error) {
				reject(new Error(stderr || error.message));
				return;
			}
			resolve(stdout);
		});
	});
}

/**
 * Validates a deadline in the format YYYY-MM-DD [HH:MM]. Empty is valid (latest commit)
 */
function validateDeadline(value: string): string | undefined {
	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}

	const match = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{1,2}):(\d{2}))?$/.exec(trimmed);
	if (!match) {
		return 'Use the format YYYY-MM-DD or YYYY-MM-DD HH:MM';
	}

	const [, year, month, day, hour = '23', minute = '59'] = match;
	const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
	const isValid = date.getFullYear() === Number(year) &&
		date.getMonth() === Number(month) - 1 &&
		date.getDate() === Number(day) &&
		date.getHours() === Number(hour) &&
		date.getMinutes() === Number(minute);

	return isValid ? undefined : 'Invalid date or time';
}

/**
 * Returns the deadline with time (23:59 by default), or undefined if empty
 */
function normalizeDeadline(value: string): string | undefined {
	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}
	return trimmed.includes(' ') ? trimmed : `${trimmed} 23:59`;
}

function isGithubHttpsRepo(repoUrl: string): boolean {
	try {
		const parsed = new URL(repoUrl);
		return parsed.protocol === 'https:' && parsed.hostname.toLowerCase() === 'github.com';
	} catch {
		return false;
	}
}

async function getGithubAuthHeader(students: StudentSubmission[]): Promise<string | undefined> {
	const needsGithubAuth = students.some(student => isGithubHttpsRepo(student.repositorio));

	if (!needsGithubAuth) {
		return undefined;
	}

	try {
		const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
		if (!session?.accessToken) {
			return undefined;
		}

		const basic = Buffer.from(`x-access-token:${session.accessToken}`).toString('base64');
		return `AUTHORIZATION: basic ${basic}`;
	} catch {
		vscode.window.showWarningMessage('GitHub sign-in was skipped. Private repositories may fail to clone.');
		return undefined;
	}
}
