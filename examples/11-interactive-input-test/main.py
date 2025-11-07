"""
Interactive Input Test
Tests the new input() support in PythonPad!
"""

print("=" * 50)
print("INTERACTIVE INPUT TEST".center(50))
print("=" * 50)

# Test 1: Simple input
name = input("What is your name? ")
print(f"Hello, {name}!")

# Test 2: Numeric input
age = input("How old are you? ")
try:
    age_int = int(age)
    print(f"You are {age_int} years old.")
    print(f"In 10 years, you'll be {age_int + 10}!")
except ValueError:
    print("That's not a valid number, but that's okay!")

# Test 3: Multiple inputs
print("\n--- Tell me about yourself ---")
city = input("Which city do you live in? ")
hobby = input("What's your favorite hobby? ")

print(f"\nSo you're {name} from {city}, and you enjoy {hobby}!")

# Test 4: Yes/No question
answer = input("\nDo you like Python? (yes/no): ")
if answer.lower() in ['yes', 'y']:
    print("Great! Python is awesome!")
elif answer.lower() in ['no', 'n']:
    print("That's okay, everyone has preferences!")
else:
    print(f"'{answer}' is an interesting answer!")

print("\n" + "=" * 50)
print("TEST COMPLETE!".center(50))
print("=" * 50)
print("\nInteractive input() is working in PythonPad!")
