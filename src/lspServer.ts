import { spawn, ChildProcess } from 'child_process';
import * as vscode from 'vscode';
import * as net from 'net';
import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

/**
 * Manages python-lsp-server process and WebSocket proxy
 * This eliminates the need for untitled documents and save prompts
 */
export class PythonLSPServer {
	private lspProcess: ChildProcess | undefined;
	private wsServer: WebSocketServer | undefined;
	private httpServer: http.Server | undefined;
	private lspPort: number = 0;
	private wsPort: number = 0;

	/**
	 * Start the language server and WebSocket proxy
	 * @returns WebSocket port number for webview connection
	 */
	async start(): Promise<number> {
		try {
			// Check if python-lsp-server is installed
			await this.checkInstallation();

			// Find free ports
			this.lspPort = await this.findFreePort();
			this.wsPort = await this.findFreePort();

			// Start python-lsp-server on TCP
			console.log(`Starting python-lsp-server on port ${this.lspPort}...`);
			this.lspProcess = spawn('pylsp', ['--tcp', '--port', String(this.lspPort)], {
				stdio: ['ignore', 'pipe', 'pipe']
			});

			// Log output for debugging
			this.lspProcess.stdout?.on('data', (data) => {
				console.log(`[pylsp] ${data.toString().trim()}`);
			});

			this.lspProcess.stderr?.on('data', (data) => {
				console.error(`[pylsp error] ${data.toString().trim()}`);
			});

			this.lspProcess.on('error', (error) => {
				console.error('Failed to start python-lsp-server:', error);
				throw new Error(`Failed to start python-lsp-server: ${error.message}`);
			});

			this.lspProcess.on('exit', (code) => {
				console.log(`python-lsp-server exited with code ${code}`);
			});

			// Wait for LSP server to be ready
			await this.waitForServer(this.lspPort, 5000);

			// Create WebSocket proxy
			await this.createWebSocketProxy();

			console.log(`Python LSP server ready - LSP port: ${this.lspPort}, WebSocket port: ${this.wsPort}`);
			return this.wsPort;

		} catch (error: any) {
			this.stop();
			throw error;
		}
	}

	/**
	 * Stop the language server and WebSocket proxy
	 */
	stop(): void {
		console.log('Stopping Python LSP server...');

		if (this.wsServer) {
			this.wsServer.close();
			this.wsServer = undefined;
		}

		if (this.httpServer) {
			this.httpServer.close();
			this.httpServer = undefined;
		}

		if (this.lspProcess) {
			this.lspProcess.kill();
			this.lspProcess = undefined;
		}
	}

	/**
	 * Check if python-lsp-server is installed
	 */
	private async checkInstallation(): Promise<void> {
		return new Promise((resolve, reject) => {
			const checkProcess = spawn('pylsp', ['--version'], { stdio: 'pipe' });

			let output = '';
			checkProcess.stdout?.on('data', (data) => {
				output += data.toString();
			});

			checkProcess.on('close', (code) => {
				if (code === 0) {
					console.log('python-lsp-server is installed:', output.trim());
					resolve();
				} else {
					reject(new Error(
						'python-lsp-server is not installed. Please install it with:\n' +
						'pip install "python-lsp-server[websockets]"'
					));
				}
			});

			checkProcess.on('error', (error) => {
				reject(new Error(
					'python-lsp-server is not installed. Please install it with:\n' +
					'pip install "python-lsp-server[websockets]"\n\n' +
					`Error: ${error.message}`
				));
			});
		});
	}

	/**
	 * Create WebSocket server that proxies to LSP server
	 * Handles LSP message framing (Content-Length headers)
	 */
	private async createWebSocketProxy(): Promise<void> {
		return new Promise((resolve, reject) => {
			// Create HTTP server for WebSocket
			this.httpServer = http.createServer();

			// Create WebSocket server
			this.wsServer = new WebSocketServer({ server: this.httpServer });

			this.wsServer.on('connection', (ws: WebSocket) => {
				console.log('WebSocket client connected');

				// Create TCP connection to python-lsp-server
				const socket = net.connect(this.lspPort, 'localhost');
				let buffer = Buffer.alloc(0);

				// Handle WebSocket messages from client (JSON) -> convert to LSP format for server
				ws.on('message', (data: Buffer) => {
					try {
						const message = data.toString('utf-8');
						// Convert JSON to LSP message format (with Content-Length header)
						const contentLength = Buffer.byteLength(message, 'utf-8');
						const lspMessage = `Content-Length: ${contentLength}\r\n\r\n${message}`;
						socket.write(lspMessage, 'utf-8');
					} catch (error) {
						console.error('Error formatting LSP message:', error);
					}
				});

				// Handle TCP socket data from server (LSP format) -> convert to JSON for client
				socket.on('data', (data: Buffer) => {
					buffer = Buffer.concat([buffer, data]);

					while (true) {
						// Look for Content-Length header
						const headerEnd = buffer.indexOf('\r\n\r\n');
						if (headerEnd === -1) break;

						// Parse Content-Length
						const headers = buffer.slice(0, headerEnd).toString('utf-8');
						const contentLengthMatch = headers.match(/Content-Length: (\d+)/i);
						if (!contentLengthMatch) break;

						const contentLength = parseInt(contentLengthMatch[1], 10);
						const messageStart = headerEnd + 4;
						const messageEnd = messageStart + contentLength;

						// Check if we have the complete message
						if (buffer.length < messageEnd) break;

						// Extract the JSON message
						const jsonMessage = buffer.slice(messageStart, messageEnd).toString('utf-8');

						// Send to WebSocket client
						if (ws.readyState === WebSocket.OPEN) {
							ws.send(jsonMessage);
						}

						// Remove processed message from buffer
						buffer = buffer.slice(messageEnd);
					}
				});

				// Handle disconnections
				ws.on('close', () => {
					console.log('WebSocket client disconnected');
					socket.end();
				});

				socket.on('close', () => {
					if (ws.readyState === WebSocket.OPEN) {
						ws.close();
					}
				});

				// Handle errors
				ws.on('error', (error) => {
					console.error('WebSocket error:', error);
					socket.end();
				});

				socket.on('error', (error) => {
					console.error('LSP socket error:', error);
					if (ws.readyState === WebSocket.OPEN) {
						ws.close();
					}
				});
			});

			// Start listening
			this.httpServer.listen(this.wsPort, 'localhost', () => {
				console.log(`WebSocket proxy listening on port ${this.wsPort}`);
				resolve();
			});

			this.httpServer.on('error', (error) => {
				reject(error);
			});
		});
	}

	/**
	 * Wait for LSP server to be ready by attempting to connect
	 */
	private async waitForServer(port: number, timeoutMs: number): Promise<void> {
		const startTime = Date.now();

		while (Date.now() - startTime < timeoutMs) {
			try {
				await this.tryConnect(port);
				console.log('LSP server is ready');
				return;
			} catch (error) {
				// Server not ready yet, wait and retry
				await new Promise(resolve => setTimeout(resolve, 100));
			}
		}

		throw new Error(`LSP server did not start within ${timeoutMs}ms`);
	}

	/**
	 * Try to connect to a port
	 */
	private tryConnect(port: number): Promise<void> {
		return new Promise((resolve, reject) => {
			const socket = net.connect(port, 'localhost');

			socket.on('connect', () => {
				socket.end();
				resolve();
			});

			socket.on('error', (error) => {
				reject(error);
			});

			// Timeout after 500ms
			setTimeout(() => {
				socket.destroy();
				reject(new Error('Connection timeout'));
			}, 500);
		});
	}

	/**
	 * Find a free port
	 */
	private async findFreePort(): Promise<number> {
		return new Promise((resolve, reject) => {
			const server = net.createServer();

			server.listen(0, 'localhost', () => {
				const address = server.address();
				if (address && typeof address !== 'string') {
					const port = address.port;
					server.close(() => resolve(port));
				} else {
					reject(new Error('Could not determine port'));
				}
			});

			server.on('error', reject);
		});
	}
}
