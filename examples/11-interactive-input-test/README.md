# Interactive Input Test

This example tests the NEW interactive `input()` support in PythonPad!

## How to Use

1. Open PythonPad: `Ctrl+Shift+P` → "PythonPad: Open Playground"
2. Click **📁 Open Folder**
3. Select this folder: `examples/11-interactive-input-test`
4. Click **▶ Run**
5. When prompted, enter your responses in the input field that appears at the bottom of the console
6. Press Enter or click "Submit" to send your input

## What This Tests

- Simple text input
- Numeric input with validation
- Multiple sequential inputs
- Conditional logic based on input
- Input prompts with different text

## Features Demonstrated

✅ `input()` function now works in PythonPad!
✅ Input field appears automatically when Python waits for input
✅ Real-time output streaming
✅ Multiple input() calls in sequence
✅ Input validation and error handling

## Previous Limitation

Before this update, `input()` would fail because PythonPad ran in a webview without stdin access.

Now it works by detecting when Python is waiting for input and showing an input field in the console!
