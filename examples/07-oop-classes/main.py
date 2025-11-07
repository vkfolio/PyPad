from person import Person
from calculator import Calculator

print("=== Object-Oriented Example ===\n")

# Test Person class
person1 = Person("Alice", 30)
person2 = Person("Bob", 25)

person1.introduce()
person2.introduce()

# Test Calculator class
calc = Calculator()
print(f"\n5 + 3 = {calc.add(5, 3)}")
print(f"10 - 4 = {calc.subtract(10, 4)}")
print(f"6 * 7 = {calc.multiply(6, 7)}")
print(f"20 / 4 = {calc.divide(20, 4)}")
print(f"2 ^ 8 = {calc.power(2, 8)}")
