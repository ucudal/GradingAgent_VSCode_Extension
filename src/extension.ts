import * as vscode from 'vscode';
import { registerExtractReposCommand } from './commands/extractRepos';
import { registerCloneReposCommand } from './commands/cloneRepos';
import { registerDeleteClonedReposCommand } from './commands/deleteClonedRepos';
import { registerOpenAndCopyGradingAgentCommand } from './commands/openAndCopyGradingAgent';

/**
 * Extension activation
 * This method is called when your extension is activated
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('GradingAgent extension is now active!');

	// Register all commands
	registerExtractReposCommand(context);
	registerCloneReposCommand(context);
	registerDeleteClonedReposCommand(context);
	registerOpenAndCopyGradingAgentCommand(context);
}

/**
 * Extension deactivation
 * This method is called when your extension is deactivated
 */
export function deactivate() {}
