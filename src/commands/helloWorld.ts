import * as vscode from 'vscode';

/**
 * Hello World command - sample command for testing
 */
export function registerHelloWorldCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand('gradingagent.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from GradingAgent!');
	});

	context.subscriptions.push(disposable);
}
