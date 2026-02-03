import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StudentSubmission } from '../types';

/**
 * Add all cloned repositories to the current workspace
 */
export function registerAddReposToWorkspaceCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand('gradingagent.addReposToWorkspace', async () => {
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

			// Confirm adding to workspace
			const message = `Add ${studentsWithRepos.length} repositories to workspace?`;
			const choice = await vscode.window.showInformationMessage(
				message,
				{ modal: true },
				'Add All'
			);

			if (choice !== 'Add All') {
				return;
			}

			// Prepare workspace folders to add
			const foldersToAdd: { uri: vscode.Uri; name?: string }[] = [];

			for (const student of studentsWithRepos) {
				const studentFolder = path.join(moodlePath, student.carpeta);
				const repoFolder = path.join(studentFolder, 'repo');

				foldersToAdd.push({
					uri: vscode.Uri.file(repoFolder),
					name: `${student.nombre} (${student.id})`
				});
			}

			// Add all folders to workspace
			const currentFolderCount = vscode.workspace.workspaceFolders?.length || 0;
			const success = vscode.workspace.updateWorkspaceFolders(
				currentFolderCount,
				0,
				...foldersToAdd
			);

			if (success) {
				vscode.window.showInformationMessage(
					`✅ Added ${studentsWithRepos.length} repositories to workspace!`
				);
			} else {
				vscode.window.showErrorMessage('Failed to add repositories to workspace.');
			}

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Error adding repositories to workspace: ${errorMsg}`);
		}
	});

	context.subscriptions.push(disposable);
}
