import * as vscode from 'vscode';
import { registerExtractReposCommand } from './commands/extractRepos';
import { registerCloneReposCommand } from './commands/cloneRepos';
import { registerDeleteClonedReposCommand } from './commands/deleteClonedRepos';
import { registerOpenGradingAgentCommand } from './commands/openGradingAgent';
import { registerGradeSubmissionCommand } from './commands/gradeSubmission';
import { registerConfigureChatAutoApproveCommand } from './commands/configureChatAutoApprove';
import { registerDeleteGradesCommand } from './commands/deleteGrades';

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
	registerOpenGradingAgentCommand(context);
	registerGradeSubmissionCommand(context);
	registerConfigureChatAutoApproveCommand(context);
	registerDeleteGradesCommand(context);
}

/**
 * Extension deactivation
 * This method is called when your extension is deactivated
 */
export function deactivate() {}
