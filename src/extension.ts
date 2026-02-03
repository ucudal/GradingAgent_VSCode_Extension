import * as vscode from 'vscode';
import { registerExtractReposCommand } from './commands/extractRepos';

/**
 * Extension activation
 * This method is called when your extension is activated
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('GradingAgent extension is now active!');

	// Register all commands
	registerExtractReposCommand(context);
}

/**
 * Extension deactivation
 * This method is called when your extension is deactivated
 */
export function deactivate() {}
