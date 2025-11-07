import sys

if len(sys.argv) > 1:
    try:
        num1 = float(sys.argv[1])
        num2 = float(sys.argv[2])
        print(f"Addition: {num1} + {num2} = {num1 + num2}")
        print(f"Subtraction: {num1} - {num2} = {num1 - num2}")
        print(f"Multiplication: {num1} * {num2} = {num1 * num2}")
        if num2 != 0:
            print(f"Division: {num1} / {num2} = {num1 / num2}")
    except ValueError:
        print("Error: Please provide valid numbers")
else:
    print("Usage: Provide two numbers as arguments")
    print("Example args: 10 5")
