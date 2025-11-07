# Python Quiz Game

A quiz game that demonstrates game mechanics without requiring `input()`.

## How It Works

Since PythonPad doesn't support `input()` in the webview, this quiz runs in automated mode with pre-set answers.

## Running the Quiz

### Default Mode (Automated)
Just click **Run** - it will use pre-set answers to demonstrate the quiz.

### Custom Answers via Args
You can provide your own answers using command-line arguments:

1. In the **Args:** field, enter: `A,B,C,C,A,B,B,B,A,C`
2. Each letter is your answer to questions 1-10
3. Click **Run**

### Example Args
- Perfect score: `A,B,C,C,A,B,B,B,A,C`
- All wrong: `D,D,D,D,D,D,D,D,D,D`
- Mixed: `A,A,A,A,A,A,A,A,A,A`

## Questions Covered

1. Python data types
2. Function definition
3. Floor division operator
4. Data type validation
5. Built-in functions
6. Operators
7. String concatenation
8. List methods
9. Loop syntax
10. None keyword

## Features

- 10 multiple-choice questions
- Automatic scoring
- Grade calculation (A-F)
- Visual progress bar
- Detailed feedback

## Run Interactively (Outside PythonPad)

To run this with real input:
1. Save the file
2. Open a terminal
3. Modify the code to use `input()` instead of automated answers
4. Run: `python main.py`
