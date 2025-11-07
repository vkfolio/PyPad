# Python LSP Server Setup for PythonPad

PythonPad now uses a direct Language Server Protocol (LSP) integration that eliminates the "Do you want to save?" prompts and unwanted tabs!

## Requirements

To enable IntelliSense in PythonPad, you need to install `python-lsp-server`:

### Installation

```bash
pip install "python-lsp-server[websockets]"
```

### Verification

To verify the installation:

```bash
pylsp --version
```

You should see output like: `pylsp 1.x.x`

## How It Works

1. When you open PythonPad, the extension automatically starts a `python-lsp-server` process in the background
2. The webview connects to this server via WebSocket
3. Monaco editor communicates directly with the language server
4. **No VS Code documents are created** → No tabs, no save prompts!

## Troubleshooting

### Error: "python-lsp-server is not installed"

If you see this error:
1. Make sure Python and pip are in your PATH
2. Install the server: `pip install "python-lsp-server[websockets]"`
3. Reload VS Code

### IntelliSense not working

1. Check the Developer Console (Help → Toggle Developer Tools)
2. Look for errors related to "LSP" or "WebSocket"
3. Verify python-lsp-server is installed: `pylsp --version`
4. Try reloading the VS Code window

### Port conflicts

If you see "Failed to start Python LSP server" with port errors:
- The extension automatically finds free ports
- If issues persist, close other applications that might be using ports in the 8000-9000 range

## Disabling IntelliSense

If you don't want to install python-lsp-server, you can disable IntelliSense:

1. Go to Settings (Ctrl+,)
2. Search for "PythonPad: Enable IntelliSense"
3. Uncheck the option

When disabled, PythonPad will still work normally but without autocomplete.

## Features Provided by LSP

With python-lsp-server installed, you get:

- **Autocompletion** - Context-aware suggestions as you type
- **Hover information** - Documentation on hover (coming soon)
- **Signature help** - Function parameter hints (coming soon)
- **Real-time error checking** - Syntax and semantic errors
- **Import suggestions** - Smart import completions

## Technical Details

- **Backend**: python-lsp-server (community-maintained, MIT licensed)
- **Communication**: WebSocket over localhost
- **Architecture**: Monaco editor → WebSocket → python-lsp-server
- **No temporary files**: Everything runs in memory
- **No save prompts**: No VS Code documents are created

## Comparison with Previous Approach

| Feature | Old (Pylance + Untitled Docs) | New (python-lsp-server) |
|---------|-------------------------------|-------------------------|
| IntelliSense | ✅ Yes | ✅ Yes |
| Save prompts | ❌ Annoying prompts | ✅ No prompts |
| Unwanted tabs | ❌ Untitled-1 tabs | ✅ No tabs |
| Setup | None (built-in) | pip install required |
| Speed | Fast | Fast |
| Features | More (Pylance) | Good (python-lsp-server) |

## Alternative: Using Pyright

For better type checking, you can switch to Pyright (requires code changes):

```bash
npm install -g pyright
```

Then modify `src/lspServer.ts` to use `pyright-langserver` instead of `pylsp`.
