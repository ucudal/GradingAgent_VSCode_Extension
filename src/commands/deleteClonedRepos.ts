import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StudentSubmission } from '../types';

/**
 * Delete cloned repositories from student folders
 */
export function registerDeleteClonedReposCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand('gradingagent.deleteClonedRepos', async () => {
		try {
			// Get workspace folder - assume it's the Moodle submissions folder
			const workspaceFolders = vscode.workspace.workspaceFolders;

			if (!workspaceFolders || workspaceFolders.length === 0) {
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
				vscode.window.showInformationMessage('No cloned repositories found to delete.');
				return;
			}

			// Confirm deletion
			const message = `Found ${studentsWithRepos.length} cloned repositories. Delete all?`;
			const choice = await vscode.window.showWarningMessage(
				message,
				{ modal: true },
				'Delete All'
			);

			if (choice !== 'Delete All') {
				return;
			}

			// Delete repositories with progress
			let successCount = 0;
			let failureCount = 0;
			const failures: { student: string; error: string }[] = [];

			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Deleting cloned repositories',
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

						if (fs.existsSync(repoFolder)) {
							fs.rmSync(repoFolder, { recursive: true, force: true });
							successCount++;
						}

					} catch (error) {
						failureCount++;
						const errorMsg = error instanceof Error ? error.message : String(error);
						failures.push({ student: student.nombre, error: errorMsg });
						console.error(`Failed to delete repo for ${student.nombre}:`, errorMsg);
					}
				}
			});

			// Show summary after progress completes
			let summaryMessage = `✅ Deletion completed!\n\n` +
				`Success: ${successCount}/${studentsWithRepos.length}\n` +
				`Failed: ${failureCount}/${studentsWithRepos.length}`;

			if (failures.length > 0 && failures.length <= 5) {
				summaryMessage += '\n\nFailures:\n' +
					failures.map(f => `- ${f.student}: ${f.error}`).join('\n');
			} else if (failures.length > 5) {
				summaryMessage += '\n\nSee console for failure details.';
				console.log('Failed deletions:', failures);
			}

			if (failureCount === 0) {
				vscode.window.showInformationMessage(summaryMessage);
			} else {
				vscode.window.showWarningMessage(summaryMessage);
			}

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Error deleting repositories: ${errorMsg}`);
		}
	});

	context.subscriptions.push(disposable);
}
