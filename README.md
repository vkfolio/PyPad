# PythonPad

A DartPad-style Python playground for VS Code with multi-file support, command-line arguments, Python environment selection, file persistence, and more!

## ✨ Features

### Core Features
- ✅ **Monaco Editor** with Python syntax highlighting
- ✅ **Multi-file support** with tab management
- ✅ **Always runs main.py** - Other files support imports
- ✅ **Command-line arguments** - Pass args to your Python scripts
- ✅ **Python environment selector** - Choose your Python interpreter
- ✅ **Resizable split panel** - Drag to adjust editor/console sizes
- ✅ **File persistence** - Save files to your chosen workspace folder
- ✅ **File watching** - Sync with external file changes
- ✅ **Open existing files** - Load .py files from disk
- ✅ **IntelliSense toggle** - Enable/disable autocomplete
- ✅ **Auto-format** - Format code with Black or autopep8
- ✅ **Real-time console** output with color-coded messages
- ✅ **Multiple file types** - .py, .txt, .json, .csv, .md support
- ✅ **DartPad-like layout** - Professional split-pane interface

## 🚀 How to Test

### Method 1: Press F5 (Recommended for Development)

1. **Open the extension folder in VS Code**:
   ```bash
   cd pythonpad
   code .
   ```

2. **Press F5** (or Run > Start Debugging)
   - A new "Extension Development Host" window will open
   - Your extension is loaded in this test window

3. **Open PythonPad**:
   - Press `Ctrl+Shift+P` (Command Palette)
   - Type "PythonPad: Open Playground"
   - Press Enter

4. **Start coding!**
   - Write Python code in the editor
   - Click "Run" or press `Ctrl+Enter` to execute
   - See output in the console panel

5. **Debug**:
   - Set breakpoints in `src/extension.ts`
   - View logs in Debug Console (main window)
   - For webview debugging: `Ctrl+Shift+P` → "Developer: Toggle Developer Tools"

6. **Reload after changes**:
   - Make code changes
   - Press `Ctrl+R` in the Extension Development Host window
   - Changes will be reflected immediately

### Method 2: Install as VSIX Package

1. **Package the extension**:
   ```bash
   npm install -g @vscode/vsce
   vsce package
   ```

2. **Install the .vsix file**:
   - In VS Code: Extensions panel (`Ctrl+Shift+X`)
   - Click "..." menu → "Install from VSIX..."
   - Select `pythonpad-0.0.1.vsix`

3. **Restart VS Code**

4. **Open PythonPad**:
   - Press `Ctrl+Shift+P`
   - Type "PythonPad: Open Playground"

## 📋 Requirements

- **Python 3.x** installed and available in PATH
- **Optional**: Install formatters for auto-formatting
  - Black: `pip install black`
  - autopep8: `pip install autopep8`

## 📖 Usage Guide

### Setting Up Workspace

**Two ways to set up your workspace:**

**Option 1: Open Existing Folder (Recommended)**
1. Click "📁 Open Folder" button
2. Select a folder containing Python files (or an empty folder)
3. PythonPad will:
   - Load all `.py`, `.txt`, `.json`, `.csv`, `.md` files as tabs
   - Auto-create `main.py` if it doesn't exist
   - Set this as your workspace folder
   - Enable file watching for external changes

**Option 2: Manual Workspace Setup**
1. Click 💾 Save button or press `Ctrl+S`
2. Select a folder to store your PythonPad files
3. Or use command: "PythonPad: Set Workspace Folder"

**After setup:**
- All new files created with "+ New File" are auto-saved to this folder
- Ctrl+S saves the current file
- External file changes sync automatically

### Creating Files

1. Click "+ New File" button in the toolbar
2. Enter filename (e.g., `utils.py`, `config.json`)
3. File is created with appropriate syntax highlighting
4. **File is automatically saved to the workspace folder**

### Running Code

1. **Always runs main.py** - Create a `main.py` file if it doesn't exist
2. Click "▶ Run" button or press `Ctrl+Enter`
3. View output in the console panel
4. Other files are available for imports

### Using Command-Line Arguments

1. Enter arguments in the "Args:" field in toolbar
2. Example: `--name "John Doe" --count 5`
3. Access in Python:
   ```python
   import sys
   print(sys.argv)  # ['main.py', '--name', 'John Doe', '--count', '5']

   # Or use argparse
   import argparse
   parser = argparse.ArgumentParser()
   parser.add_argument('--name')
   parser.add_argument('--count', type=int)
   args = parser.parse_args()
   print(f"Name: {args.name}, Count: {args.count}")
   ```

### Importing Local Modules

```python
# main.py
from utils import helper_function
from models.data import DataProcessor

result = helper_function()
print(result)
```

```python
# utils.py
def helper_function():
    return "Hello from utils!"
```

```python
# models/data.py
class DataProcessor:
    def process(self):
        return "Processing data..."
```

All files are written to a temporary directory with proper PYTHONPATH set for execution.

### Selecting Python Environment

1. Click the "Python:" dropdown in toolbar
2. Select from available Python interpreters
3. Your choice is saved in settings
4. Or manually set in settings: `pythonpad.pythonPath`

### Opening Existing Folder

1. Click "📁 Open Folder" button in toolbar
2. Select a folder (can be empty or contain existing Python files)
3. PythonPad will:
   - Load all compatible files (`.py`, `.txt`, `.json`, `.csv`, `.md`) as tabs
   - Auto-create `main.py` if not present
   - Set as workspace folder
   - Start watching for file changes

### Formatting Code

1. Click "Format" button in toolbar
2. Code will be formatted using the selected formatter (Black/autopep8)
3. Configure formatter in Settings dropdown
4. Formatter must be installed: `pip install black` or `pip install autopep8`

### Settings

Click the "⚙ Settings" button to access:

- **Enable IntelliSense**: Toggle autocomplete on/off
- **Auto-format on save**: Automatically format code when saving
- **Formatter**: Choose between Black, autopep8, or None
- **Theme**: Switch between Dark and Light themes

Settings are persisted in VS Code configuration.

### Resizable Layout

- **Drag the divider** between editor and console to resize
- Minimum size: 200px for each panel
- Layout persists during session

## ⌨️ Keyboard Shortcuts

- **Ctrl+Enter**: Run main.py
- **Ctrl+S**: Save current file to workspace folder
- **Ctrl+Space**: Trigger IntelliSense (if enabled)
- **Alt+Shift+F**: Format document
- **Ctrl+/**: Toggle line comment
- **Ctrl+F**: Find
- **Ctrl+H**: Replace

## ⚙️ Configuration

Extension settings can be configured in VS Code settings (`Ctrl+,`):

```json
{
  "pythonpad.formatter": "black",
  "pythonpad.formatOnSave": false,
  "pythonpad.enableIntelliSense": true,
  "pythonpad.lineLength": 88,
  "pythonpad.theme": "dark",
  "pythonpad.fontSize": 14,
  "pythonpad.workspaceFolder": "/path/to/your/pythonpad/files",
  "pythonpad.pythonPath": "python3"
}
```

### Settings Reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `pythonpad.formatter` | `"black"` \| `"autopep8"` \| `"none"` | `"black"` | Python code formatter to use |
| `pythonpad.formatOnSave` | `boolean` | `false` | Automatically format code on save |
| `pythonpad.enableIntelliSense` | `boolean` | `true` | Enable IntelliSense (autocomplete) |
| `pythonpad.lineLength` | `number` | `88` | Maximum line length for formatters |
| `pythonpad.theme` | `"dark"` \| `"light"` | `"dark"` | Editor theme |
| `pythonpad.fontSize` | `number` | `14` | Editor font size |
| `pythonpad.workspaceFolder` | `string` | `""` | Folder where PythonPad files are stored |
| `pythonpad.pythonPath` | `string` | `"python3"` | Path to Python interpreter |

## 🏗️ Architecture

- **Extension Host** (Node.js): Handles Python execution, formatting, file I/O, settings
- **Webview** (Browser): Monaco Editor, UI, console display
- **Communication**: postMessage API between extension and webview
- **Monaco Editor**: Loaded from CDN (https://cdn.jsdelivr.net)
- **Split.js**: Resizable split panels (https://split.js.org)

## 📁 Features in Detail

### Multi-File Management

- Create unlimited files with tabs
- Switch between files by clicking tabs
- Close files with × button
- Cursor position and scroll state preserved per file
- Supports multiple file types: .py, .js, .json, .txt, .csv, .md, .html, .css

### Console Output

- Real-time stdout/stderr streaming
- Color-coded output:
  - **White**: Standard output
  - **Red**: Error output
  - **Green**: Success messages
  - **Gray**: System messages
- Clear console button
- Auto-scroll to bottom

### Python Execution

- All files written to temporary directory
- Entry point is always `main.py`
- PYTHONPATH set to temp directory (enables local imports)
- Command-line arguments passed securely
- Timeout: 30 seconds
- Cleanup: Temp directory automatically deleted after execution

### File Persistence

- Save files to user-selected workspace folder
- File watching: External changes sync to editor
- Conflict resolution: Prompts on external changes
- Ctrl+S saves current file
- Files persist between sessions

### Python Environment Selection

- Auto-discovers available Python interpreters
- Dropdown to select interpreter
- Choice persisted in settings
- Fallback to python3/python if none found

### Command-Line Arguments

- Input field in toolbar
- Secure parsing with `string-argv`
- Handles quotes and spaces correctly
- Validates against dangerous characters
- Arguments persist during webview session

### Resizable Split Panel

- Drag divider to resize editor/console
- Uses Split.js library
- Minimum 200px for each panel
- Monaco layout recalculates on resize

## 🔧 Troubleshooting

### Python not found

Make sure Python is installed and available in PATH:
```bash
python3 --version
```

If using a specific Python interpreter, select it from the Python dropdown or configure in settings:
```json
{
  "pythonpad.pythonPath": "/path/to/python"
}
```

### Formatter not found

Install the formatter:
```bash
pip install black
# or
pip install autopep8
```

### Monaco Editor not loading

Check your internet connection. Monaco Editor is loaded from CDN.

### Files not saving

1. Make sure workspace folder is set: "PythonPad: Set Workspace Folder" command
2. Check folder permissions
3. Look for error notifications

### main.py not found

Click Run button - it will prompt you to create main.py automatically.

### Command-line arguments not working

1. Make sure to enter args in the "Args:" field before running
2. Access in Python via `sys.argv`
3. Check console for argument parsing errors

### Extension not showing in Command Palette

1. Check that the extension compiled successfully: `npm run compile`
2. Reload the Extension Development Host: `Ctrl+R`
3. Check Debug Console for errors

## 🎯 Example Workflows

### Workflow 1: Data Processing Script

```python
# main.py
import sys
from utils import load_data, process_data

if __name__ == "__main__":
    filename = sys.argv[1] if len(sys.argv) > 1 else "data.csv"
    data = load_data(filename)
    result = process_data(data)
    print(f"Processed {len(result)} records")
```

**Run with args:** `data.csv`

### Workflow 2: Multi-Module Project

```
main.py          # Entry point
utils.py         # Helper functions
models/data.py   # Data models
config.json      # Configuration
```

**Main.py always runs**, other files imported as needed.

### Workflow 3: Quick Script Testing

1. Write quick Python code in main.py
2. Press Ctrl+Enter to run
3. See output immediately
4. Iterate and test rapidly

## 🛠️ Development

### Project Structure

```
pythonpad/
├── src/
│   └── extension.ts       # Main extension code (1394 lines)
├── out/                   # Compiled JavaScript
├── package.json           # Extension manifest with settings
├── tsconfig.json          # TypeScript config
└── README.md              # This file
```

### Build Commands

- `npm run compile`: Compile TypeScript
- `npm run watch`: Watch mode for development
- `npm run lint`: Run ESLint
- `vsce package`: Create VSIX package

### Dependencies

- **Runtime**:
  - `string-argv`: Secure command-line argument parsing

- **Development**:
  - `@vscode/python-extension`: Python extension API types
  - TypeScript, ESLint, VS Code test frameworks

## 🆕 What's New in This Version

### New Features
✨ **Command-line arguments** - Pass args to Python scripts
✨ **Python environment selector** - Choose your interpreter
✨ **File persistence** - Save to workspace folder with Ctrl+S
✨ **Open existing files** - Load files from disk
✨ **File watching** - Sync with external changes
✨ **Resizable split panel** - Drag to resize
✨ **Always run main.py** - Consistent entry point

### Improvements
🚀 Better state management - Session persists
🚀 Split.js integration - Smooth resizable panels
🚀 Enhanced error messages - More helpful feedback
🚀 Security validation - Args checked for safety

## 📝 Commands

- **PythonPad: Open Playground** - Open the PythonPad interface
- **PythonPad: Set Workspace Folder** - Choose folder for file storage

## 🤝 Contributing

This is a learning project for VS Code extension development. Feel free to fork and experiment!

## 📄 License

MIT

## 🙏 Acknowledgments

- Built with [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- Resizable panels powered by [Split.js](https://split.js.org/)
- Inspired by [DartPad](https://dartpad.dev/)

## 🔮 Future Enhancements

- [ ] Stdin input support for `input()` function
- [ ] Package installation (pip install in virtual env)
- [ ] Code templates/snippets library
- [ ] Export/share functionality
- [ ] Matplotlib plot output display
- [ ] Syntax error highlighting (LSP integration)
- [ ] Workspace persistence (save/load projects)
- [ ] Multiple Python version support
- [ ] Debugging support with breakpoints
- [ ] Collaborative editing
- [ ] Code execution history
- [ ] Performance profiling

---

**Enjoy coding with PythonPad! 🐍✨**
