import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { PythonLSPServer } from './lspServer';
const stringArgvModule = require('string-argv');
const stringArgv = stringArgvModule.default || stringArgvModule;

let currentPanel: vscode.WebviewPanel | undefined = undefined;
let fileWatcher: vscode.FileSystemWatcher | undefined = undefined;
let lspServer: PythonLSPServer | undefined = undefined;

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
					if (lspServer) {
						lspServer.stop();
						lspServer = undefined;
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

	// Send initial theme to webview
	const sendThemeToWebview = () => {
		const theme = vscode.window.activeColorTheme;
		const themeKind = theme.kind === vscode.ColorThemeKind.Light ? 'light' :
		                  theme.kind === vscode.ColorThemeKind.HighContrast ? 'high-contrast' : 'dark';
		panel.webview.postMessage({
			command: 'themeChanged',
			themeKind: themeKind
		});
	};

	// Send theme immediately
	sendThemeToWebview();

	// Listen for theme changes and update webview
	context.subscriptions.push(
		vscode.window.onDidChangeActiveColorTheme(() => {
			sendThemeToWebview();
		})
	);

	// Start Python LSP server for IntelliSense
	const config = vscode.workspace.getConfiguration('pythonpad');
	const enableIntelliSense = config.get<boolean>('enableIntelliSense', true);

	if (enableIntelliSense) {
		lspServer = new PythonLSPServer();
		lspServer.start().then((wsPort) => {
			// Send WebSocket port to webview
			panel.webview.postMessage({
				command: 'lspServerReady',
				port: wsPort
			});
			console.log(`LSP server ready, notified webview about port ${wsPort}`);
		}).catch((error) => {
			vscode.window.showErrorMessage(
				`Failed to start Python LSP server: ${error.message}\n\n` +
				`Please install it with: pip install "python-lsp-server[websockets]"`
			);
			console.error('LSP server start failed:', error);
		});
	}

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
							message.args || '',
							panel
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

				case 'inputResponse':
					// Handle user input for interactive Python input()
					if (activeProcess && activeProcess.proc.stdin) {
						try {
							// Write input with newline and flush
							activeProcess.proc.stdin.write(message.input + '\n');

							// Some systems need explicit flush
							if (typeof activeProcess.proc.stdin.flush === 'function') {
								activeProcess.proc.stdin.flush();
							}
						} catch (error: any) {
							panel.webview.postMessage({
								command: 'executionError',
								error: `Failed to send input: ${error.message}`
							});
						}
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

				case 'promptNewFile':
					try {
						const filename = await vscode.window.showInputBox({
							prompt: 'Enter filename (e.g., utils.py)',
							value: 'untitled.py',
							validateInput: (value) => {
								if (!value) {
									return 'Filename cannot be empty';
								}
								if (!/^[a-zA-Z0-9_\-\.]+$/.test(value)) {
									return 'Invalid filename';
								}
								return null;
							}
						});

						if (filename) {
							panel.webview.postMessage({
								command: 'createNewFile',
								filename: filename
							});
						}
					} catch (error: any) {
						vscode.window.showErrorMessage(`Create file failed: ${error.message}`);
					}
					break;

				case 'openSingleFile':
					try {
						// Select single file
						const fileUri = await vscode.window.showOpenDialog({
							canSelectMany: false,
							openLabel: 'Open File',
							canSelectFiles: true,
							canSelectFolders: false,
							filters: {
								'Supported Files': ['py', 'txt', 'json', 'csv', 'md', 'js', 'ts', 'html', 'css']
							}
						});

						if (fileUri && fileUri[0]) {
							const content = await vscode.workspace.fs.readFile(fileUri[0]);
							const text = Buffer.from(content).toString('utf8');
							const filename = path.basename(fileUri[0].fsPath);

							panel.webview.postMessage({
								command: 'openFileContent',
								filename: filename,
								content: text
							});
						}
					} catch (error: any) {
						vscode.window.showErrorMessage(`Open file failed: ${error.message}`);
					}
					break;

				case 'openFolder':
					try {
						// Select folder
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

// Store active Python process for interactive input
let activeProcess: { proc: any; panel: vscode.WebviewPanel; tmpDir: string } | null = null;

async function executeCode(
	files: Record<string, string>,
	entryPoint: string,
	argsString: string = '',
	panel: vscode.WebviewPanel
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

		// Execute Python code with interactive input support
		return await new Promise((resolve, reject) => {
			const proc = spawn(pythonPath, ['-u', entryPoint, ...parsedArgs], {
				cwd: tmpDir,
				env: {
					...process.env,
					PYTHONPATH: tmpDir
				}
			});

			// Store process for input handling
			activeProcess = { proc, panel, tmpDir };

			let stdout = '';
			let stderr = '';
			let lastOutputTime = Date.now();
			let pendingOutput = '';

			// Stream stdout in real-time
			proc.stdout.on('data', (data) => {
				const text = data.toString();
				stdout += text;
				lastOutputTime = Date.now();

				// Send output chunk to webview
				panel.webview.postMessage({
					command: 'outputChunk',
					text: text,
					type: 'stdout'
				});

				// Track output for input detection
				// Keep only the last line that doesn't end with newline
				if (text.includes('\n')) {
					const lines = text.split('\n');
					pendingOutput = lines[lines.length - 1]; // Last line (might be empty)
				} else {
					pendingOutput += text;
				}

				// Detect input() prompt: output without trailing newline
				if (!text.endsWith('\n') && !text.endsWith('\r\n')) {
					setTimeout(() => {
						const timeSinceOutput = Date.now() - lastOutputTime;
						// If no new output for 150ms, likely waiting for input
						if (timeSinceOutput >= 150 && pendingOutput.length > 0) {
							panel.webview.postMessage({
								command: 'waitingForInput',
								prompt: pendingOutput.trim()
							});
						}
					}, 200);
				}
			});

			proc.stderr.on('data', (data) => {
				const text = data.toString();
				stderr += text;

				// Send error output to webview
				panel.webview.postMessage({
					command: 'outputChunk',
					text: text,
					type: 'stderr'
				});
			});

			proc.on('close', (code) => {
				activeProcess = null;
				resolve({ stdout, stderr, exitCode: code || 0 });
			});

			proc.on('error', (err) => {
				activeProcess = null;
				reject(new Error(`Failed to start Python: ${err.message}. Check that Python is installed and pythonpad.pythonPath is configured correctly.`));
			});

			// Set timeout for long-running processes
			setTimeout(() => {
				proc.kill();
				activeProcess = null;
				reject(new Error('Execution timeout (30s)'));
			}, 30000);
		});
	} finally {
		// Cleanup temp directory with delay for Windows file handle release
		try {
			await new Promise(r => setTimeout(r, 100));
			await fs.rm(tmpDir, { recursive: true, force: true });
		} catch (cleanupError: any) {
			// Ignore cleanup errors - they're not critical
			console.warn(`Failed to cleanup temp directory: ${cleanupError.message}`);
		}
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
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https://cdn.jsdelivr.net; script-src 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net blob:; worker-src blob:; font-src https://cdn.jsdelivr.net; connect-src ws://localhost:* ws://127.0.0.1:*;">
	<title>PythonPad</title>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/editor/editor.main.css">
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}

		body {
			font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
			font-size: var(--vscode-font-size, 13px);
			height: 100vh;
			display: flex;
			flex-direction: column;
			background: var(--vscode-editor-background, #1e1e1e);
			color: var(--vscode-editor-foreground, #d4d4d4);
			overflow: hidden;
			transition: background-color 0.2s ease, color 0.2s ease;
		}

		.toolbar {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 8px 12px;
			background: var(--vscode-sideBar-background, #252526);
			border-bottom: 1px solid var(--vscode-panel-border, #3e3e42);
			flex-shrink: 0;
			flex-wrap: wrap;
			transition: background-color 0.2s ease;
		}

		.toolbar button {
			padding: 6px 12px;
			background: var(--vscode-button-background, #0e639c);
			color: var(--vscode-button-foreground, #ffffff);
			border: none;
			border-radius: 2px;
			cursor: pointer;
			font-size: 13px;
			font-weight: 500;
			transition: background-color 0.15s ease;
		}

		.toolbar button:hover {
			background: var(--vscode-button-hoverBackground, #1177bb);
		}

		.toolbar button:focus {
			outline: 1px solid var(--vscode-focusBorder, #007acc);
			outline-offset: 2px;
		}

		.toolbar button.run {
			background: var(--vscode-button-secondaryBackground, #16825d);
		}

		.toolbar button.run:hover {
			background: var(--vscode-button-secondaryHoverBackground, #1a9870);
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
			color: var(--vscode-foreground, #d4d4d4);
		}

		.toolbar input[type="text"],
		.toolbar select {
			background: var(--vscode-input-background, #3c3c3c);
			color: var(--vscode-input-foreground, #d4d4d4);
			border: 1px solid var(--vscode-input-border, #3e3e42);
			padding: 4px 8px;
			border-radius: 2px;
			font-size: 12px;
			transition: border-color 0.15s ease;
		}

		.toolbar input[type="text"]:focus,
		.toolbar select:focus {
			outline: none;
			border-color: var(--vscode-focusBorder, #007acc);
		}

		.toolbar input[type="text"] {
			min-width: 150px;
		}

		.settings-dropdown {
			position: relative;
		}

		.settings-button {
			background: var(--vscode-input-background, #3c3c3c) !important;
			padding: 6px 10px !important;
			transition: background-color 0.15s ease;
		}

		.settings-menu {
			display: none;
			position: absolute;
			top: 100%;
			right: 0;
			margin-top: 4px;
			background: var(--vscode-menu-background, #252526);
			border: 1px solid var(--vscode-menu-border, #3e3e42);
			border-radius: 4px;
			min-width: 250px;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
			z-index: 1000;
			padding: 8px 0;
			transition: background-color 0.2s ease;
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
			color: var(--vscode-foreground, #d4d4d4);
			transition: background-color 0.15s ease;
		}

		.settings-item:hover {
			background: var(--vscode-list-hoverBackground, #2a2d2e);
		}

		.settings-item label {
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.settings-item select {
			background: var(--vscode-dropdown-background, #3c3c3c);
			color: var(--vscode-dropdown-foreground, #d4d4d4);
			border: 1px solid var(--vscode-dropdown-border, #3e3e42);
			padding: 4px 8px;
			border-radius: 2px;
			font-size: 12px;
			transition: border-color 0.15s ease;
		}

		.settings-item select:focus {
			outline: none;
			border-color: var(--vscode-focusBorder, #007acc);
		}

		.settings-item input[type="checkbox"] {
			margin: 0;
		}

		.tabs-bar {
			display: flex;
			align-items: center;
			background: var(--vscode-editorGroupHeader-tabsBackground, #2d2d30);
			border-bottom: 1px solid var(--vscode-editorGroupHeader-tabsBorder, #3e3e42);
			flex-shrink: 0;
			transition: background-color 0.2s ease;
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
			background: var(--vscode-scrollbarSlider-background, #424242);
		}

		.tabs-container::-webkit-scrollbar-thumb:hover {
			background: var(--vscode-scrollbarSlider-hoverBackground, #4f4f4f);
		}

		.tab {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 8px 12px;
			background: var(--vscode-tab-inactiveBackground, #2d2d30);
			border-right: 1px solid var(--vscode-tab-border, #3e3e42);
			cursor: pointer;
			white-space: nowrap;
			font-size: 13px;
			color: var(--vscode-tab-inactiveForeground, #d4d4d4);
			transition: background-color 0.15s ease, color 0.15s ease;
		}

		.tab:hover {
			background: var(--vscode-tab-hoverBackground, #37373d);
			color: var(--vscode-tab-hoverForeground, #d4d4d4);
		}

		.tab.active {
			background: var(--vscode-tab-activeBackground, #1e1e1e);
			color: var(--vscode-tab-activeForeground, #ffffff);
			border-bottom: 2px solid var(--vscode-tab-activeBorder, #007acc);
		}

		.tab-close {
			background: none;
			border: none;
			color: var(--vscode-icon-foreground, #858585);
			cursor: pointer;
			padding: 0;
			font-size: 16px;
			line-height: 1;
			width: 16px;
			height: 16px;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: background-color 0.15s ease, color 0.15s ease;
		}

		.tab-close:hover {
			background: var(--vscode-toolbar-hoverBackground, #3e3e42);
			border-radius: 2px;
			color: var(--vscode-foreground, #d4d4d4);
		}

		.add-tab-btn {
			padding: 8px 12px;
			background: none;
			border: none;
			color: var(--vscode-icon-foreground, #858585);
			cursor: pointer;
			font-size: 18px;
			line-height: 1;
			transition: background-color 0.15s ease, color 0.15s ease;
		}

		.add-tab-btn:hover {
			background: var(--vscode-toolbar-hoverBackground, #37373d);
			color: var(--vscode-foreground, #d4d4d4);
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
			background: var(--vscode-panel-background, #1e1e1e);
			transition: background-color 0.2s ease;
		}

		.console-tabs {
			display: flex;
			background: var(--vscode-editorGroupHeader-tabsBackground, #2d2d30);
			border-bottom: 1px solid var(--vscode-panel-border, #3e3e42);
			transition: background-color 0.2s ease;
		}

		.console-tab {
			padding: 8px 16px;
			cursor: pointer;
			font-size: 13px;
			color: var(--vscode-panelTitle-inactiveForeground, #d4d4d4);
			border-bottom: 2px solid transparent;
			transition: background-color 0.15s ease, color 0.15s ease, border-bottom-color 0.15s ease;
		}

		.console-tab:hover {
			background: var(--vscode-list-hoverBackground, #37373d);
			color: var(--vscode-panelTitle-activeForeground, #ffffff);
		}

		.console-tab.active {
			color: var(--vscode-panelTitle-activeForeground, #ffffff);
			border-bottom-color: var(--vscode-panelTitle-activeBorder, #007acc);
		}

		.console-toolbar {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 6px 12px;
			background: var(--vscode-panel-background, #252526);
			border-bottom: 1px solid var(--vscode-panel-border, #3e3e42);
			transition: background-color 0.2s ease;
		}

		.console-toolbar button {
			padding: 4px 8px;
			background: var(--vscode-button-secondaryBackground, #3c3c3c);
			color: var(--vscode-button-secondaryForeground, #d4d4d4);
			border: none;
			border-radius: 2px;
			cursor: pointer;
			font-size: 12px;
			transition: background-color 0.15s ease;
		}

		.console-toolbar button:hover {
			background: var(--vscode-button-secondaryHoverBackground, #505050);
		}

		.console-content {
			flex: 1;
			overflow-y: auto;
			padding: 12px;
			font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace);
			font-size: var(--vscode-editor-font-size, 13px);
			line-height: 1.5;
			background: var(--vscode-terminal-background, #0e0e0e);
			color: var(--vscode-terminal-foreground, #d4d4d4);
			transition: background-color 0.2s ease, color 0.2s ease;
		}

		.console-content::-webkit-scrollbar {
			width: 10px;
		}

		.console-content::-webkit-scrollbar-thumb {
			background: var(--vscode-scrollbarSlider-background, #424242);
			border-radius: 5px;
		}

		.console-content::-webkit-scrollbar-thumb:hover {
			background: var(--vscode-scrollbarSlider-hoverBackground, #4f4f4f);
		}

		.console-input-container {
			display: none;
			padding: 12px;
			background: var(--vscode-terminal-background, #1a1a1a);
			border-top: 1px solid var(--vscode-panel-border, #3e3e42);
			transition: background-color 0.2s ease;
		}

		.console-input-container.active {
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.console-input-prompt {
			color: var(--vscode-terminal-ansiCyan, #4ec9b0);
			font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace);
			font-size: 13px;
			white-space: nowrap;
		}

		.console-input-field {
			flex: 1;
			background: var(--vscode-input-background, #2d2d30);
			border: 1px solid var(--vscode-input-border, #3e3e42);
			color: var(--vscode-input-foreground, #d4d4d4);
			padding: 6px 10px;
			font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace);
			font-size: 13px;
			outline: none;
			transition: border-color 0.15s ease;
		}

		.console-input-field:focus {
			border-color: var(--vscode-focusBorder, #007acc);
		}

		.console-input-submit {
			background: var(--vscode-button-background, #007acc);
			color: var(--vscode-button-foreground, #ffffff);
			border: none;
			padding: 6px 16px;
			cursor: pointer;
			font-size: 13px;
			border-radius: 2px;
			transition: background-color 0.15s ease;
		}

		.console-input-submit:hover {
			background: var(--vscode-button-hoverBackground, #005a9e);
		}

		.output-line {
			margin-bottom: 2px;
			white-space: pre-wrap;
			word-break: break-all;
		}

		.output-line.stdout {
			color: var(--vscode-terminal-foreground, #d4d4d4);
		}

		.output-line.stderr {
			color: var(--vscode-terminal-ansiRed, #f48771);
		}

		.output-line.system {
			color: var(--vscode-descriptionForeground, #858585);
			font-style: italic;
		}

		.output-line.success {
			color: var(--vscode-terminal-ansiGreen, #4ec9b0);
		}

		.output-line.error {
			color: var(--vscode-errorForeground, #f48771);
			font-weight: bold;
		}

		.gutter {
			background-color: var(--vscode-sideBar-background, #2d2d30);
			background-repeat: no-repeat;
			background-position: 50%;
			transition: background-color 0.2s ease;
		}

		.gutter.gutter-horizontal {
			cursor: col-resize;
			background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAeCAYAAADkftS9AAAAIklEQVQoU2M4c+bMfxAGAgYYmwGrIIiDjrELjpo5aiZeMwF+yNnOs5KSvgAAAABJRU5ErkJggg==');
		}

		.gutter.gutter-horizontal:hover {
			background-color: var(--vscode-focusBorder, #007acc);
		}
	</style>
</head>
<body>
	<div class="toolbar">
		<button class="run" id="runBtn" title="Run main.py (Ctrl+Enter)">▶ Run</button>
		<button id="formatBtn" title="Format code">Format</button>
		<button id="newFileBtn" title="New file">+ New File</button>
		<button id="openSingleFileBtn" title="Open a single file">📄 Open File</button>
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
			<div class="console-input-container" id="consoleInputContainer">
				<span class="console-input-prompt" id="consoleInputPrompt"></span>
				<input type="text" class="console-input-field" id="consoleInputField" placeholder="Enter input..." />
				<button class="console-input-submit" id="consoleInputSubmit">Submit</button>
			</div>
		</div>
	</div>

	<script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js"></script>
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

			// Layout is handled by CSS flexbox now

			// Lightweight LSP Client over WebSocket (no external dependencies)
			let lspWebSocket = null;
			let lspReady = false;
			let lspMessageId = 0;
			let lspPendingRequests = new Map();

			// Listen for messages from extension
			window.addEventListener('message', (event) => {
				const message = event.data;
				if (message.command === 'lspServerReady') {
					initializeLanguageClient(message.port);
				} else if (message.command === 'themeChanged') {
					// Update Monaco editor theme based on VS Code theme
					const monacoTheme = message.themeKind === 'light' ? 'vs' :
					                   message.themeKind === 'high-contrast' ? 'hc-black' : 'vs-dark';
					if (editor) {
						monaco.editor.setTheme(monacoTheme);
					}
				}
			});

			function initializeLanguageClient(wsPort) {
				try {
					console.log('Initializing LSP Client on port', wsPort);

					// Create WebSocket connection to python-lsp-server
					lspWebSocket = new WebSocket(\`ws://localhost:\${wsPort}\`);

					lspWebSocket.onopen = () => {
						console.log('WebSocket connected to python-lsp-server');

						// Send LSP initialize request
						sendLSPRequest('initialize', {
							processId: null,
							clientInfo: {
								name: 'PythonPad',
								version: '1.0.0'
							},
							rootUri: 'file:///pythonpad',
							capabilities: {
								textDocument: {
									completion: {
										completionItem: {
											snippetSupport: true
										}
									},
									hover: {
										contentFormat: ['markdown', 'plaintext']
									}
								}
							},
							workspaceFolders: [{
								uri: 'file:///pythonpad',
								name: 'PythonPad'
							}]
						}).then((initResult) => {
							console.log('LSP initialized:', initResult);
							// Send initialized notification
							sendLSPNotification('initialized', {});
							lspReady = true;

							// Register Monaco language features
							registerMonacoLanguageFeatures();
						}).catch((error) => {
							console.error('LSP initialization failed:', error);
						});
					};

					lspWebSocket.onmessage = (event) => {
						try {
							const message = JSON.parse(event.data);
							handleLSPMessage(message);
						} catch (error) {
							console.error('Failed to parse LSP message:', error);
						}
					};

					lspWebSocket.onerror = (error) => {
						console.error('WebSocket error:', error);
					};

					lspWebSocket.onclose = () => {
						console.log('WebSocket closed');
						lspReady = false;
					};

				} catch (error) {
					console.error('Failed to initialize language client:', error);
				}
			}

			function sendLSPRequest(method, params) {
				return new Promise((resolve, reject) => {
					const id = ++lspMessageId;
					const message = {
						jsonrpc: '2.0',
						id: id,
						method: method,
						params: params
					};

					lspPendingRequests.set(id, { resolve, reject });
					lspWebSocket.send(JSON.stringify(message));

					// Timeout after 5 seconds
					setTimeout(() => {
						if (lspPendingRequests.has(id)) {
							lspPendingRequests.delete(id);
							reject(new Error('LSP request timeout'));
						}
					}, 5000);
				});
			}

			function sendLSPNotification(method, params) {
				const message = {
					jsonrpc: '2.0',
					method: method,
					params: params
				};
				lspWebSocket.send(JSON.stringify(message));
			}

			function handleLSPMessage(message) {
				if (message.id !== undefined && lspPendingRequests.has(message.id)) {
					const { resolve, reject } = lspPendingRequests.get(message.id);
					lspPendingRequests.delete(message.id);

					if (message.error) {
						reject(new Error(message.error.message || 'LSP error'));
					} else {
						resolve(message.result);
					}
				}
			}

			function registerMonacoLanguageFeatures() {
				// Track open documents
				const openDocuments = new Map();

				// Helper to create document URI
				function getDocumentUri(filename) {
					return \`file:///pythonpad/\${filename}\`;
				}

				// Helper to notify LSP of document open
				function didOpenDocument(filename, content) {
					const uri = getDocumentUri(filename);
					if (!openDocuments.has(uri)) {
						sendLSPNotification('textDocument/didOpen', {
							textDocument: {
								uri: uri,
								languageId: 'python',
								version: 1,
								text: content
							}
						});
						openDocuments.set(uri, { version: 1, content });
						console.log('Opened document in LSP:', uri);
					}
				}

				// Helper to notify LSP of document changes
				function didChangeDocument(filename, content) {
					const uri = getDocumentUri(filename);
					const docInfo = openDocuments.get(uri);
					if (docInfo) {
						const newVersion = docInfo.version + 1;
						sendLSPNotification('textDocument/didChange', {
							textDocument: {
								uri: uri,
								version: newVersion
							},
							contentChanges: [{
								text: content
							}]
						});
						openDocuments.set(uri, { version: newVersion, content });
					} else {
						// Document not open yet, open it
						didOpenDocument(filename, content);
					}
				}

				// Open current file
				didOpenDocument(activeFile, editor.getValue());

				// Listen for content changes
				editor.onDidChangeModelContent(() => {
					didChangeDocument(activeFile, editor.getValue());
				});

				// Register completion provider
				monaco.languages.registerCompletionItemProvider('python', {
					provideCompletionItems: async (model, position) => {
						if (!lspReady) {
							return { suggestions: [] };
						}

						try {
							const uri = getDocumentUri(activeFile);
							const result = await sendLSPRequest('textDocument/completion', {
								textDocument: { uri },
								position: {
									line: position.lineNumber - 1,
									character: position.column - 1
								},
								context: {
									triggerKind: 1
								}
							});

							const items = result?.items || (Array.isArray(result) ? result : []);
							const suggestions = items.map(item => ({
								label: typeof item.label === 'string' ? item.label : item.label.label || item.label,
								kind: convertCompletionKind(item.kind),
								insertText: item.insertText || (typeof item.label === 'string' ? item.label : item.label.label),
								documentation: item.documentation,
								detail: item.detail,
								sortText: item.sortText,
								filterText: item.filterText
							}));

							return { suggestions };
						} catch (error) {
							console.error('Completion error:', error);
							return { suggestions: [] };
						}
					},
					triggerCharacters: ['.', ' ']
				});

				// Helper to convert LSP completion kind to Monaco kind
				function convertCompletionKind(kind) {
					const kindMap = {
						1: monaco.languages.CompletionItemKind.Text,
						2: monaco.languages.CompletionItemKind.Method,
						3: monaco.languages.CompletionItemKind.Function,
						4: monaco.languages.CompletionItemKind.Constructor,
						5: monaco.languages.CompletionItemKind.Field,
						6: monaco.languages.CompletionItemKind.Variable,
						7: monaco.languages.CompletionItemKind.Class,
						8: monaco.languages.CompletionItemKind.Interface,
						9: monaco.languages.CompletionItemKind.Module,
						10: monaco.languages.CompletionItemKind.Property,
						11: monaco.languages.CompletionItemKind.Unit,
						12: monaco.languages.CompletionItemKind.Value,
						13: monaco.languages.CompletionItemKind.Enum,
						14: monaco.languages.CompletionItemKind.Keyword,
						15: monaco.languages.CompletionItemKind.Snippet,
						16: monaco.languages.CompletionItemKind.Color,
						17: monaco.languages.CompletionItemKind.File,
						18: monaco.languages.CompletionItemKind.Reference,
						19: monaco.languages.CompletionItemKind.Folder,
						20: monaco.languages.CompletionItemKind.EnumMember,
						21: monaco.languages.CompletionItemKind.Constant,
						22: monaco.languages.CompletionItemKind.Struct,
						23: monaco.languages.CompletionItemKind.Event,
						24: monaco.languages.CompletionItemKind.Operator,
						25: monaco.languages.CompletionItemKind.TypeParameter
					};
					return kindMap[kind] || monaco.languages.CompletionItemKind.Text;
				}

				console.log('Monaco language features registered');
			}


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
					// Auto-create main.py
					createFile('main.py', 'print("Hello from PythonPad!")\\n');
					switchToFile('main.py');
					addConsoleOutput('Created main.py', 'system');
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
					fontSize: settings.fontSize
				});

				document.getElementById('intellisenseToggle').checked = settings.enableIntelliSense;
				document.getElementById('formatOnSaveToggle').checked = settings.formatOnSave;
				document.getElementById('formatterSelect').value = settings.formatter;
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
				vscode.postMessage({ command: 'promptNewFile' });
			});

			document.getElementById('openSingleFileBtn').addEventListener('click', () => {
				vscode.postMessage({ command: 'openSingleFile' });
			});

			document.getElementById('openFileBtn').addEventListener('click', () => {
				vscode.postMessage({ command: 'openFolder' });
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

			// Interactive Input Functions
			function showInputPrompt(prompt) {
				const container = document.getElementById('consoleInputContainer');
				const promptSpan = document.getElementById('consoleInputPrompt');
				const inputField = document.getElementById('consoleInputField');

				promptSpan.textContent = prompt;
				container.classList.add('active');
				inputField.value = '';
				inputField.focus();
			}

			function hideInputPrompt() {
				const container = document.getElementById('consoleInputContainer');
				container.classList.remove('active');
			}

			function submitInput() {
				const inputField = document.getElementById('consoleInputField');
				const userInput = inputField.value;

				// Echo input to console
				const promptSpan = document.getElementById('consoleInputPrompt');
				addConsoleOutput(\`\${promptSpan.textContent}\${userInput}\`, 'stdout');

				// Send input to extension
				vscode.postMessage({
					command: 'inputResponse',
					input: userInput
				});

				// Hide input field
				hideInputPrompt();
			}

			// Input field event listeners
			document.getElementById('consoleInputSubmit').addEventListener('click', submitInput);

			document.getElementById('consoleInputField').addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					submitInput();
				}
			});

			// Message Handler
			window.addEventListener('message', event => {
				const message = event.data;

				// Handle LSP responses
				if (message.type && message.type.startsWith('lsp.')) {
					if (message.type === 'lsp.completion.response' && lspCompletionCache.has(message.id)) {
						const callback = lspCompletionCache.get(message.id);
						callback(message.completions || []);
						lspCompletionCache.delete(message.id);
						return;
					}
				}

				switch (message.command) {
					case 'outputChunk':
						// Real-time output streaming
						addConsoleOutput(message.text, message.type);
						break;

					case 'waitingForInput':
						// Python is waiting for input
						showInputPrompt(message.prompt);
						break;

					case 'executionResult':
						setRunning(false);
						hideInputPrompt();
						// Note: output already streamed via outputChunk messages, so don't add it again
						if (message.exitCode === 0) {
							addConsoleOutput(\`Exited with code \${message.exitCode}\`, 'success');
						} else {
							addConsoleOutput(\`Exited with code \${message.exitCode}\`, 'error');
						}
						break;

					case 'executionError':
						setRunning(false);
						hideInputPrompt();
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

					case 'createNewFile':
						if (files.has(message.filename)) {
							addConsoleOutput(\`File \${message.filename} already exists!\`, 'error');
						} else {
							createFile(message.filename, '');
							switchToFile(message.filename);
							// Auto-save new file to workspace folder
							setTimeout(() => {
								saveCurrentFile();
							}, 100);
						}
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
								// Auto-reload from disk
								files.get(message.filename).model.setValue(message.content);
								addConsoleOutput(\`Reloaded \${message.filename} from disk\`, 'system');
							}
						}
						break;

					case 'fileCreatedOnDisk':
						if (!files.has(message.filename)) {
							// Auto-open new file
							createFile(message.filename, message.content);
							switchToFile(message.filename);
							addConsoleOutput(\`Opened new file \${message.filename}\`, 'system');
						}
						break;

					case 'fileDeletedOnDisk':
						if (files.has(message.filename)) {
							// Auto-close deleted file
							deleteFile(message.filename);
							addConsoleOutput(\`Closed deleted file \${message.filename}\`, 'system');
						}
						break;
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
					if (files.size > 1) {
						deleteFile(name);
					} else {
						addConsoleOutput('Cannot close the last file', 'error');
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
