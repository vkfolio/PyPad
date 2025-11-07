"""
Interactive Calculator with Console Input
Demonstrates using input() function for user interaction.
"""

def display_menu():
    """Display the calculator menu."""
    print("\n" + "=" * 50)
    print("INTERACTIVE CALCULATOR".center(50))
    print("=" * 50)
    print("1. Addition")
    print("2. Subtraction")
    print("3. Multiplication")
    print("4. Division")
    print("5. Power")
    print("6. Square Root")
    print("7. Percentage")
    print("8. Exit")
    print("=" * 50)


def get_number(prompt):
    """Get a number from user with validation."""
    while True:
        try:
            value = float(input(prompt))
            return value
        except ValueError:
            print("[ERROR] Invalid number. Please try again.")


def addition():
    """Perform addition."""
    print("\n--- ADDITION ---")
    num1 = get_number("Enter first number: ")
    num2 = get_number("Enter second number: ")
    result = num1 + num2
    print(f"\nResult: {num1} + {num2} = {result}")


def subtraction():
    """Perform subtraction."""
    print("\n--- SUBTRACTION ---")
    num1 = get_number("Enter first number: ")
    num2 = get_number("Enter second number: ")
    result = num1 - num2
    print(f"\nResult: {num1} - {num2} = {result}")


def multiplication():
    """Perform multiplication."""
    print("\n--- MULTIPLICATION ---")
    num1 = get_number("Enter first number: ")
    num2 = get_number("Enter second number: ")
    result = num1 * num2
    print(f"\nResult: {num1} * {num2} = {result}")


def division():
    """Perform division."""
    print("\n--- DIVISION ---")
    num1 = get_number("Enter numerator: ")
    num2 = get_number("Enter denominator: ")

    if num2 == 0:
        print("\n[ERROR] Cannot divide by zero!")
    else:
        result = num1 / num2
        print(f"\nResult: {num1} / {num2} = {result}")


def power():
    """Calculate power."""
    print("\n--- POWER ---")
    base = get_number("Enter base: ")
    exponent = get_number("Enter exponent: ")
    result = base ** exponent
    print(f"\nResult: {base} ^ {exponent} = {result}")


def square_root():
    """Calculate square root."""
    print("\n--- SQUARE ROOT ---")
    num = get_number("Enter number: ")

    if num < 0:
        print("\n[ERROR] Cannot calculate square root of negative number!")
    else:
        result = num ** 0.5
        print(f"\nResult: sqrt({num}) = {result}")


def percentage():
    """Calculate percentage."""
    print("\n--- PERCENTAGE ---")
    number = get_number("Enter the number: ")
    percent = get_number("Enter the percentage: ")
    result = (number * percent) / 100
    print(f"\nResult: {percent}% of {number} = {result}")


def main():
    """Main function."""
    print("=" * 50)
    print("WELCOME TO INTERACTIVE CALCULATOR".center(50))
    print("=" * 50)
    print("\nNOTE: This example demonstrates console input.")
    print("However, PythonPad's webview doesn't support input().")
    print("This is a limitation of VS Code webviews.")
    print("\nTo test input(), run this file directly in a terminal:")
    print("  python main.py")

    # Simulated interaction for demo purposes
    print("\n" + "=" * 50)
    print("RUNNING AUTOMATED DEMO".center(50))
    print("=" * 50)

    print("\nDemo 1: Addition")
    print("Simulating: 15 + 27")
    print("Result: 15 + 27 = 42")

    print("\nDemo 2: Division")
    print("Simulating: 100 / 4")
    print("Result: 100 / 4 = 25.0")

    print("\nDemo 3: Power")
    print("Simulating: 2 ^ 8")
    print("Result: 2 ^ 8 = 256")

    print("\nDemo 4: Square Root")
    print("Simulating: sqrt(144)")
    print("Result: sqrt(144) = 12.0")

    print("\nDemo 5: Percentage")
    print("Simulating: 15% of 200")
    print("Result: 15% of 200 = 30.0")

    print("\n" + "=" * 50)
    print("DEMO COMPLETE".center(50))
    print("=" * 50)

    print("\nTo use this interactively, run it outside PythonPad:")
    print("1. Save this file to your computer")
    print("2. Open a terminal/command prompt")
    print("3. Run: python main.py")
    print("4. Follow the interactive prompts!")


# Uncomment this section to enable interactive mode when run in terminal
# if __name__ == "__main__":
#     while True:
#         display_menu()
#         choice = input("\nEnter your choice (1-8): ").strip()
#
#         if choice == "1":
#             addition()
#         elif choice == "2":
#             subtraction()
#         elif choice == "3":
#             multiplication()
#         elif choice == "4":
#             division()
#         elif choice == "5":
#             power()
#         elif choice == "6":
#             square_root()
#         elif choice == "7":
#             percentage()
#         elif choice == "8":
#             print("\nThank you for using the calculator!")
#             break
#         else:
#             print("\n[ERROR] Invalid choice. Please enter 1-8.")


if __name__ == "__main__":
    main()
