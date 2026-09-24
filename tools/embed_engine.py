#!/usr/bin/env python3
"""Embed jawi_converter.js into JawiConverter.html and verify it stays in sync."""
from __future__ import annotations

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE_PATH = ROOT / "jawi_converter.js"
HTML_PATH = ROOT / "JawiConverter.html"
BEGIN = "<!-- BEGIN INLINE JAWI CONVERTER ENGINE -->"
END = "<!-- END INLINE JAWI CONVERTER ENGINE -->"


def expected_block(engine: str) -> str:
    if "</script" in engine.lower():
        raise ValueError("The engine contains a closing </script sequence and cannot be safely inlined.")
    # Keep the JavaScript bytes unchanged between the tags so the Node build and
    # the offline browser app always execute the same implementation.
    return f"{BEGIN}\n<script>\n{engine}</script>\n{END}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if the embedded engine is stale")
    args = parser.parse_args()

    engine = ENGINE_PATH.read_text(encoding="utf-8")
    html = HTML_PATH.read_text(encoding="utf-8")
    expected = expected_block(engine)
    start = html.find(BEGIN)
    end = html.find(END, start + len(BEGIN)) if start >= 0 else -1

    if start < 0 or end < 0:
        parser.error(f"Missing engine markers in {HTML_PATH}")
    end += len(END)
    actual = html[start:end]

    if args.check:
        if actual != expected:
            print("Embedded converter is out of date. Run: python tools/embed_engine.py")
            return 1
        print("Embedded converter matches jawi_converter.js; the HTML has no runtime JS dependency.")
        return 0

    HTML_PATH.write_text(html[:start] + expected + html[end:], encoding="utf-8")
    print(f"Embedded {ENGINE_PATH.name} into {HTML_PATH.name} ({len(engine):,} characters).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
