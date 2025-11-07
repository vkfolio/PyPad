import * as vscode from 'vscode';
import * as path from 'path';

/**
 * LSP Bridge: Connects Monaco editor in webview to Python language server (Pylance)
 * Provides full IntelliSense capabilities including completions, hover, diagnostics, etc.
 */

export class PythonLSPBridge {
	private panel: vscode.WebviewPanel;
	private documentUri: vscode.Uri | undefined;
	private textDocument: vscode.TextDocument | undefined;
	private disposables: vscode.Disposable[] = [];

	constructor(panel: vscode.WebviewPanel) {
		this.panel = panel;
	}

	/**
	 * Initialize LSP bridge for a file
	 */
	async initialize(filePath: string, content: string): Promise<void> {
		// Create or open the document
		this.documentUri = vscode.Uri.file(filePath);

		try {
			// Try to open existing document
			this.textDocument = await vscode.workspace.openTextDocument(this.documentUri);
		} catch {
			// Create new document if it doesn't exist
			this.textDocument = await vscode.workspace.openTextDocument({
				language: 'python',
				content: content
			});
		}

		// Set up message handler for LSP requests from webview
		this.setupMessageHandler();
	}

	/**
	 * Update document content
	 */
	async updateContent(content: string): Promise<void> {
		if (!this.documentUri) {
			return;
		}

		try {
			// Write directly to the file to avoid edit conflicts
			await vscode.workspace.fs.writeFile(
				this.documentUri,
				Buffer.from(content, 'utf8')
			);

			// Re-open the document to refresh it
			this.textDocument = await vscode.workspace.openTextDocument(this.documentUri);
		} catch (error) {
			// Silently ignore errors - they're just sync issues
			console.warn('LSP content update warning:', error);
		}
	}

	/**
	 * Set up message handler for LSP requests from webview
	 */
	private setupMessageHandler(): void {
		const handler = async (message: any) => {
			if (!message.type || !message.type.startsWith('lsp.')) {
				return;
			}

			switch (message.type) {
				case 'lsp.completion':
					await this.handleCompletion(message);
					break;
				case 'lsp.hover':
					await this.handleHover(message);
					break;
				case 'lsp.signatureHelp':
					await this.handleSignatureHelp(message);
					break;
				case 'lsp.definition':
					await this.handleDefinition(message);
					break;
				case 'lsp.updateContent':
					await this.updateContent(message.content);
					break;
			}
		};

		this.panel.webview.onDidReceiveMessage(handler, null, this.disposables);
	}

	/**
	 * Handle completion request
	 */
	private async handleCompletion(message: any): Promise<void> {
		if (!this.textDocument) {
			return;
		}

		const position = new vscode.Position(message.line, message.character);

		try {
			// Get completions from Python language server (Pylance)
			const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
				'vscode.executeCompletionItemProvider',
				this.documentUri,
				position
			);

			if (completions) {
				// Convert VSCode completion items to Monaco format
				const monacoCompletions = completions.items.map(item => ({
					label: typeof item.label === 'string' ? item.label : item.label.label,
					kind: this.convertCompletionKind(item.kind),
					insertText: item.insertText || (typeof item.label === 'string' ? item.label : item.label.label),
					documentation: item.documentation ? (typeof item.documentation === 'string' ? item.documentation : item.documentation.value) : undefined,
					detail: item.detail,
					sortText: item.sortText,
					filterText: item.filterText
				}));

				// Send back to webview
				this.panel.webview.postMessage({
					type: 'lsp.completion.response',
					id: message.id,
					completions: monacoCompletions
				});
			}
		} catch (error: any) {
			console.error('LSP completion error:', error);
			this.panel.webview.postMessage({
				type: 'lsp.completion.response',
				id: message.id,
				completions: []
			});
		}
	}

	/**
	 * Handle hover request
	 */
	private async handleHover(message: any): Promise<void> {
		if (!this.textDocument) {
			return;
		}

		const position = new vscode.Position(message.line, message.character);

		try {
			const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
				'vscode.executeHoverProvider',
				this.documentUri,
				position
			);

			if (hovers && hovers.length > 0) {
				const hover = hovers[0];
				const contents = hover.contents.map(content => {
					if (typeof content === 'string') {
						return content;
					} else {
						return content.value;
					}
				});

				this.panel.webview.postMessage({
					type: 'lsp.hover.response',
					id: message.id,
					contents: contents
				});
			}
		} catch (error: any) {
			console.error('LSP hover error:', error);
		}
	}

	/**
	 * Handle signature help request
	 */
	private async handleSignatureHelp(message: any): Promise<void> {
		if (!this.textDocument) {
			return;
		}

		const position = new vscode.Position(message.line, message.character);

		try {
			const signatureHelp = await vscode.commands.executeCommand<vscode.SignatureHelp>(
				'vscode.executeSignatureHelpProvider',
				this.documentUri,
				position
			);

			if (signatureHelp) {
				this.panel.webview.postMessage({
					type: 'lsp.signatureHelp.response',
					id: message.id,
					signatures: signatureHelp.signatures.map(sig => ({
						label: sig.label,
						documentation: sig.documentation,
						parameters: sig.parameters?.map(param => ({
							label: param.label,
							documentation: param.documentation
						}))
					})),
					activeSignature: signatureHelp.activeSignature,
					activeParameter: signatureHelp.activeParameter
				});
			}
		} catch (error: any) {
			console.error('LSP signature help error:', error);
		}
	}

	/**
	 * Handle definition request
	 */
	private async handleDefinition(message: any): Promise<void> {
		if (!this.textDocument) {
			return;
		}

		const position = new vscode.Position(message.line, message.character);

		try {
			const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
				'vscode.executeDefinitionProvider',
				this.documentUri,
				position
			);

			if (definitions && definitions.length > 0) {
				this.panel.webview.postMessage({
					type: 'lsp.definition.response',
					id: message.id,
					definitions: definitions.map(def => ({
						uri: def.uri.toString(),
						range: {
							startLine: def.range.start.line,
							startCharacter: def.range.start.character,
							endLine: def.range.end.line,
							endCharacter: def.range.end.character
						}
					}))
				});
			}
		} catch (error: any) {
			console.error('LSP definition error:', error);
		}
	}

	/**
	 * Convert VSCode completion kind to Monaco completion kind
	 */
	private convertCompletionKind(kind: vscode.CompletionItemKind | undefined): number {
		// Monaco CompletionItemKind enum values
		const MonacoCompletionItemKind: any = {
			Method: 0,
			Function: 1,
			Constructor: 2,
			Field: 3,
			Variable: 4,
			Class: 5,
			Struct: 6,
			Interface: 7,
			Module: 8,
			Property: 9,
			Event: 10,
			Operator: 11,
			Unit: 12,
			Value: 13,
			Constant: 14,
			Enum: 15,
			EnumMember: 16,
			Keyword: 17,
			Text: 18,
			Color: 19,
			File: 20,
			Reference: 21,
			Customcolor: 22,
			Folder: 23,
			TypeParameter: 24,
			User: 25,
			Issue: 26,
			Snippet: 27
		};

		// Map VSCode kind to Monaco kind
		switch (kind) {
			case vscode.CompletionItemKind.Method: return MonacoCompletionItemKind.Method;
			case vscode.CompletionItemKind.Function: return MonacoCompletionItemKind.Function;
			case vscode.CompletionItemKind.Constructor: return MonacoCompletionItemKind.Constructor;
			case vscode.CompletionItemKind.Field: return MonacoCompletionItemKind.Field;
			case vscode.CompletionItemKind.Variable: return MonacoCompletionItemKind.Variable;
			case vscode.CompletionItemKind.Class: return MonacoCompletionItemKind.Class;
			case vscode.CompletionItemKind.Interface: return MonacoCompletionItemKind.Interface;
			case vscode.CompletionItemKind.Module: return MonacoCompletionItemKind.Module;
			case vscode.CompletionItemKind.Property: return MonacoCompletionItemKind.Property;
			case vscode.CompletionItemKind.Unit: return MonacoCompletionItemKind.Unit;
			case vscode.CompletionItemKind.Value: return MonacoCompletionItemKind.Value;
			case vscode.CompletionItemKind.Enum: return MonacoCompletionItemKind.Enum;
			case vscode.CompletionItemKind.Keyword: return MonacoCompletionItemKind.Keyword;
			case vscode.CompletionItemKind.Snippet: return MonacoCompletionItemKind.Snippet;
			case vscode.CompletionItemKind.Color: return MonacoCompletionItemKind.Color;
			case vscode.CompletionItemKind.File: return MonacoCompletionItemKind.File;
			case vscode.CompletionItemKind.Reference: return MonacoCompletionItemKind.Reference;
			case vscode.CompletionItemKind.Folder: return MonacoCompletionItemKind.Folder;
			case vscode.CompletionItemKind.EnumMember: return MonacoCompletionItemKind.EnumMember;
			case vscode.CompletionItemKind.Constant: return MonacoCompletionItemKind.Constant;
			case vscode.CompletionItemKind.Struct: return MonacoCompletionItemKind.Struct;
			case vscode.CompletionItemKind.Event: return MonacoCompletionItemKind.Event;
			case vscode.CompletionItemKind.Operator: return MonacoCompletionItemKind.Operator;
			case vscode.CompletionItemKind.TypeParameter: return MonacoCompletionItemKind.TypeParameter;
			default: return MonacoCompletionItemKind.Text;
		}
	}

	/**
	 * Clean up resources
	 */
	dispose(): void {
		this.disposables.forEach(d => d.dispose());
		this.disposables = [];
	}
}
