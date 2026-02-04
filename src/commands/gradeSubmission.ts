import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StudentSubmission } from '../types';

/**
 * Extract student folder name from a file path
 * Looks for pattern: *_###_assignsubmission_onlinetext
 */
function extractStudentFolderFromPath(filePath: string): string | null {
	const pathParts = filePath.split(path.sep);
	for (const part of pathParts) {
		if (part.includes('_assignsubmission_')) {
			return part;
		}
	}
	return null;
}

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

			// Try to auto-detect student from active editor
			let selectedStudent: StudentSubmission | undefined;

			const activeEditor = vscode.window.activeTextEditor;
			if (activeEditor) {
				const openFilePath = activeEditor.document.uri.fsPath;
				const studentFolder = extractStudentFolderFromPath(openFilePath);

				if (studentFolder) {
					// Find matching student by folder name
					selectedStudent = studentsWithRepos.find(s => s.carpeta === studentFolder);
				}
			}

			// If no student found by auto-detection, show QuickPick
			if (!selectedStudent) {
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
				selectedStudent = studentsWithRepos[selectedIndex];
			}

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
					'No grading agent found in workspace .github/agents folder. Please run "Open Grading Agent" first.'
				);
				return;
			}

			// Look for the standard grading agent file
			const agentFile = 'grade.agent.md';
			const agentFilePath = path.join(agentPath, agentFile);

			if (!fs.existsSync(agentFilePath)) {
				vscode.window.showWarningMessage(
					'Grading agent file not found at .github/agents/grade.agent.md. Please run "Open Grading Agent" first.'
				);
				return;
			}

			// Prepare the prompt with agent reference
			const prompt = `@grade.agent grade the submission located at ${slnPath}`;

			// Copy prompt to clipboard
			await vscode.env.clipboard.writeText(prompt);

			// Open chat with the Grading Agent and paste the prompt
			try {
				await vscode.commands.executeCommand('workbench.action.chat.openGrading Agent');
				// Small delay to ensure chat is ready
				await new Promise(resolve => setTimeout(resolve, 500));
				// Paste the prompt into chat
				await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
			} catch {
				// Fallback: Open standard chat with the Grading Agent
				await vscode.commands.executeCommand('workbench.action.chat.open');
				// Small delay to ensure chat is ready
				await new Promise(resolve => setTimeout(resolve, 500));
				// Paste the prompt into chat
				await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
			}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Error grading submission: ${errorMsg}`);
	}
	});

	context.subscriptions.push(disposable);}