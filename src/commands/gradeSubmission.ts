import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StudentSubmission } from '../types';

/**
 * Grade the currently selected student submission
 */
export function registerGradeSubmissionCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand('gradingagent.gradeSubmission', async () => {
		try {
			// Get the workspace folder (root folder)
			const workspaceFolders = vscode.workspace.workspaceFolders;

			if (!workspaceFolders || workspaceFolders.length === 0) {
				vscode.window.showErrorMessage('No workspace folder is open.');
				return;
			}

			const rootPath = workspaceFolders[0].uri.fsPath;
			const jsonPath = path.join(rootPath, 'students_repos.json');

			// Read student data
			if (!fs.existsSync(jsonPath)) {
				vscode.window.showErrorMessage(
					'students_repos.json not found. Please run "Extract Student Repositories" first.'
				);
				return;
			}

			const fileContent = fs.readFileSync(jsonPath, 'utf-8');
			const students: StudentSubmission[] = JSON.parse(fileContent);

			// Find students with cloned repositories
			const studentsWithRepos: StudentSubmission[] = [];
			for (const student of students) {
				const studentFolder = path.join(rootPath, student.carpeta);
				const repoFolder = path.join(studentFolder, 'repo');
				if (fs.existsSync(repoFolder)) {
					studentsWithRepos.push(student);
				}
			}

			if (studentsWithRepos.length === 0) {
				vscode.window.showWarningMessage('No cloned repositories found. Please clone repositories first.');
				return;
			}

			// Ask user to select a student
			const studentNames = studentsWithRepos.map(s => `${s.nombre} (${s.id})`);
			const selected = await vscode.window.showQuickPick(studentNames, {
				placeHolder: 'Select the student repository to grade'
			});

			if (!selected) {
				return;
			}

			// Find the selected student
			const selectedIndex = studentNames.indexOf(selected);
			const selectedStudent = studentsWithRepos[selectedIndex];
			const repoPath = path.join(rootPath, selectedStudent.carpeta, 'repo');

			// Find .sln file in the repository
			const files = fs.readdirSync(repoPath);
			const slnFile = files.find(f => f.endsWith('.sln'));

			if (!slnFile) {
			vscode.window.showWarningMessage(`No .sln file found in ${selectedStudent.nombre}'s repository`);
			return;
		}

		// Open the .sln file
		const slnPath = path.join(repoPath, slnFile);
		const document = await vscode.workspace.openTextDocument(slnPath);
		await vscode.window.showTextDocument(document);

		// Check if grading agent exists in workspace root .github/agents
		const agentPath = path.join(rootPath, '.github', 'agents');
			const agentExists = fs.existsSync(agentPath);

			if (!agentExists) {
				vscode.window.showWarningMessage(
					'No grading agent found in workspace .github/agents folder. Please run OpenGradingAgent first.'
				);
				return;
			}

			// Find the grading agent file
			const agentFiles = fs.readdirSync(agentPath);
			const agentFile = agentFiles.find(f => f.endsWith('.md'));

			if (!agentFile) {
				vscode.window.showWarningMessage('No agent markdown file found in workspace .github/agents/');
				return;
			}

		// Prepare the prompt with agent reference
		const agentName = path.basename(agentFile, '.md');
		const prompt = `@${agentName} grade the submission located at ${slnPath}`;

		// Copy prompt to clipboard
		await vscode.env.clipboard.writeText(prompt);

		// Try to open chat with the query (may not work with agent references)
		try {
			await vscode.commands.executeCommand('workbench.action.chat.open', {
				query: prompt
			});
		} catch {
			// Fallback to just opening the chat
			await vscode.commands.executeCommand('workbench.action.chat.open');
		}

		// Notify user with instructions
		const response = await vscode.window.showInformationMessage(
			`Agent: @${agentName}\n\nThe prompt has been copied to clipboard. Press Cmd+V (Mac) or Ctrl+V (Windows/Linux) to paste it in the chat window.`,
			'I pasted it'
			);

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Error grading submission: ${errorMsg}`);
		}
	});

	context.subscriptions.push(disposable);
}
