#!/usr/bin/env python3
"""Stream aligned Utusan Parquet rows as JSONL (requires pyarrow)."""
import json
import sys


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: python3 tools/parquet_to_jsonl.py FILE.parquet", file=sys.stderr)
        return 2
    try:
        import pyarrow.parquet as pq
    except ImportError:
        print("Parquet input requires pyarrow: python3 -m pip install --user pyarrow", file=sys.stderr)
        return 2

    parquet = pq.ParquetFile(sys.argv[1])
    available = set(parquet.schema_arrow.names)
    if not {"text", "latin_text"}.issubset(available):
        print("Parquet must contain text and latin_text columns", file=sys.stderr)
        return 2
    columns = [name for name in ("text", "latin_text", "split", "article_id") if name in available]
    for batch in parquet.iter_batches(columns=columns):
        for row in batch.to_pylist():
            print(json.dumps(row, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
