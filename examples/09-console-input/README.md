# Console Input Example

## Important Note

**PythonPad does not support `input()` function** because it runs in a VS Code webview environment which doesn't have access to stdin.

This is a known limitation of webview-based extensions in VS Code.

## What This Example Shows

This example demonstrates:
1. How to use Python's `input()` function
2. Input validation with try/except
3. Interactive menu systems
4. How to handle user input properly

## How to Use This Example

### In PythonPad (Demo Mode)
The example runs in demo mode, showing simulated output without requiring input.

### To Run Interactively
1. **Save the file** to your computer
2. **Open a terminal/command prompt**
3. **Navigate to the file location**
4. **Run**: `python main.py`
5. **Follow the prompts** to use the calculator interactively

### Enable Interactive Mode
Uncomment the interactive code section at the bottom of `main.py` (lines starting with `# if __name__ == "__main__"`).

## Alternative: Use Command-Line Arguments

For PythonPad, use command-line arguments instead of `input()`:

```python
import sys

if len(sys.argv) > 1:
    num1 = float(sys.argv[1])
    num2 = float(sys.argv[2])
    print(f"Sum: {num1 + num2}")
```

Then in PythonPad, use the **Args:** field: `10 20`

## Future Enhancement

A future version of PythonPad could add an input field in the UI to support interactive input.
