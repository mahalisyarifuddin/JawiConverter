#!/usr/bin/env bash
# Download the official Utusan Jawi sentence splits into a local directory.
#
# The corpus is external, copyrighted, and intentionally Git-ignored. It is
# never bundled, and evaluation must not invent or substitute data when the
# host is unreachable (see docs/EVALUATION.md).
#
# Usage:
#   tools/fetch_corpus.sh [DEST_DIR]        # default: corpus
#
# Override the host for a mirror or an offline copy:
#   UTUSAN_BASE_URL=https://mirror.example/dataset tools/fetch_corpus.sh corpus
set -euo pipefail

BASE="${UTUSAN_BASE_URL:-https://huggingface.co/datasets/mahalisyarifuddin/utusan-jawi-sentences/resolve/main}"
DEST="${1:-corpus}"

mkdir -p "$DEST"
for split in train validation test; do
  target="$DEST/$split.parquet"
  url="$BASE/$split.parquet"
  echo "fetching $url"
  # Download to a temporary name so an interrupted run never leaves a
  # truncated file that looks like a valid split.
  curl -fL --retry 3 --retry-delay 2 --connect-timeout 20 -o "$target.part" "$url"
  mv "$target.part" "$target"
done

echo "downloaded train/validation/test into $DEST"
echo "verify with: node tests/evaluate_corpus.js --corpus $DEST --split train --direction jl --limit 1"
