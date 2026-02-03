import * as vscode from 'vscode';
import * as path from 'path';
import { StudentSubmission } from '../types';
import { processSubmissions } from '../utils/moodleParser';
import { saveResults } from '../utils/fileWriter';

/**
 * Extract Student's Repositories command
 * Processes Moodle submission folders and extracts student information
 */
export function registerExtractReposCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand('gradingagent.extractRepos', async () => {
		try {
			console.log('Extract repos command started');
			// Get workspace folder - assume it's the Moodle submissions folder
			let workspaceFolders = vscode.workspace.workspaceFolders;
			console.log('Workspace folders:', workspaceFolders);

			if (!workspaceFolders || workspaceFolders.length === 0) {
				console.log('No workspace folder detected');
				// No workspace open - show message and exit
				vscode.window.showErrorMessage(
					'Please open the folder with Moodle submissions first, then run this command again.'
				);
				return;
			}

			const submissionsPath = workspaceFolders[0].uri.fsPath;

			// Show progress
			let results: StudentSubmission[];
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Extracting student information',
				cancellable: false
			}, async (progress) => {
				progress.report({ increment: 0, message: 'Processing folders...' });

				// Process submissions
				results = await processSubmissions(submissionsPath);

				progress.report({ increment: 50, message: `Found ${results.length} students` });

				// Determine output folder
				const workspaceFolders = vscode.workspace.workspaceFolders;
				let outputPath: string;

				if (workspaceFolders && workspaceFolders.length > 0) {
					outputPath = workspaceFolders[0].uri.fsPath;
				} else {
					outputPath = submissionsPath;
				}

				// Save results
				await saveResults(results, outputPath);

				progress.report({ increment: 100, message: 'Completed' });
			});

			// Show summary after progress completes
			let outputPath: string;

			if (workspaceFolders && workspaceFolders.length > 0) {
				outputPath = workspaceFolders[0].uri.fsPath;
			} else {
				outputPath = submissionsPath;
			}

			const message = `✅ Processed ${results!.length} students\n\nGenerated files:\n` +
				`- students_repos.json\n- students_repos.csv\n- students_repos.txt`;

			const openFiles = 'Open files';
			const choice = await vscode.window.showInformationMessage(message, openFiles);

			if (choice === openFiles) {
				// Open JSON file in editor
				const jsonPath = path.join(outputPath, 'students_repos.json');
				const doc = await vscode.workspace.openTextDocument(jsonPath);
				await vscode.window.showTextDocument(doc);
			}

		} catch (error) {
			console.error('Error in extractRepos command:', error);
			const errorMsg = error instanceof Error ? error.message : String(error);
			await vscode.window.showErrorMessage(`Error processing submissions: ${errorMsg}`);
		}
	});

	context.subscriptions.push(disposable);
}
