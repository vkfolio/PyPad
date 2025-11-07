"""
Quiz Game - Automated Version
A quiz game that works in PythonPad without requiring input().
Uses automated answers to demonstrate the game mechanics.
"""

import sys


class Question:
    """Represents a quiz question."""

    def __init__(self, question, options, correct_answer):
        self.question = question
        self.options = options
        self.correct_answer = correct_answer

    def check_answer(self, answer):
        """Check if the answer is correct."""
        return answer.upper() == self.correct_answer.upper()


class QuizGame:
    """Manages the quiz game."""

    def __init__(self):
        self.questions = []
        self.score = 0
        self.total_questions = 0

    def add_question(self, question):
        """Add a question to the quiz."""
        self.questions.append(question)

    def display_question(self, question_num, question):
        """Display a question with options."""
        print(f"\nQuestion {question_num}:")
        print(f"{question.question}")
        print()
        for key, value in question.options.items():
            print(f"  {key}. {value}")

    def run_automated(self, automated_answers):
        """Run the quiz with automated answers."""
        print("=" * 60)
        print("PYTHON QUIZ GAME".center(60))
        print("=" * 60)

        self.total_questions = len(self.questions)

        for i, question in enumerate(self.questions, 1):
            self.display_question(i, question)

            # Get automated answer
            user_answer = automated_answers[i - 1] if i - 1 < len(automated_answers) else "A"
            print(f"\n[Automated Answer]: {user_answer}")

            # Check answer
            if question.check_answer(user_answer):
                print("[CORRECT!] Well done!")
                self.score += 1
            else:
                print(f"[INCORRECT] The correct answer was: {question.correct_answer}")
                correct_text = question.options[question.correct_answer.upper()]
                print(f"  {question.correct_answer}. {correct_text}")

        self.display_results()

    def display_results(self):
        """Display final quiz results."""
        print("\n" + "=" * 60)
        print("QUIZ RESULTS".center(60))
        print("=" * 60)

        percentage = (self.score / self.total_questions) * 100

        print(f"\nYou answered {self.score} out of {self.total_questions} questions correctly!")
        print(f"Your score: {percentage:.1f}%")

        # Grade
        if percentage >= 90:
            grade = "A - Excellent!"
        elif percentage >= 80:
            grade = "B - Very Good!"
        elif percentage >= 70:
            grade = "C - Good!"
        elif percentage >= 60:
            grade = "D - Fair"
        else:
            grade = "F - Need More Practice"

        print(f"Grade: {grade}")

        # Visual bar
        bar_length = int(percentage / 2)
        bar = "█" * bar_length
        print(f"\n[{bar:50s}] {percentage:.1f}%")

        print("=" * 60)


def create_python_quiz():
    """Create a Python programming quiz."""
    quiz = QuizGame()

    # Question 1
    q1 = Question(
        "What is the output of: print(type([]))?",
        {
            "A": "<class 'list'>",
            "B": "<class 'dict'>",
            "C": "<class 'tuple'>",
            "D": "<class 'set'>"
        },
        "A"
    )
    quiz.add_question(q1)

    # Question 2
    q2 = Question(
        "Which keyword is used to create a function in Python?",
        {
            "A": "function",
            "B": "def",
            "C": "func",
            "D": "define"
        },
        "B"
    )
    quiz.add_question(q2)

    # Question 3
    q3 = Question(
        "What is the result of: 10 // 3?",
        {
            "A": "3.33",
            "B": "3.0",
            "C": "3",
            "D": "4"
        },
        "C"
    )
    quiz.add_question(q3)

    # Question 4
    q4 = Question(
        "Which of these is NOT a valid Python data type?",
        {
            "A": "int",
            "B": "float",
            "C": "boolean",
            "D": "str"
        },
        "C"
    )
    quiz.add_question(q4)

    # Question 5
    q5 = Question(
        "What does the 'len()' function do?",
        {
            "A": "Returns the length of an object",
            "B": "Returns the type of an object",
            "C": "Converts to lowercase",
            "D": "Removes whitespace"
        },
        "A"
    )
    quiz.add_question(q5)

    # Question 6
    q6 = Question(
        "Which operator is used for exponentiation in Python?",
        {
            "A": "^",
            "B": "**",
            "C": "exp",
            "D": "pow"
        },
        "B"
    )
    quiz.add_question(q6)

    # Question 7
    q7 = Question(
        "What is the output of: print('Hello' + 'World')?",
        {
            "A": "Hello World",
            "B": "HelloWorld",
            "C": "Error",
            "D": "Hello+World"
        },
        "B"
    )
    quiz.add_question(q7)

    # Question 8
    q8 = Question(
        "Which method is used to add an element to the end of a list?",
        {
            "A": "add()",
            "B": "append()",
            "C": "insert()",
            "D": "push()"
        },
        "B"
    )
    quiz.add_question(q8)

    # Question 9
    q9 = Question(
        "What is the correct way to start a for loop in Python?",
        {
            "A": "for i in range(10):",
            "B": "for (i = 0; i < 10; i++)",
            "C": "for i < 10:",
            "D": "loop i in range(10):"
        },
        "A"
    )
    quiz.add_question(q9)

    # Question 10
    q10 = Question(
        "What does 'None' represent in Python?",
        {
            "A": "An empty string",
            "B": "Zero",
            "C": "The absence of a value",
            "D": "False"
        },
        "C"
    )
    quiz.add_question(q10)

    return quiz


def main():
    """Main function."""
    print("\nWelcome to the Python Quiz Game!")
    print("\nNOTE: Since PythonPad doesn't support input(), this runs in automated mode.")
    print("The quiz will use pre-set answers to demonstrate the game mechanics.")

    # Create quiz
    quiz = create_python_quiz()

    # Check if answers provided via command-line
    if len(sys.argv) > 1:
        # Parse answers from arguments
        answers = sys.argv[1].upper().split(',')
        print(f"\nUsing answers from Args: {', '.join(answers)}")
    else:
        # Use automated answers (mix of correct and incorrect)
        answers = ['A', 'B', 'C', 'C', 'A', 'B', 'B', 'B', 'A', 'C']
        print("\nUsing automated answers for demonstration...")

    # Run quiz
    quiz.run_automated(answers)

    print("\n" + "=" * 60)
    print("HOW TO CUSTOMIZE".center(60))
    print("=" * 60)
    print("\nTo provide your own answers via command-line:")
    print("Use Args field: A,B,C,C,A,B,B,B,A,C")
    print("\nEach letter represents your answer to questions 1-10.")
    print("=" * 60)


if __name__ == "__main__":
    main()
