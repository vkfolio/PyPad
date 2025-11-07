class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def introduce(self):
        print(f"Hi! I'm {self.name} and I'm {self.age} years old.")

    def birthday(self):
        self.age += 1
        print(f"Happy birthday {self.name}! You're now {self.age}!")
