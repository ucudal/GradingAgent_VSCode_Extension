import * as vscode from 'vscode';
import * as path from 'path';
import { processSubmissions } from '../utils/moodleParser';
import { saveResults } from '../utils/fileWriter';

/**
 * Extract Student Repositories command
 * Processes Moodle submission folders and extracts student information
 */
export function registerExtractReposCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand('gradingagent.extractRepos', async () => {
		try {
			// Ask user for Moodle submissions folder path
			const folderUri = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				openLabel: 'Open Moodle Submissions Folder',
				title: 'Select folder with student submissions downloaded from Moodle'
			});

			if (!folderUri || folderUri.length === 0) {
				vscode.window.showWarningMessage('No folder selected');
				return;
			}

			const submissionsPath = folderUri[0].fsPath;

			// Show progress
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Extracting student information',
				cancellable: false
			}, async (progress) => {
				progress.report({ increment: 0, message: 'Processing folders...' });

				// Process submissions
				const results = await processSubmissions(submissionsPath);

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

				// Show summary
				const message = `✅ Processed ${results.length} students\n\nGenerated files:\n` +
					`- estudiantes_repos.json\n- estudiantes_repos.csv\n- estudiantes_repos.txt`;

				const openFiles = 'Open files';
				const choice = await vscode.window.showInformationMessage(message, openFiles);

				if (choice === openFiles) {
					// Open JSON file in editor
					const jsonPath = path.join(outputPath, 'estudiantes_repos.json');
					const doc = await vscode.workspace.openTextDocument(jsonPath);
					await vscode.window.showTextDocument(doc);
				}
			});

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Error processing submissions: ${errorMsg}`);
		}
	});

	context.subscriptions.push(disposable);
}
