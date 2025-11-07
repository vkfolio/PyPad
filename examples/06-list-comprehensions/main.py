# Generate squares
squares = [x**2 for x in range(1, 11)]
print("Squares:", squares)

# Filter even numbers
evens = [x for x in range(20) if x % 2 == 0]
print("Even numbers:", evens)

# Nested loops - multiplication table
print("\n=== Multiplication Table ===")
for i in range(1, 6):
    row = [f"{i}x{j}={i*j}" for j in range(1, 6)]
    print(" | ".join(row))

# Dictionary comprehension
word_lengths = {word: len(word) for word in ["Python", "Pad", "Monaco", "Editor"]}
print("\nWord lengths:", word_lengths)
