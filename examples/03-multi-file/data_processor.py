def process_numbers(numbers):
    """Process a list of numbers and return statistics."""
    total = sum(numbers)
    average = total / len(numbers)
    maximum = max(numbers)
    minimum = min(numbers)

    return {
        'total': total,
        'average': average,
        'max': maximum,
        'min': minimum,
        'count': len(numbers)
    }

def filter_even(numbers):
    return [n for n in numbers if n % 2 == 0]
