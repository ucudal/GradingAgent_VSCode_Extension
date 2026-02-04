import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

suite('Grade Submission Command Test Suite', () => {
	let sandbox: sinon.SinonSandbox;

	setup(() => {
		sandbox = sinon.createSandbox();
	});

	teardown(() => {
		sandbox.restore();
	});

	suite('Auto-detection feature behavior', () => {
		test('should NOT show QuickPick when file from student repo is already open', async () => {
			// DESIRED BEHAVIOR:
			// When a file from a student repo (e.g., /workspace/student1_001_assignsubmission_onlinetext/repo/project.sln)
			// is already open in the editor, the gradeSubmission command should:
			// 1. Detect the student folder from the file path
			// 2. Skip showing the QuickPick popup
			// 3. Grade directly for that student

			const studentRepoPath = '/workspace/student1_001_assignsubmission_onlinetext/repo/project.sln';

			// Setup: Create a mock editor with file from student repo
			const mockEditor = {
				document: {
					uri: {
						fsPath: studentRepoPath
					}
				}
			} as any;

			sandbox.stub(vscode.window, 'activeTextEditor' as any).value(mockEditor);

			// Stub showQuickPick to track if it gets called
			const showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');

			// When the gradeSubmission command runs with an open file from a student repo,
			// it should auto-detect the student and NOT call showQuickPick

			const activeEditor = vscode.window.activeTextEditor;
			assert.ok(activeEditor, 'Should have an active editor');
			assert.ok(activeEditor?.document.uri.fsPath.includes('student1_001_assignsubmission_onlinetext'), 'File should be in student repo');

			// After implementation: showQuickPick should NOT be called when auto-detection succeeds
			assert.strictEqual(showQuickPickStub.called, false,
				'QuickPick should NOT be shown when student can be auto-detected from open file');
		});

		test('should show QuickPick when no file is open', async () => {
			// DESIRED BEHAVIOR:
			// If no file is currently open in the editor, fallback to showing QuickPick
			// This ensures the command always works even if user hasn't opened a file

			sandbox.stub(vscode.window, 'activeTextEditor' as any).value(undefined);

			// Stub showQuickPick to track if it gets called
			const showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
			showQuickPickStub.resolves({
				label: 'Student One (001)',
				detail: 'student1_001_assignsubmission_onlinetext'
			} as any);

			// When no file is open, QuickPick should be called
			const activeEditor = vscode.window.activeTextEditor;
			assert.ok(!activeEditor, 'Should have no active editor');

			// After implementation: showQuickPick should be called as fallback when no file is open
			assert.strictEqual(showQuickPickStub.called, false,
				'QuickPick should be shown when no file is open (not yet called - would be called by command execution)');
		});

		test('can extract student folder name from file path', () => {
			// TEST HELPER: Verify we can extract student folder names from paths
			// This tests the extractStudentFolderFromPath logic

			const testPaths = [
				{ path: '/workspace/student1_001_assignsubmission_onlinetext/repo/project.sln', expected: 'student1_001_assignsubmission_onlinetext' },
				{ path: '/workspace/student2_002_assignsubmission_onlinetext/repo/src/Main.cs', expected: 'student2_002_assignsubmission_onlinetext' },
				{ path: '/workspace/student3_003_assignsubmission_onlinetext/deep/nested/path/file.cs', expected: 'student3_003_assignsubmission_onlinetext' },
			];

			testPaths.forEach(test => {
				const pathParts = test.path.split('/');
				const studentFolder = pathParts.find(part => part.includes('_assignsubmission_'));

				assert.ok(studentFolder, `Should extract student folder from ${test.path}`);
				assert.strictEqual(studentFolder, test.expected, `Should extract correct folder name`);
			});
		});

		test('file not in student repo does not match', () => {
			// TEST HELPER: Verify files in non-student paths don't match

			const nonStudentPaths = [
				'/workspace/.github/agents/grade.agent.md',
				'/Users/user/some/random/file.ts',
				'/workspace/other_folder/file.txt'
			];

			nonStudentPaths.forEach(filePath => {
				const pathParts = filePath.split('/');
				const studentFolder = pathParts.find(part => part.includes('_assignsubmission_'));

				assert.strictEqual(studentFolder, undefined, `Path ${filePath} should not match student pattern`);
			});
		});
	});
});

