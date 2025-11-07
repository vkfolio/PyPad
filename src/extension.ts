import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
const stringArgv = require('string-argv');

let currentPanel: vscode.WebviewPanel | undefined = undefined;
let fileWatcher: vscode.FileSystemWatcher | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
	console.log('PythonPad extension is now active!');

	// Register main command
	const openCmd = vscode.commands.registerCommand('pythonpad.open', () => {
		if (currentPanel) {
			currentPanel.reveal(vscode.ViewColumn.One);
		} else {
			currentPanel = createWebviewPanel(context);

			currentPanel.onDidDispose(
				() => {
					currentPanel = undefined;
					if (fileWatcher) {
						fileWatcher.dispose();
						fileWatcher = undefined;
					}
				},
				null,
				context.subscriptions
			);
		}
	});

	// Register workspace folder command
	const setFolderCmd = vscode.commands.registerCommand('pythonpad.setWorkspaceFolder', async () => {
		await selectWorkspaceFolder();
	});

	context.subscriptions.push(openCmd, setFolderCmd);
}

async function selectWorkspaceFolder(): Promise<vscode.Uri | undefined> {
	const options: vscode.OpenDialogOptions = {
		canSelectMany: false,
		openLabel: 'Select Folder for PythonPad Files',
		canSelectFiles: false,
		canSelectFolders: true
	};

	const result = await vscode.window.showOpenDialog(options);
	if (result && result[0]) {
		const config = vscode.workspace.getConfiguration('pythonpad');
		await config.update('workspaceFolder', result[0].fsPath, vscode.ConfigurationTarget.Global);
		vscode.window.showInformationMessage(`PythonPad workspace folder set to: ${result[0].fsPath}`);
		return result[0];
	}
	return undefined;
}

async function getWorkspaceFolder(): Promise<vscode.Uri | undefined> {
	const config = vscode.workspace.getConfiguration('pythonpad');
	const folderPath = config.get<string>('workspaceFolder');

	if (!folderPath) {
		const uri = await selectWorkspaceFolder();
		return uri;
	}

	return vscode.Uri.file(folderPath);
}

function createWebviewPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
	const panel = vscode.window.createWebviewPanel(
		'pythonPlayground',
		'PythonPad',
		vscode.ViewColumn.One,
		{
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [
				vscode.Uri.joinPath(context.extensionUri, 'media')
			]
		}
	);

	panel.webview.html = getWebviewContent(panel.webview, context);

	setupMessageHandlers(panel, context);
	setupFileWatcher(panel);

	return panel;
}

function setupFileWatcher(panel: vscode.WebviewPanel) {
	const config = vscode.workspace.getConfiguration('pythonpad');
	const folderPath = config.get<string>('workspaceFolder');

	if (!folderPath) {
		return;
	}

	const pattern = new vscode.RelativePattern(folderPath, '**/*.{py,txt,json,csv,md}');
	fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

	// File changed on disk
	fileWatcher.onDidChange(async (uri) => {
		try {
			const content = await vscode.workspace.fs.readFile(uri);
			const text = Buffer.from(content).toString('utf8');
			const filename = path.basename(uri.fsPath);

			panel.webview.postMessage({
				command: 'fileChangedOnDisk',
				filename: filename,
				content: text
			});
		} catch (error) {
			console.error('Error reading changed file:', error);
		}
	});

	// File created
	fileWatcher.onDidCreate(async (uri) => {
		try {
			const content = await vscode.workspace.fs.readFile(uri);
			const text = Buffer.from(content).toString('utf8');
			const filename = path.basename(uri.fsPath);

			panel.webview.postMessage({
				command: 'fileCreatedOnDisk',
				filename: filename,
				content: text
			});
		} catch (error) {
			console.error('Error reading created file:', error);
		}
	});

	// File deleted
	fileWatcher.onDidDelete((uri) => {
		const filename = path.basename(uri.fsPath);
		panel.webview.postMessage({
			command: 'fileDeletedOnDisk',
			filename: filename
		});
	});
}

async function getPythonInterpreters(): Promise<string[]> {
	const interpreters: string[] = [];

	// Try to get from Python extension
	try {
		const pythonExt = vscode.extensions.getExtension('ms-python.python');
		if (pythonExt) {
			if (!pythonExt.isActive) {
				await pythonExt.activate();
			}
			// Python extension API would be accessed here if available
		}
	} catch (error) {
		console.log('Python extension not available');
	}

	// Fallback: manual discovery
	const isWindows = os.platform() === 'win32';
	const searchPaths = isWindows
		? ['python', 'python3', 'py']
		: ['python3', 'python', '/usr/bin/python3', '/usr/local/bin/python3', '/opt/homebrew/bin/python3'];

	for (const pythonPath of searchPaths) {
		try {
			await new Promise<void>((resolve) => {
				const proc = spawn(pythonPath, ['--version']);
				proc.on('close', (code) => {
					if (code === 0 && !interpreters.includes(pythonPath)) {
						interpreters.push(pythonPath);
					}
					resolve();
				});
				proc.on('error', () => resolve());
				setTimeout(() => {
					proc.kill();
					resolve();
				}, 1000);
			});
		} catch (error) {
			// Ignore errors
		}
	}

	return interpreters.length > 0 ? interpreters : ['python3', 'python'];
}

function setupMessageHandlers(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
	panel.webview.onDidReceiveMessage(
		async (message) => {
			switch (message.command) {
				case 'execute':
					try {
						const result = await executeCode(
							message.files,
							message.entryPoint,
							message.args || ''
						);
						panel.webview.postMessage({
							command: 'executionResult',
							output: result.stdout,
							errors: result.stderr,
							exitCode: result.exitCode
						});
					} catch (error: any) {
						panel.webview.postMessage({
							command: 'executionError',
							error: error.message
						});
					}
					break;

				case 'format':
					try {
						const config = vscode.workspace.getConfiguration('pythonpad');
						const formatter = config.get<string>('formatter', 'black');

						if (formatter === 'none') {
							vscode.window.showInformationMessage('Formatter is disabled');
							return;
						}

						const formatted = await formatCode(message.code, formatter, config);
						panel.webview.postMessage({
							command: 'formatted',
							code: formatted
						});
					} catch (error: any) {
						vscode.window.showErrorMessage(`Format failed: ${error.message}`);
					}
					break;

				case 'saveFile':
					try {
						await saveFile(message.filename, message.content);
					} catch (error: any) {
						vscode.window.showErrorMessage(`Save failed: ${error.message}`);
					}
					break;

				case 'openFile':
					try {
						// Select folder instead of file
						const folderUri = await vscode.window.showOpenDialog({
							canSelectMany: false,
							openLabel: 'Select Folder',
							canSelectFiles: false,
							canSelectFolders: true
						});

						if (folderUri && folderUri[0]) {
							const folderPath = folderUri[0].fsPath;

							// Set as workspace folder
							const config = vscode.workspace.getConfiguration('pythonpad');
							await config.update('workspaceFolder', folderPath, vscode.ConfigurationTarget.Global);

							// Setup file watcher for new folder
							if (fileWatcher) {
								fileWatcher.dispose();
							}
							setupFileWatcher(panel);

							// Read all Python and text files from folder
							const files = await vscode.workspace.fs.readDirectory(folderUri[0]);
							const fileContents: { filename: string; content: string }[] = [];

							for (const [filename, fileType] of files) {
								// Only load supported file types
								if (fileType === vscode.FileType.File) {
									const ext = path.extname(filename).toLowerCase();
									if (['.py', '.txt', '.json', '.csv', '.md'].includes(ext)) {
										const fileUri = vscode.Uri.joinPath(folderUri[0], filename);
										const content = await vscode.workspace.fs.readFile(fileUri);
										const text = Buffer.from(content).toString('utf8');
										fileContents.push({ filename, content: text });
									}
								}
							}

							// Check if main.py exists
							const hasMainPy = fileContents.some(f => f.filename === 'main.py');

							// Create main.py if it doesn't exist
							if (!hasMainPy) {
								const mainPyPath = vscode.Uri.joinPath(folderUri[0], 'main.py');
								const defaultContent = 'print("Hello from PythonPad!")\\n';
								await vscode.workspace.fs.writeFile(mainPyPath, Buffer.from(defaultContent, 'utf8'));
								fileContents.push({ filename: 'main.py', content: defaultContent });
							}

							// Send all files to webview
							panel.webview.postMessage({
								command: 'loadFolder',
								files: fileContents,
								folderPath: folderPath
							});

							vscode.window.showInformationMessage(`Opened folder: ${folderPath}`);
						}
					} catch (error: any) {
						vscode.window.showErrorMessage(`Open folder failed: ${error.message}`);
					}
					break;

				case 'getInterpreters':
					try {
						const interpreters = await getPythonInterpreters();
						const config = vscode.workspace.getConfiguration('pythonpad');
						const selectedPath = config.get<string>('pythonPath', 'python3');

						panel.webview.postMessage({
							command: 'interpretersList',
							interpreters: interpreters,
							selected: selectedPath
						});
					} catch (error: any) {
						vscode.window.showErrorMessage(`Get interpreters failed: ${error.message}`);
					}
					break;

				case 'setInterpreter':
					try {
						await vscode.workspace.getConfiguration('pythonpad')
							.update('pythonPath', message.path, vscode.ConfigurationTarget.Global);
					} catch (error: any) {
						vscode.window.showErrorMessage(`Set interpreter failed: ${error.message}`);
					}
					break;

				case 'getSettings':
					const config = vscode.workspace.getConfiguration('pythonpad');
					panel.webview.postMessage({
						command: 'settingsUpdated',
						settings: {
							formatter: config.get('formatter'),
							formatOnSave: config.get('formatOnSave'),
							enableIntelliSense: config.get('enableIntelliSense'),
							lineLength: config.get('lineLength'),
							theme: config.get('theme'),
							fontSize: config.get('fontSize')
						}
					});
					break;

				case 'updateSetting':
					try {
						await vscode.workspace.getConfiguration('pythonpad')
							.update(message.key, message.value, vscode.ConfigurationTarget.Global);

						const updatedConfig = vscode.workspace.getConfiguration('pythonpad');
						panel.webview.postMessage({
							command: 'settingsUpdated',
							settings: {
								formatter: updatedConfig.get('formatter'),
								formatOnSave: updatedConfig.get('formatOnSave'),
								enableIntelliSense: updatedConfig.get('enableIntelliSense'),
								lineLength: updatedConfig.get('lineLength'),
								theme: updatedConfig.get('theme'),
								fontSize: updatedConfig.get('fontSize')
							}
						});
					} catch (error: any) {
						vscode.window.showErrorMessage(`Failed to update setting: ${error.message}`);
					}
					break;
			}
		},
		undefined,
		context.subscriptions
	);
}

async function saveFile(filename: string, content: string): Promise<void> {
	const workspaceFolder = await getWorkspaceFolder();
	if (!workspaceFolder) {
		vscode.window.showWarningMessage('No workspace folder selected. Use "PythonPad: Set Workspace Folder" command.');
		return;
	}

	const fileUri = vscode.Uri.joinPath(workspaceFolder, filename);
	const writeData = Buffer.from(content, 'utf8');

	try {
		await vscode.workspace.fs.writeFile(fileUri, writeData);
		vscode.window.showInformationMessage(`Saved ${filename}`);
	} catch (error: any) {
		throw new Error(`Failed to save ${filename}: ${error.message}`);
	}
}

async function executeCode(
	files: Record<string, string>,
	entryPoint: string,
	argsString: string = ''
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pythonpad-'));

	try {
		// Write all files to temp directory
		for (const [filename, content] of Object.entries(files)) {
			const filePath = path.join(tmpDir, filename);
			const fileDir = path.dirname(filePath);

			await fs.mkdir(fileDir, { recursive: true });
			await fs.writeFile(filePath, content, 'utf8');
		}

		// Get Python path from settings
		const config = vscode.workspace.getConfiguration('pythonpad');
		const pythonPath = config.get<string>('pythonPath', 'python3');

		// Parse command-line arguments
		let parsedArgs: string[] = [];
		if (argsString && argsString.trim()) {
			try {
				parsedArgs = stringArgv(argsString);

				// Validate for dangerous patterns
				const hasDangerousChars = parsedArgs.some(arg =>
					arg.includes(';') || arg.includes('&&') || arg.includes('`') || arg.includes('||')
				);
				if (hasDangerousChars) {
					throw new Error('Arguments contain potentially unsafe characters (;, &&, `, ||)');
				}
			} catch (error: any) {
				throw new Error(`Invalid arguments: ${error.message}`);
			}
		}

		// Execute Python code
		return await new Promise((resolve, reject) => {
			const proc = spawn(pythonPath, ['-u', entryPoint, ...parsedArgs], {
				cwd: tmpDir,
				env: {
					...process.env,
					PYTHONPATH: tmpDir
				}
			});

			let stdout = '';
			let stderr = '';

			proc.stdout.on('data', (data) => {
				stdout += data.toString();
			});

			proc.stderr.on('data', (data) => {
				stderr += data.toString();
			});

			proc.on('close', (code) => {
				resolve({ stdout, stderr, exitCode: code || 0 });
			});

			proc.on('error', (err) => {
				reject(new Error(`Failed to start Python: ${err.message}. Check that Python is installed and pythonpad.pythonPath is configured correctly.`));
			});

			// Set timeout for long-running processes
			setTimeout(() => {
				proc.kill();
				reject(new Error('Execution timeout (30s)'));
			}, 30000);
		});
	} finally {
		// Cleanup temp directory
		await fs.rm(tmpDir, { recursive: true, force: true });
	}
}

async function formatCode(code: string, formatter: string, config: vscode.WorkspaceConfiguration): Promise<string> {
	const lineLength = config.get<number>('lineLength', 88);

	return new Promise((resolve, reject) => {
		let args: string[] = [];

		if (formatter === 'black') {
			args = ['-', '--quiet', '--line-length', lineLength.toString()];
		} else if (formatter === 'autopep8') {
			args = ['-', '--max-line-length', lineLength.toString()];
		} else {
			reject(new Error(`Unknown formatter: ${formatter}`));
			return;
		}

		const proc = spawn(formatter, args);

		let output = '';
		let errorOutput = '';

		proc.stdout.on('data', (data) => {
			output += data.toString();
		});

		proc.stderr.on('data', (data) => {
			errorOutput += data.toString();
		});

		proc.on('close', (code) => {
			if (code === 0) {
				resolve(output);
			} else {
				reject(new Error(`${formatter} failed: ${errorOutput}`));
			}
		});

		proc.on('error', (err) => {
			reject(new Error(`${formatter} not found. Please install it: pip install ${formatter}`));
		});

		proc.stdin.write(code);
		proc.stdin.end();
	});
}

function getWebviewContent(webview: vscode.Webview, context: vscode.ExtensionContext): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https://cdn.jsdelivr.net; script-src 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net;">
	<title>PythonPad</title>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/editor/editor.main.css">
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}

		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			height: 100vh;
			display: flex;
			flex-direction: column;
			background: #1e1e1e;
			color: #d4d4d4;
			overflow: hidden;
		}

		.toolbar {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 8px 12px;
			background: #2d2d30;
			border-bottom: 1px solid #3e3e42;
			flex-shrink: 0;
			flex-wrap: wrap;
		}

		.toolbar button {
			padding: 6px 12px;
			background: #0e639c;
			color: white;
			border: none;
			border-radius: 2px;
			cursor: pointer;
			font-size: 13px;
			font-weight: 500;
		}

		.toolbar button:hover {
			background: #1177bb;
		}

		.toolbar button.run {
			background: #16825d;
		}

		.toolbar button.run:hover {
			background: #1a9870;
		}

		.toolbar button:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		.toolbar .spacer {
			flex: 1;
		}

		.toolbar label {
			font-size: 13px;
			display: flex;
			align-items: center;
			gap: 6px;
		}

		.toolbar input[type="text"],
		.toolbar select {
			background: #3c3c3c;
			color: #d4d4d4;
			border: 1px solid #3e3e42;
			padding: 4px 8px;
			border-radius: 2px;
			font-size: 12px;
		}

		.toolbar input[type="text"] {
			min-width: 150px;
		}

		.settings-dropdown {
			position: relative;
		}

		.settings-button {
			background: #3c3c3c !important;
			padding: 6px 10px !important;
		}

		.settings-menu {
			display: none;
			position: absolute;
			top: 100%;
			right: 0;
			margin-top: 4px;
			background: #252526;
			border: 1px solid #3e3e42;
			border-radius: 4px;
			min-width: 250px;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
			z-index: 1000;
			padding: 8px 0;
		}

		.settings-menu.show {
			display: block;
		}

		.settings-item {
			padding: 8px 16px;
			display: flex;
			justify-content: space-between;
			align-items: center;
			font-size: 13px;
		}

		.settings-item:hover {
			background: #2a2d2e;
		}

		.settings-item label {
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.settings-item select {
			background: #3c3c3c;
			color: #d4d4d4;
			border: 1px solid #3e3e42;
			padding: 4px 8px;
			border-radius: 2px;
			font-size: 12px;
		}

		.settings-item input[type="checkbox"] {
			margin: 0;
		}

		.tabs-bar {
			display: flex;
			align-items: center;
			background: #2d2d30;
			border-bottom: 1px solid #3e3e42;
			flex-shrink: 0;
		}

		.tabs-container {
			display: flex;
			flex: 1;
			overflow-x: auto;
		}

		.tabs-container::-webkit-scrollbar {
			height: 3px;
		}

		.tabs-container::-webkit-scrollbar-thumb {
			background: #424242;
		}

		.tab {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 8px 12px;
			background: #2d2d30;
			border-right: 1px solid #3e3e42;
			cursor: pointer;
			white-space: nowrap;
			font-size: 13px;
			transition: background 0.1s;
		}

		.tab:hover {
			background: #37373d;
		}

		.tab.active {
			background: #1e1e1e;
			border-bottom: 2px solid #007acc;
		}

		.tab-close {
			background: none;
			border: none;
			color: #858585;
			cursor: pointer;
			padding: 0;
			font-size: 16px;
			line-height: 1;
			width: 16px;
			height: 16px;
			display: flex;
			align-items: center;
			justify-content: center;
		}

		.tab-close:hover {
			background: #3e3e42;
			border-radius: 2px;
			color: #d4d4d4;
		}

		.add-tab-btn {
			padding: 8px 12px;
			background: none;
			border: none;
			color: #858585;
			cursor: pointer;
			font-size: 18px;
			line-height: 1;
		}

		.add-tab-btn:hover {
			background: #37373d;
			color: #d4d4d4;
		}

		.main-container {
			display: flex;
			flex: 1;
			overflow: hidden;
		}

		.editor-container {
			flex: 1;
			display: flex;
			flex-direction: column;
		}

		#editor {
			flex: 1;
			height: 100%;
		}

		.console-panel {
			width: 40%;
			display: flex;
			flex-direction: column;
			background: #1e1e1e;
		}

		.console-tabs {
			display: flex;
			background: #2d2d30;
			border-bottom: 1px solid #3e3e42;
		}

		.console-tab {
			padding: 8px 16px;
			cursor: pointer;
			font-size: 13px;
			border-bottom: 2px solid transparent;
		}

		.console-tab:hover {
			background: #37373d;
		}

		.console-tab.active {
			border-bottom-color: #007acc;
		}

		.console-toolbar {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 6px 12px;
			background: #252526;
			border-bottom: 1px solid #3e3e42;
		}

		.console-toolbar button {
			padding: 4px 8px;
			background: #3c3c3c;
			color: #d4d4d4;
			border: none;
			border-radius: 2px;
			cursor: pointer;
			font-size: 12px;
		}

		.console-toolbar button:hover {
			background: #505050;
		}

		.console-content {
			flex: 1;
			overflow-y: auto;
			padding: 12px;
			font-family: 'Consolas', 'Courier New', monospace;
			font-size: 13px;
			line-height: 1.5;
		}

		.console-content::-webkit-scrollbar {
			width: 10px;
		}

		.console-content::-webkit-scrollbar-thumb {
			background: #424242;
			border-radius: 5px;
		}

		.output-line {
			margin-bottom: 2px;
			white-space: pre-wrap;
			word-break: break-all;
		}

		.output-line.stdout {
			color: #d4d4d4;
		}

		.output-line.stderr {
			color: #f48771;
		}

		.output-line.system {
			color: #858585;
			font-style: italic;
		}

		.output-line.success {
			color: #4ec9b0;
		}

		.output-line.error {
			color: #f48771;
			font-weight: bold;
		}

		.gutter {
			background-color: #2d2d30;
			background-repeat: no-repeat;
			background-position: 50%;
		}

		.gutter.gutter-horizontal {
			cursor: col-resize;
			background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAeCAYAAADkftS9AAAAIklEQVQoU2M4c+bMfxAGAgYYmwGrIIiDjrELjpo5aiZeMwF+yNnOs5KSvgAAAABJRU5ErkJggg==');
		}

		.gutter.gutter-horizontal:hover {
			background-color: #007acc;
		}
	</style>
</head>
<body>
	<div class="toolbar">
		<button class="run" id="runBtn" title="Run main.py (Ctrl+Enter)">▶ Run</button>
		<button id="formatBtn" title="Format code">Format</button>
		<button id="newFileBtn" title="New file">+ New File</button>
		<button id="openFileBtn" title="Open folder (auto-creates main.py)">📁 Open Folder</button>
		<label>
			Args:
			<input type="text" id="argsInput" placeholder="--flag value" title="Command-line arguments" />
		</label>
		<label>
			Python:
			<select id="pythonEnvSelect" title="Select Python interpreter">
				<option value="python3">python3</option>
			</select>
		</label>
		<div class="spacer"></div>
		<div class="settings-dropdown">
			<button class="settings-button" id="settingsBtn" title="Settings">⚙ Settings</button>
			<div class="settings-menu" id="settingsMenu">
				<div class="settings-item">
					<label>
						<input type="checkbox" id="intellisenseToggle">
						Enable IntelliSense
					</label>
				</div>
				<div class="settings-item">
					<label>
						<input type="checkbox" id="formatOnSaveToggle">
						Auto-format on save
					</label>
				</div>
				<div class="settings-item">
					<label>Formatter:</label>
					<select id="formatterSelect">
						<option value="black">Black</option>
						<option value="autopep8">autopep8</option>
						<option value="none">None</option>
					</select>
				</div>
				<div class="settings-item">
					<label>Theme:</label>
					<select id="themeSelect">
						<option value="dark">Dark</option>
						<option value="light">Light</option>
					</select>
				</div>
			</div>
		</div>
	</div>

	<div class="tabs-bar">
		<div class="tabs-container" id="tabs"></div>
		<button class="add-tab-btn" id="addTabBtn" title="New file">+</button>
	</div>

	<div class="main-container" id="mainContainer">
		<div class="editor-container" id="editorPane">
			<div id="editor"></div>
		</div>

		<div class="console-panel" id="consolePane">
			<div class="console-tabs">
				<div class="console-tab active" data-tab="console">Console</div>
			</div>
			<div class="console-toolbar">
				<button id="clearConsoleBtn">Clear</button>
				<button id="saveFileBtn" title="Save current file (Ctrl+S)">💾 Save</button>
			</div>
			<div class="console-content" id="consoleOutput"></div>
		</div>
	</div>

	<script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js"></script>
	<script src="https://cdn.jsdelivr.net/npm/split.js@1.6.5/dist/split.min.js"></script>
	<script>
		const vscode = acquireVsCodeApi();
		let editor;
		const files = new Map();
		let activeFile = 'main.py';
		let settings = {
			enableIntelliSense: true,
			formatOnSave: false,
			formatter: 'black',
			theme: 'dark',
			fontSize: 14,
			lineLength: 88
		};
		let isRunning = false;

		// State management
		function saveState() {
			const state = {
				commandArgs: document.getElementById('argsInput').value,
				files: Array.from(files.entries()).map(([name, data]) => ({
					name,
					content: data.model.getValue()
				})),
				activeFile: activeFile
			};
			vscode.setState(state);
		}

		function loadState() {
			const state = vscode.getState();
			if (state) {
				if (state.commandArgs) {
					document.getElementById('argsInput').value = state.commandArgs;
				}
				if (state.files && state.files.length > 0) {
					files.clear();
					state.files.forEach(file => {
						createFile(file.name, file.content);
					});
					if (state.activeFile && files.has(state.activeFile)) {
						switchToFile(state.activeFile);
					}
				}
			}
		}

		// Load Monaco Editor
		require.config({
			paths: {
				'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs'
			}
		});

		require(['vs/editor/editor.main'], () => {
			editor = monaco.editor.create(document.getElementById('editor'), {
				model: null,
				theme: 'vs-dark',
				automaticLayout: true,
				fontSize: 14,
				minimap: { enabled: true },
				lineNumbers: 'on',
				scrollBeyondLastLine: false,
				quickSuggestions: true,
				parameterHints: { enabled: true },
				suggestOnTriggerCharacters: true
			});

			// Initialize Split.js
			Split(['#editorPane', '#consolePane'], {
				sizes: [60, 40],
				minSize: [200, 200],
				gutterSize: 8,
				cursor: 'col-resize',
				direction: 'horizontal',
				onDragEnd: function() {
					editor.layout();
				}
			});

			// Load saved state or create default
			const state = vscode.getState();
			if (state && state.files && state.files.length > 0) {
				loadState();
			} else {
				createFile('main.py', 'print("Hello from PythonPad!")\\n');
				switchToFile('main.py');
			}

			// Request settings and interpreters
			vscode.postMessage({ command: 'getSettings' });
			vscode.postMessage({ command: 'getInterpreters' });

			// Console Functions
			function addConsoleOutput(text, type = 'stdout') {
				const consoleDiv = document.getElementById('consoleOutput');
				const line = document.createElement('div');
				line.className = \`output-line \${type}\`;
				line.textContent = text;
				consoleDiv.appendChild(line);
				consoleDiv.scrollTop = consoleDiv.scrollHeight;
			}

			function clearConsole() {
				document.getElementById('consoleOutput').innerHTML = '';
			}

			// Code Execution - Always run main.py
			function runCode() {
				if (isRunning) return;

				// Check if main.py exists
				if (!files.has('main.py')) {
					const create = confirm('main.py does not exist. Create it now?');
					if (create) {
						createFile('main.py', 'print("Hello from PythonPad!")\\n');
						switchToFile('main.py');
					} else {
						addConsoleOutput('Error: main.py not found', 'error');
						return;
					}
				}

				clearConsole();
				setRunning(true);

				const argsValue = document.getElementById('argsInput').value.trim();
				if (argsValue) {
					addConsoleOutput(\`Running main.py with args: \${argsValue}\`, 'system');
				} else {
					addConsoleOutput('Running main.py...', 'system');
				}

				const filesObj = {};
				for (const [name, data] of files) {
					filesObj[name] = data.model.getValue();
				}

				vscode.postMessage({
					command: 'execute',
					files: filesObj,
					entryPoint: 'main.py',  // Always run main.py
					args: argsValue
				});
			}

			function formatCode() {
				const code = editor.getValue();
				vscode.postMessage({
					command: 'format',
					code: code
				});
			}

			function saveCurrentFile() {
				const content = editor.getValue();
				vscode.postMessage({
					command: 'saveFile',
					filename: activeFile,
					content: content
				});
			}

			function setRunning(running) {
				isRunning = running;
				const runBtn = document.getElementById('runBtn');
				runBtn.disabled = running;
				runBtn.textContent = running ? '⏳ Running...' : '▶ Run';
			}

			// Settings Management
			function applySettings(newSettings) {
				settings = { ...settings, ...newSettings };

				editor.updateOptions({
					quickSuggestions: settings.enableIntelliSense,
					parameterHints: { enabled: settings.enableIntelliSense },
					suggestOnTriggerCharacters: settings.enableIntelliSense,
					theme: settings.theme === 'dark' ? 'vs-dark' : 'vs',
					fontSize: settings.fontSize
				});

				document.getElementById('intellisenseToggle').checked = settings.enableIntelliSense;
				document.getElementById('formatOnSaveToggle').checked = settings.formatOnSave;
				document.getElementById('formatterSelect').value = settings.formatter;
				document.getElementById('themeSelect').value = settings.theme;
			}

			function updateSetting(key, value) {
				vscode.postMessage({
					command: 'updateSetting',
					key: key,
					value: value
				});
			}

			// Event Listeners
			document.getElementById('runBtn').addEventListener('click', runCode);
			document.getElementById('formatBtn').addEventListener('click', formatCode);
			document.getElementById('clearConsoleBtn').addEventListener('click', clearConsole);
			document.getElementById('saveFileBtn').addEventListener('click', saveCurrentFile);

			document.getElementById('newFileBtn').addEventListener('click', () => {
				const filename = prompt('Enter filename (e.g., utils.py):', 'untitled.py');
				if (filename && !files.has(filename)) {
					createFile(filename, '');
					switchToFile(filename);
					// Auto-save new file to workspace folder after a short delay
					setTimeout(() => {
						saveCurrentFile();
					}, 100);
				} else if (filename) {
					alert('File already exists!');
				}
			});

			document.getElementById('openFileBtn').addEventListener('click', () => {
				vscode.postMessage({ command: 'openFile' });
			});

			document.getElementById('addTabBtn').addEventListener('click', () => {
				document.getElementById('newFileBtn').click();
			});

			document.getElementById('argsInput').addEventListener('input', saveState);

			document.getElementById('pythonEnvSelect').addEventListener('change', (e) => {
				vscode.postMessage({
					command: 'setInterpreter',
					path: e.target.value
				});
			});

			// Settings dropdown
			document.getElementById('settingsBtn').addEventListener('click', (e) => {
				e.stopPropagation();
				document.getElementById('settingsMenu').classList.toggle('show');
			});

			document.addEventListener('click', () => {
				document.getElementById('settingsMenu').classList.remove('show');
			});

			document.getElementById('settingsMenu').addEventListener('click', (e) => {
				e.stopPropagation();
			});

			document.getElementById('intellisenseToggle').addEventListener('change', (e) => {
				updateSetting('enableIntelliSense', e.target.checked);
			});

			document.getElementById('formatOnSaveToggle').addEventListener('change', (e) => {
				updateSetting('formatOnSave', e.target.checked);
			});

			document.getElementById('formatterSelect').addEventListener('change', (e) => {
				updateSetting('formatter', e.target.value);
			});

			document.getElementById('themeSelect').addEventListener('change', (e) => {
				updateSetting('theme', e.target.value);
			});

			// Keyboard shortcuts
			window.addEventListener('keydown', (e) => {
				if (e.ctrlKey && e.key === 'Enter') {
					e.preventDefault();
					runCode();
				} else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
					e.preventDefault();
					saveCurrentFile();
				}
			});
		});

		// File Management
		function createFile(name, content = '') {
			const lang = getLanguageFromFilename(name);
			const model = monaco.editor.createModel(content, lang, monaco.Uri.file(name));
			files.set(name, { model, viewState: null });
			renderTabs();
			saveState();
			return model;
		}

		function switchToFile(name) {
			const current = editor.getModel();
			if (current) {
				const currentPath = current.uri.path.substring(1);
				const data = files.get(currentPath);
				if (data) {
					data.viewState = editor.saveViewState();
				}
			}

			const data = files.get(name);
			if (data) {
				editor.setModel(data.model);
				if (data.viewState) {
					editor.restoreViewState(data.viewState);
				}
				activeFile = name;
				editor.focus();
				renderTabs();
				saveState();
			}
		}

		function deleteFile(name) {
			const data = files.get(name);
			if (data) {
				data.model.dispose();
				files.delete(name);

				if (name === activeFile && files.size > 0) {
					const firstFile = Array.from(files.keys())[0];
					switchToFile(firstFile);
				} else if (files.size === 0) {
					createFile('main.py', '');
					switchToFile('main.py');
				}

				renderTabs();
				saveState();
			}
		}

		function renderTabs() {
			const tabsDiv = document.getElementById('tabs');
			tabsDiv.innerHTML = '';

			for (const name of files.keys()) {
				const tab = document.createElement('div');
				tab.className = 'tab' + (name === activeFile ? ' active' : '');

				const tabName = document.createElement('span');
				tabName.textContent = name;
				tabName.addEventListener('click', () => switchToFile(name));

				const closeBtn = document.createElement('button');
				closeBtn.className = 'tab-close';
				closeBtn.innerHTML = '×';
				closeBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					if (files.size > 1 || confirm('Delete the last file?')) {
						deleteFile(name);
					}
				});

				tab.appendChild(tabName);
				tab.appendChild(closeBtn);
				tabsDiv.appendChild(tab);
			}
		}

		function getLanguageFromFilename(filename) {
			const ext = filename.split('.').pop();
			const langMap = {
				'py': 'python',
				'js': 'javascript',
				'ts': 'typescript',
				'json': 'json',
				'md': 'markdown',
				'txt': 'plaintext',
				'csv': 'plaintext',
				'html': 'html',
				'css': 'css'
			};
			return langMap[ext] || 'plaintext';
		}

		// Message Handler
		window.addEventListener('message', event => {
			const message = event.data;

			switch (message.command) {
				case 'executionResult':
					setRunning(false);
					if (message.output) {
						addConsoleOutput(message.output, 'stdout');
					}
					if (message.errors) {
						addConsoleOutput(message.errors, 'stderr');
					}
					if (message.exitCode === 0) {
						addConsoleOutput(\`Exited with code \${message.exitCode}\`, 'success');
					} else {
						addConsoleOutput(\`Exited with code \${message.exitCode}\`, 'error');
					}
					break;

				case 'executionError':
					setRunning(false);
					addConsoleOutput(message.error, 'error');
					break;

				case 'formatted':
					editor.setValue(message.code);
					break;

				case 'settingsUpdated':
					applySettings(message.settings);
					break;

				case 'interpretersList':
					const select = document.getElementById('pythonEnvSelect');
					select.innerHTML = '';
					message.interpreters.forEach(path => {
						const option = document.createElement('option');
						option.value = path;
						option.textContent = path;
						if (path === message.selected) {
							option.selected = true;
						}
						select.appendChild(option);
					});
					break;

				case 'openFileContent':
					if (!files.has(message.filename)) {
						createFile(message.filename, message.content);
					} else {
						const data = files.get(message.filename);
						data.model.setValue(message.content);
					}
					switchToFile(message.filename);
					break;

				case 'loadFolder':
					// Clear existing files
					files.forEach((data, name) => {
						data.model.dispose();
					});
					files.clear();

					// Load all files from folder
					message.files.forEach(file => {
						createFile(file.filename, file.content);
					});

					// Switch to main.py
					if (files.has('main.py')) {
						switchToFile('main.py');
					} else if (files.size > 0) {
						switchToFile(Array.from(files.keys())[0]);
					}

					addConsoleOutput(\`Loaded folder: \${message.folderPath}\`, 'system');
					addConsoleOutput(\`Files loaded: \${message.files.map(f => f.filename).join(', ')}\`, 'system');
					break;

				case 'fileChangedOnDisk':
					if (files.has(message.filename)) {
						const currentContent = files.get(message.filename).model.getValue();
						if (currentContent !== message.content) {
							const reload = confirm(\`\${message.filename} was changed on disk. Reload?\`);
							if (reload) {
								files.get(message.filename).model.setValue(message.content);
							}
						}
					}
					break;

				case 'fileCreatedOnDisk':
					if (!files.has(message.filename)) {
						const add = confirm(\`New file \${message.filename} was created on disk. Open it?\`);
						if (add) {
							createFile(message.filename, message.content);
							switchToFile(message.filename);
						}
					}
					break;

				case 'fileDeletedOnDisk':
					if (files.has(message.filename)) {
						const remove = confirm(\`\${message.filename} was deleted on disk. Close tab?\`);
						if (remove) {
							deleteFile(message.filename);
						}
					}
					break;
			}
		});
	</script>
</body>
</html>`;
}

export function deactivate() {
	if (currentPanel) {
		currentPanel.dispose();
	}
	if (fileWatcher) {
		fileWatcher.dispose();
	}
}
