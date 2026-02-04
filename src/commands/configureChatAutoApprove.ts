import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Configure Chat Auto Approve settings for dotnet commands
 */
export function registerConfigureChatAutoApproveCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand('gradingagent.configureChatAutoApprove', async () => {
		try {
			const workspaceFolders = vscode.workspace.workspaceFolders;

			if (!workspaceFolders || workspaceFolders.length === 0) {
				vscode.window.showErrorMessage(
					'Please open a workspace folder first, then run this command again.'
				);
				return;
			}

			const workspacePath = workspaceFolders[0].uri.fsPath;
			const vscodeFolder = path.join(workspacePath, '.vscode');
			const settingsFile = path.join(vscodeFolder, 'settings.json');

			// Create .vscode folder if it doesn't exist
			if (!fs.existsSync(vscodeFolder)) {
				fs.mkdirSync(vscodeFolder, { recursive: true });
			}

			// Read existing settings or create new object
			let settings: any = {};
			if (fs.existsSync(settingsFile)) {
				try {
					const content = fs.readFileSync(settingsFile, 'utf-8');
					settings = JSON.parse(content);
				} catch (error) {
					vscode.window.showWarningMessage(
						'Failed to parse existing settings.json. Creating backup and writing new settings.'
					);
					// Backup the existing file
					fs.copyFileSync(settingsFile, `${settingsFile}.backup`);
					settings = {};
				}
			}

			// Add or update chat.tools.terminal.autoApprove settings
			settings['chat.tools.terminal.autoApprove'] = {
				'dotnet build': true,
				'dotnet restore': true,
				'dotnet test': true
			};

			// Write settings back to file
			fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 4), 'utf-8');

			vscode.window.showInformationMessage(
				'✅ Chat auto-approve settings configured successfully!'
			);

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Error configuring chat auto-approve: ${errorMsg}`);
		}
	});

	context.subscriptions.push(disposable);
}
