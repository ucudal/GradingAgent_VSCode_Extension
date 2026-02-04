import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StudentSubmission } from '../types';

/**
 * Delete grades files from workspace and student folders
 */
export function registerDeleteGradesCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand('gradingagent.deleteGrades', async () => {
		try {
			// Get workspace folder
			const workspaceFolders = vscode.workspace.workspaceFolders;

			if (!workspaceFolders || workspaceFolders.length === 0) {
				vscode.window.showErrorMessage(
					'Please open the folder with Moodle submissions first, then run this command again.'
				);
				return;
			}

			const moodlePath = workspaceFolders[0].uri.fsPath;

			// Step 1: Resolve file names from configuration and grading agent
			const config = vscode.workspace.getConfiguration('gradingagent');
			let gradesFileName = config.get<string>('gradesFileName', 'grades.csv');
			let studentGradeFileName = config.get<string>('studentGradeFileName', 'GRADE.md');

			// Try to find and parse grading agent file (grade.agent.md in .github/agents)
			const agentPath = path.join(moodlePath, '.github', 'agents', 'grade.agent.md');
			let agentFileFound = false;
			let detectedFileNames: { gradesFile?: string; studentGradeFile?: string } = {};

			if (fs.existsSync(agentPath)) {
				agentFileFound = true;
				try {
					const agentContent = fs.readFileSync(agentPath, 'utf-8');
					detectedFileNames = detectFileNamesFromAgent(agentContent);
					if (detectedFileNames.gradesFile) {
						gradesFileName = detectedFileNames.gradesFile;
					}
					if (detectedFileNames.studentGradeFile) {
						studentGradeFileName = detectedFileNames.studentGradeFile;
					}
				} catch (error) {
					console.error(`Error reading agent file grade.agent.md:`, error);
				}
			}

			const agentGradesFile = detectedFileNames.gradesFile;
			const agentStudentGradeFile = detectedFileNames.studentGradeFile;
			const agentDiffers = !!agentFileFound && (
				(agentGradesFile && agentGradesFile !== gradesFileName) ||
				(agentStudentGradeFile && agentStudentGradeFile !== studentGradeFileName)
			);

			let shouldAskToStore = false;

			// Step 2: Ask user to confirm or adjust file names
			if (agentDiffers) {
				const agentChoice = await vscode.window.showQuickPick(
					[
						{
							label: 'Use grading agent file names',
							description: `Use ${agentGradesFile ?? gradesFileName} and ${agentStudentGradeFile ?? studentGradeFileName}`
						},
						{
							label: 'Keep configured file names',
							description: `Use ${gradesFileName} and ${studentGradeFileName}`
						},
						{
							label: 'Specify custom names',
							description: 'Enter custom file names'
						}
					],
					{ placeHolder: 'The grading agent uses different file names. Which should be used?', canPickMany: false }
				);

				if (!agentChoice) {
					return;
				}

				if (agentChoice.label === 'Use grading agent file names') {
					gradesFileName = agentGradesFile ?? gradesFileName;
					studentGradeFileName = agentStudentGradeFile ?? studentGradeFileName;
					shouldAskToStore = true;
				} else if (agentChoice.label === 'Specify custom names') {
					shouldAskToStore = true;
					const customGradesFile = await vscode.window.showInputBox({
						prompt: 'Enter the name of the grades file in workspace root',
						value: gradesFileName,
						validateInput: (value) => {
							return value.trim().length === 0 ? 'File name cannot be empty' : undefined;
						}
					});

					if (!customGradesFile) {
						return;
					}
					gradesFileName = customGradesFile.trim();

					const customStudentGradeFile = await vscode.window.showInputBox({
						prompt: 'Enter the name of the grade file in each student folder',
						value: studentGradeFileName,
						validateInput: (value) => {
							return value.trim().length === 0 ? 'File name cannot be empty' : undefined;
						}
					});

					if (!customStudentGradeFile) {
						return;
					}
					studentGradeFileName = customStudentGradeFile.trim();
				}
			} else {
				const confirmed = await vscode.window.showQuickPick(
					[
						{ label: 'Use these file names', description: `Use ${gradesFileName} and ${studentGradeFileName}` },
						{ label: 'Specify custom names', description: 'Enter custom file names' }
					],
					{ placeHolder: 'Confirm the file names to delete', canPickMany: false }
				);

				if (!confirmed) {
					return;
				}

				if (confirmed.label === 'Specify custom names') {
					shouldAskToStore = true;
					const customGradesFile = await vscode.window.showInputBox({
						prompt: 'Enter the name of the grades file in workspace root',
						value: gradesFileName,
						validateInput: (value) => {
							return value.trim().length === 0 ? 'File name cannot be empty' : undefined;
						}
					});

					if (!customGradesFile) {
						return;
					}
					gradesFileName = customGradesFile.trim();

					const customStudentGradeFile = await vscode.window.showInputBox({
						prompt: 'Enter the name of the grade file in each student folder',
						value: studentGradeFileName,
						validateInput: (value) => {
							return value.trim().length === 0 ? 'File name cannot be empty' : undefined;
						}
					});

					if (!customStudentGradeFile) {
						return;
					}
					studentGradeFileName = customStudentGradeFile.trim();
				}
			}

			if (shouldAskToStore) {
				const configChoice = await vscode.window.showQuickPick(
					[
						{ label: 'Workspace', description: 'Store in workspace configuration (.vscode/settings.json)' },
						{ label: 'Global', description: 'Store in global VS Code settings' },
						{ label: 'Skip', description: 'Do not store configuration' }
					],
					{ placeHolder: 'Where would you like to store the file names?', canPickMany: false }
				);

				if (!configChoice) {
					return;
				}

				if (configChoice.label === 'Workspace') {
					await storeInWorkspaceConfig(moodlePath, gradesFileName, studentGradeFileName);
				} else if (configChoice.label === 'Global') {
					await storeInGlobalConfig(gradesFileName, studentGradeFileName);
				}
			}

			// Step 3: Confirm deletion
			const message = `This will delete:\n` +
				`1. ${gradesFileName} from workspace root\n` +
				`2. ${studentGradeFileName} from each student folder (including subfolders)\n\n` +
				`Are you sure?`;

			const choice = await vscode.window.showWarningMessage(
				message,
				{ modal: true },
				'Delete All'
			);

			if (choice !== 'Delete All') {
				return;
			}

			// Step 4: Get student folders
			const jsonPath = path.join(moodlePath, 'students_repos.json');
			let students: StudentSubmission[] = [];

			if (fs.existsSync(jsonPath)) {
				try {
					const fileContent = fs.readFileSync(jsonPath, 'utf-8');
					students = JSON.parse(fileContent);
				} catch (error) {
					console.warn('Could not read students_repos.json, will list all directories');
				}
			}

			// If no students data, list all subdirectories
			if (students.length === 0) {
				const entries = fs.readdirSync(moodlePath, { withFileTypes: true });
				students = entries
					.filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
					.map(entry => ({
						nombre: entry.name,
						id: entry.name,
						repositorio: '',
						carpeta: entry.name
					}));
			}

			// Step 5: Delete files with progress
			let successCount = 0;
			let failureCount = 0;
			const failures: { location: string; error: string }[] = [];

			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Deleting grade files',
				cancellable: false
			}, async (progress) => {
				// Delete grades file from workspace root
				const gradesPath = path.join(moodlePath, gradesFileName);
				if (fs.existsSync(gradesPath)) {
					try {
						fs.unlinkSync(gradesPath);
						successCount++;
						progress.report({
							increment: (100 / (students.length + 1)),
							message: `Deleted ${gradesFileName} from workspace root`
						});
					} catch (error) {
						failureCount++;
						const errorMsg = error instanceof Error ? error.message : String(error);
						failures.push({ location: `workspace root`, error: errorMsg });
						console.error(`Failed to delete ${gradesFileName}:`, errorMsg);
					}
				}

				// Delete grade files from student folders (including subfolders)
				for (let i = 0; i < students.length; i++) {
					const student = students[i];
					const studentFolder = path.join(moodlePath, student.carpeta);
					const gradeFilePaths = findFilesByName(studentFolder, studentGradeFileName);

					progress.report({
						increment: (100 / (students.length + 1)),
						message: `[${i + 1}/${students.length}] ${student.nombre}`
					});

					for (const gradeFilePath of gradeFilePaths) {
						try {
							fs.unlinkSync(gradeFilePath);
							successCount++;
						} catch (error) {
							failureCount++;
							const errorMsg = error instanceof Error ? error.message : String(error);
							failures.push({ location: `${student.nombre}`, error: errorMsg });
							console.error(`Failed to delete grade file for ${student.nombre}:`, errorMsg);
						}
					}
				}
			});

			// Show result
			let resultMessage = `✅ Deleted ${successCount} file(s).`;
			if (failureCount > 0) {
				resultMessage += `\n⚠️ Failed to delete ${failureCount} file(s).`;
				for (const failure of failures) {
					resultMessage += `\n  - ${failure.location}: ${failure.error}`;
				}
				vscode.window.showWarningMessage(resultMessage);
			} else {
				vscode.window.showInformationMessage(resultMessage);
			}

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Error deleting grades: ${errorMsg}`);
			console.error('Error in deleteGrades:', error);
		}
	});

	context.subscriptions.push(disposable);
}

	/**
	 * Find files by name under a root directory (recursive)
	 */
	function findFilesByName(rootPath: string, fileName: string): string[] {
		const results: string[] = [];
		const stack: string[] = [rootPath];
		const ignoreDirs = new Set(['.git', 'node_modules', '.vscode']);

		while (stack.length > 0) {
			const current = stack.pop();
			if (!current) {
				continue;
			}

			let entries: fs.Dirent[] = [];
			try {
				entries = fs.readdirSync(current, { withFileTypes: true });
			} catch (error) {
				continue;
			}

			for (const entry of entries) {
				const entryPath = path.join(current, entry.name);
				if (entry.isDirectory()) {
					if (!ignoreDirs.has(entry.name)) {
						stack.push(entryPath);
					}
				} else if (entry.isFile() && entry.name === fileName) {
					results.push(entryPath);
				}
			}
		}

		return results;
	}

/**
 * Detect file names from grading agent content
 */
function detectFileNamesFromAgent(content: string): { gradesFile?: string; studentGradeFile?: string } {
	const result: { gradesFile?: string; studentGradeFile?: string } = {};

	// Look for patterns like "grades.csv" or "gradesFile: something.csv"
	const gradesFilePattern = /(?:grades?\.csv|gradesFile[:\s=]+['"]?([^'"]+\.csv)['"]?)/i;
	const gradesMatch = content.match(gradesFilePattern);
	if (gradesMatch) {
		result.gradesFile = gradesMatch[1] || 'grades.csv';
	}

	// Look for patterns like "GRADE.md" or "gradeFile: something.md"
	const studentGradePattern = /(?:GRADE\.md|(?:student)?[Gg]rade[Ff]ile[:\s=]+['"]?([^'"]+\.md)['"]?)/i;
	const studentMatch = content.match(studentGradePattern);
	if (studentMatch) {
		result.studentGradeFile = studentMatch[1] || 'GRADE.md';
	}

	return result;
}

/**
 * Store file names in workspace configuration
 */
async function storeInWorkspaceConfig(
	workspacePath: string,
	gradesFileName: string,
	studentGradeFileName: string
): Promise<void> {
	try {
		const vscodeFolder = path.join(workspacePath, '.vscode');
		const settingsFile = path.join(vscodeFolder, 'settings.json');

		if (!fs.existsSync(vscodeFolder)) {
			fs.mkdirSync(vscodeFolder, { recursive: true });
		}

		let settings: any = {};
		if (fs.existsSync(settingsFile)) {
			try {
				const content = fs.readFileSync(settingsFile, 'utf-8');
				settings = JSON.parse(content);
			} catch (error) {
				console.warn('Could not parse existing settings.json');
			}
		}

		settings['gradingagent.gradesFileName'] = gradesFileName;
		settings['gradingagent.studentGradeFileName'] = studentGradeFileName;

		fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 4), 'utf-8');
		vscode.window.showInformationMessage('✅ File names stored in workspace configuration.');
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		vscode.window.showWarningMessage(`Could not store in workspace config: ${errorMsg}`);
		console.error('Error storing workspace config:', error);
	}
}

/**
 * Store file names in global configuration
 */
async function storeInGlobalConfig(
	gradesFileName: string,
	studentGradeFileName: string
): Promise<void> {
	try {
		const config = vscode.workspace.getConfiguration('gradingagent');
		await config.update('gradesFileName', gradesFileName, vscode.ConfigurationTarget.Global);
		await config.update('studentGradeFileName', studentGradeFileName, vscode.ConfigurationTarget.Global);
		vscode.window.showInformationMessage('✅ File names stored in global configuration.');
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		vscode.window.showWarningMessage(`Could not store in global config: ${errorMsg}`);
		console.error('Error storing global config:', error);
	}
}
