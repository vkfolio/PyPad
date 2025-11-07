import math

def greet(name):
    print(f"Hello, {name}! Welcome to PythonPad.")

def calculate_area(radius):
    return math.pi * radius ** 2

def format_output(text, width=50):
    return text.center(width, '-')
