import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const INSTRUCTIONS_SUFFIX = 'instructions.md';
const DISABLED_INSTRUCTIONS_SUFFIX = 'instructions.md.bak';
const AGENT_SUFFIX = 'agent.md';
const DISABLED_AGENT_SUFFIX = 'agent.md.bak';

interface InstructionItem extends vscode.QuickPickItem {
	uri: vscode.Uri;
	isEnabled: boolean;
}

function isDisabledInstructions(filePath: string): boolean {
	return filePath.endsWith(DISABLED_INSTRUCTIONS_SUFFIX);
}

function isDisabledAgent(filePath: string): boolean {
	return filePath.endsWith(DISABLED_AGENT_SUFFIX);
}

function isInstructions(filePath: string): boolean {
	return filePath.endsWith(INSTRUCTIONS_SUFFIX) && !isDisabledInstructions(filePath);
}

function isAgent(filePath: string): boolean {
	return filePath.endsWith(AGENT_SUFFIX) && !isDisabledAgent(filePath);
}

function isEnabled(filePath: string): boolean {
	return isInstructions(filePath) || isAgent(filePath);
}

function toEnabledPath(filePath: string): string {
	if (isDisabledInstructions(filePath)) {
		return filePath.replace(DISABLED_INSTRUCTIONS_SUFFIX, INSTRUCTIONS_SUFFIX);
	}
	if (isDisabledAgent(filePath)) {
		return filePath.replace(DISABLED_AGENT_SUFFIX, AGENT_SUFFIX);
	}
	return filePath;
}

function toDisabledPath(filePath: string): string {
	if (isInstructions(filePath)) {
		return filePath.replace(INSTRUCTIONS_SUFFIX, DISABLED_INSTRUCTIONS_SUFFIX);
	}
	if (isAgent(filePath)) {
		return filePath.replace(AGENT_SUFFIX, DISABLED_AGENT_SUFFIX);
	}
	return filePath;
}

async function findInstructionFiles(): Promise<vscode.Uri[]> {
	const enabledMatches = await vscode.workspace.findFiles('**/*{instructions,agent}.md', '**/{node_modules,.git,.vscode}/**');
	const disabledMatches = await vscode.workspace.findFiles('**/*{instructions,agent}.md.bak', '**/{node_modules,.git,.vscode}/**');
	const byPath = new Map<string, vscode.Uri>();
	for (const uri of [...enabledMatches, ...disabledMatches]) {
		byPath.set(uri.fsPath, uri);
	}
	return Array.from(byPath.values());
}

export function registerEnableInstructionsCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand('gradingagent.enableInstructionsAndAgents', async () => {
		try {
			const workspaceFolders = vscode.workspace.workspaceFolders;

			if (!workspaceFolders || workspaceFolders.length === 0) {
				vscode.window.showErrorMessage('Please open a workspace folder first, then run this command again.');
				return;
			}

			const instructionFiles = await findInstructionFiles();

			if (instructionFiles.length === 0) {
				vscode.window.showInformationMessage('No instruction or agent files found (*instructions.md, *agent.md).');
				return;
			}

			const items: InstructionItem[] = instructionFiles.map((uri) => {
				const relativePath = vscode.workspace.asRelativePath(uri.fsPath);
				const enabled = isEnabled(uri.fsPath);
				return {
					label: relativePath,
					description: enabled ? 'enabled' : 'disabled',
					picked: enabled,
					uri,
					isEnabled: enabled
				};
			});

			const picked = await vscode.window.showQuickPick(items, {
				placeHolder: 'Select instruction and agent files to enable (checked = enabled)',
				canPickMany: true
			});

			if (!picked) {
				return;
			}

			const pickedSet = new Set(picked.map((item) => item.uri.fsPath));
			let updatedCount = 0;
			let skippedCount = 0;
			const errors: string[] = [];

			for (const item of items) {
				const shouldEnable = pickedSet.has(item.uri.fsPath);
				if (shouldEnable === item.isEnabled) {
					continue;
				}

				const targetPath = shouldEnable ? toEnabledPath(item.uri.fsPath) : toDisabledPath(item.uri.fsPath);

				if (targetPath === item.uri.fsPath) {
					continue;
				}

				if (fs.existsSync(targetPath)) {
					skippedCount++;
					errors.push(`Target already exists: ${vscode.workspace.asRelativePath(targetPath)}`);
					continue;
				}

				try {
					await vscode.workspace.fs.rename(item.uri, vscode.Uri.file(targetPath));
					updatedCount++;
				} catch (error) {
					skippedCount++;
					const errorMsg = error instanceof Error ? error.message : String(error);
					errors.push(`${vscode.workspace.asRelativePath(item.uri.fsPath)}: ${errorMsg}`);
				}
			}

			if (updatedCount === 0 && errors.length === 0) {
				vscode.window.showInformationMessage('No changes were needed.');
				return;
			}

			let message = `✅ Updated ${updatedCount} instruction file(s).`;
			if (skippedCount > 0) {
				message += `\n⚠️ Skipped ${skippedCount} file(s).`;
			}

			if (errors.length > 0 && errors.length <= 5) {
				message += `\n\nDetails:\n${errors.map((err) => `- ${err}`).join('\n')}`;
			} else if (errors.length > 5) {
				message += '\n\nSee console for error details.';
				console.warn('Enable Instructions errors:', errors);
			}

			if (errors.length > 0) {
				vscode.window.showWarningMessage(message);
			} else {
				vscode.window.showInformationMessage(message);
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Error enabling instructions: ${errorMsg}`);
		}
	});

	context.subscriptions.push(disposable);
}
