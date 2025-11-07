from utils import greet, calculate_area
from data_processor import process_numbers

print("=== Multi-file Example ===")

# Test greeting
greet("Alice")

# Test area calculation
radius = 5
area = calculate_area(radius)
print(f"Circle with radius {radius} has area: {area:.2f}")

# Test data processing
numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
result = process_numbers(numbers)
print(f"\nProcessed data: {result}")
