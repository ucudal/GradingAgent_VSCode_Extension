import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StudentSubmission } from '../types';

/**
 * Copy grading agent to student repositories
 */
export function registerOpenAndCopyGradingAgentCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand('gradingagent.openGradingAgent', async () => {
		try {
			// Get workspace folder - assume it's the Moodle submissions folder
			const workspaceFolders = vscode.workspace.workspaceFolders;

			if (!workspaceFolders || workspaceFolders.length === 0) {
				vscode.window.showErrorMessage(
					'Please open the Moodle submissions folder first (File > Open Folder), then run this command again.'
				);
				return;
			}

			const moodlePath = workspaceFolders[0].uri.fsPath;
			const jsonPath = path.join(moodlePath, 'students_repos.json');

			if (!fs.existsSync(jsonPath)) {
				const response = await vscode.window.showErrorMessage(
					'students_repos.json not found in this folder. Please run "Extract Student\'s Repositories" first.',
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

			// Find students with cloned repositories
			const studentsWithRepos: StudentSubmission[] = [];
			for (const student of students) {
				const studentFolder = path.join(moodlePath, student.carpeta);
				const repoFolder = path.join(studentFolder, 'repo');
				if (fs.existsSync(repoFolder)) {
					studentsWithRepos.push(student);
				}
			}

			if (studentsWithRepos.length === 0) {
				vscode.window.showWarningMessage('No cloned repositories found. Please clone repositories first.');
				return;
			}

			// Ask user to select grading agent file
			const fileUri = await vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				openLabel: 'Select Grading Agent File',
				title: 'Select the grading agent markdown file to copy to all repositories',
				filters: {
					'Markdown': ['md']
				}
			});

			if (!fileUri || fileUri.length === 0) {
				vscode.window.showWarningMessage('No file selected');
				return;
			}

			const sourceFile = fileUri[0].fsPath;
			const sourceFileName = path.basename(sourceFile);

			// Confirm copying
			const message = `Copy "${sourceFileName}" to ${studentsWithRepos.length} repositories?`;
			const choice = await vscode.window.showInformationMessage(
				message,
				{ modal: true },
				'Copy to All'
			);

			if (choice !== 'Copy to All') {
				return;
			}

			// Copy grading agents with progress
			let successCount = 0;
			let failureCount = 0;
			const failures: { student: string; error: string }[] = [];

			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Copying grading agents',
				cancellable: false
			}, async (progress) => {
				for (let i = 0; i < studentsWithRepos.length; i++) {
					const student = studentsWithRepos[i];

					progress.report({
						increment: (100 / studentsWithRepos.length),
						message: `[${i + 1}/${studentsWithRepos.length}] ${student.nombre}`
					});

					try {
						const studentFolder = path.join(moodlePath, student.carpeta);
						const repoFolder = path.join(studentFolder, 'repo');
						const agentsFolder = path.join(repoFolder, '.github', 'agents');
						const agentFile = path.join(agentsFolder, sourceFileName);

						// Create .github/agents folder if it doesn't exist
						if (!fs.existsSync(agentsFolder)) {
							fs.mkdirSync(agentsFolder, { recursive: true });
						}

						// Copy grading agent file
						fs.copyFileSync(sourceFile, agentFile);
						successCount++;

					} catch (error) {
						failureCount++;
						const errorMsg = error instanceof Error ? error.message : String(error);
						failures.push({ student: student.nombre, error: errorMsg });
						console.error(`Failed to copy grading agent for ${student.nombre}:`, errorMsg);
					}
				}
			});

			// Show summary after progress completes
			let summaryMessage = `✅ Grading agent copy completed!\n\n` +
				`Success: ${successCount}/${studentsWithRepos.length}\n` +
				`Failed: ${failureCount}/${studentsWithRepos.length}`;

			if (failures.length > 0 && failures.length <= 5) {
				summaryMessage += '\n\nFailures:\n' +
					failures.map(f => `- ${f.student}: ${f.error}`).join('\n');
			} else if (failures.length > 5) {
				summaryMessage += '\n\nSee console for failure details.';
				console.log('Failed copies:', failures);
			}

			if (failureCount === 0) {
				vscode.window.showInformationMessage(summaryMessage);
			} else {
				vscode.window.showWarningMessage(summaryMessage);
			}

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Error copying grading agents: ${errorMsg}`);
		}
	});

	context.subscriptions.push(disposable);
}
