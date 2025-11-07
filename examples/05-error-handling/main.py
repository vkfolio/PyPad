def divide(a, b):
    try:
        result = a / b
        print(f"{a} / {b} = {result}")
        return result
    except ZeroDivisionError:
        print("[ERROR] Cannot divide by zero!")
        return None
    except TypeError:
        print("[ERROR] Invalid input types!")
        return None

print("=== Testing Error Handling ===")
divide(10, 2)
divide(10, 0)
divide(10, "invalid")

print("\n=== Testing Success Cases ===")
for i in range(5, 0, -1):
    divide(100, i)
