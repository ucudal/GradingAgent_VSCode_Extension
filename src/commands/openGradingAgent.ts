import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Open grading agent file and copy it to the workspace .github/agents folder
 */
export function registerOpenGradingAgentCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand('gradingagnet.openGradingAgent', async () => {
		try {
			const workspaceFolders = vscode.workspace.workspaceFolders;

			if (!workspaceFolders || workspaceFolders.length === 0) {
				vscode.window.showErrorMessage(
					'Please open a workspace folder first, then run this command again.'
				);
				return;
			}

			const workspacePath = workspaceFolders[0].uri.fsPath;

			// Ask user to select grading agent file
			const fileUri = await vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				openLabel: 'Select Grading Agent File',
				title: 'Select the grading agent markdown file to copy to .github/agents',
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
			const agentsFolder = path.join(workspacePath, '.github', 'agents');
			const targetFile = path.join(agentsFolder, sourceFileName);

			if (!fs.existsSync(agentsFolder)) {
				fs.mkdirSync(agentsFolder, { recursive: true });
			}

			fs.copyFileSync(sourceFile, targetFile);

			vscode.window.showInformationMessage(
				`✅ Copied ${sourceFileName} to .github/agents in the workspace.`
			);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Error copying grading agent: ${errorMsg}`);
		}
	});

	context.subscriptions.push(disposable);
}