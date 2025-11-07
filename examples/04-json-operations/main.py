import json

# Create sample data
data = {
    "name": "PythonPad",
    "version": "1.0",
    "features": [
        "Multi-file support",
        "Monaco Editor",
        "Real-time output",
        "Command-line args"
    ],
    "settings": {
        "theme": "dark",
        "fontSize": 14
    }
}

# Convert to JSON string
json_string = json.dumps(data, indent=2)
print("JSON Data:")
print(json_string)

# Parse it back
parsed = json.loads(json_string)
print("\n=== Parsed Features ===")
for feature in parsed['features']:
    print(f"  ✓ {feature}")
