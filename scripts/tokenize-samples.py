#!/usr/bin/env python3
"""
Extract unique tokens from sample log files for auditing.

This script strips ANSI escape codes and extracts all contiguous
word character sequences as tokens.
"""

import re
import json
from pathlib import Path
from collections import Counter

# Regex to strip ANSI escape codes
ANSI_ESCAPE = re.compile(r'\x1b\[[0-9;]*m')


def strip_ansi(text: str) -> str:
    """Remove ANSI escape codes from text."""
    return ANSI_ESCAPE.sub('', text)


def extract_tokens(filepath: Path) -> Counter:
    """Extract all word tokens from a file."""
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    # Strip ANSI codes for analysis
    clean_content = strip_ansi(content)

    # Extract all contiguous word characters
    tokens = re.findall(r'\w+', clean_content)

    return Counter(tokens)


def main():
    script_dir = Path(__file__).parent
    samples_dir = script_dir.parent / "samples"

    if not samples_dir.exists():
        print(f"Error: samples directory not found at {samples_dir}")
        return 1

    # Only process B.txt
    filepath = samples_dir / "B.txt"
    if not filepath.exists():
        print(f"Error: {filepath} not found")
        return 1

    print(f"Extracting tokens from {filepath.name}...\n")

    counter = extract_tokens(filepath)

    # Sort by count descending, then alphabetically
    sorted_items = sorted(counter.items(), key=lambda x: (-x[1], x[0]))

    print(f"Found {len(counter)} unique tokens\n")

    for token, count in sorted_items:
        print(f"{count:4d}x  {token}")

    # Also write JSON for easier processing
    output_file = samples_dir / "tokens-audit.json"
    output = [{"token": token, "count": count} for token, count in sorted_items]
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)
    print(f"\nFull token list written to {output_file}")

    return 0


if __name__ == "__main__":
    exit(main())
