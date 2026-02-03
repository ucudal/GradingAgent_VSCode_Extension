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
			// Find the estudiantes_repos.json file
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders || workspaceFolders.length === 0) {
				vscode.window.showErrorMessage('No workspace folder open. Please open a workspace first.');
				return;
			}

			const workspacePath = workspaceFolders[0].uri.fsPath;
			const jsonPath = path.join(workspacePath, 'estudiantes_repos.json');

			if (!fs.existsSync(jsonPath)) {
				const response = await vscode.window.showErrorMessage(
					'estudiantes_repos.json not found. Please run "Extract Student Repositories" first.',
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
				'Clone All',
				'Cancel'
			);

			if (choice !== 'Clone All') {
				return;
			}

			// Ask for source directory (where original Moodle folders are)
			const sourceUri = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				openLabel: 'Select Source Directory',
				title: 'Select directory with original Moodle submission folders'
			});

			if (!sourceUri || sourceUri.length === 0) {
				vscode.window.showWarningMessage('No source directory selected');
				return;
			}

			const sourcePath = sourceUri[0].fsPath;

			// Clone repositories with progress
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Cloning student repositories',
				cancellable: true
			}, async (progress, token) => {
				let successCount = 0;
				let failureCount = 0;
				const failures: { student: string; error: string }[] = [];

				for (let i = 0; i < validStudents.length; i++) {
					if (token.isCancellationRequested) {
						vscode.window.showWarningMessage(`Cloning cancelled. ${successCount} succeeded, ${failureCount} failed.`);
						return;
					}

					const student = validStudents[i];
					const percent = Math.round(((i + 1) / validStudents.length) * 100);
					
					progress.report({
						increment: 100 / validStudents.length,
						message: `${i + 1}/${validStudents.length}: ${student.nombre}`
					});

					try {
						// Find the student's folder (from carpeta field)
						const studentFolder = path.join(sourcePath, student.carpeta);
						
						if (!fs.existsSync(studentFolder)) {
							throw new Error(`Student folder not found: ${student.carpeta}`);
						}

						// Create repo subfolder
						const repoFolder = path.join(studentFolder, 'repo');
						
						if (fs.existsSync(repoFolder)) {
							// Check if it's already a git repository
							const gitPath = path.join(repoFolder, '.git');
							if (fs.existsSync(gitPath)) {
								console.log(`Skipping ${student.nombre} - repository already cloned`);
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
						await cloneRepository(student.repositorio, repoFolder);

						successCount++;

					} catch (error) {
						failureCount++;
						const errorMsg = error instanceof Error ? error.message : String(error);
						failures.push({ student: student.nombre, error: errorMsg });
						console.error(`Failed to clone repo for ${student.nombre}:`, errorMsg);
					}
				}

				// Show summary
				let summaryMessage = `✅ Cloning completed!\n\n` +
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
			});

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
async function cloneRepository(repoUrl: string, targetPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const { exec } = require('child_process');
		
		const command = `git clone "${repoUrl}" "${targetPath}"`;
		
		exec(command, (error: Error | null, stdout: string, stderr: string) => {
			if (error) {
				reject(new Error(stderr || error.message));
				return;
			}
			resolve();
		});
	});
}
