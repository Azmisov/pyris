#!/usr/bin/env python3
"""
Anonymize sample log files by replacing identifying keywords.

This script does byte-level string replacement to preserve ANSI escape codes.
"""

from pathlib import Path

# Mapping of original identifiers to anonymized versions
# Order matters - longer/more specific patterns should come first
# Specify as list of tuple (b"original", b"replacement")
REPLACEMENTS = [
    # --- INSERT REPLACEMENTS HERE ---
]

# Only process these files
TARGET_FILES = ["B.txt"]


def anonymize_file(filepath: Path) -> bool:
    """
    Anonymize a single file by replacing identifying keywords.

    Returns True if the file was modified, False otherwise.
    """
    with open(filepath, "rb") as f:
        content = f.read()

    original_content = content

    for old, new in REPLACEMENTS:
        content = content.replace(old, new)

    if content != original_content:
        with open(filepath, "wb") as f:
            f.write(content)
        return True

    return False


def main():
    # Get the samples directory relative to this script
    script_dir = Path(__file__).parent
    samples_dir = script_dir.parent / "samples"

    if not samples_dir.exists():
        print(f"Error: samples directory not found at {samples_dir}")
        return 1

    # Only process target files
    txt_files = [samples_dir / f for f in TARGET_FILES if (samples_dir / f).exists()]

    if not txt_files:
        print(f"No target files found in {samples_dir}")
        return 0

    print(f"Processing {len(txt_files)} file(s)")

    modified_count = 0
    for filepath in sorted(txt_files):
        was_modified = anonymize_file(filepath)
        status = "modified" if was_modified else "unchanged"
        print(f"  {filepath.name}: {status}")
        if was_modified:
            modified_count += 1

    print(f"\nDone. Modified {modified_count} file(s).")
    return 0


if __name__ == "__main__":
    exit(main())
