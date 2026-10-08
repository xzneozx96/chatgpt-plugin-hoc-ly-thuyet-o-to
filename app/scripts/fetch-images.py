#!/usr/bin/env python3
"""Fetch image assets referenced by the bundled question bank."""

import concurrent.futures
import json
import re
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BANK = json.loads((ROOT / "data" / "question-bank.json").read_text())
DEST = ROOT / "data" / "images"
BASE = "https://thidaugplx.com/images/questions-hd/"
PATHS = sorted({q["imagePath"] for q in BANK["questions"] if q["imagePath"]})


def fetch(path: str) -> tuple[str, str]:
    if not re.fullmatch(r"images/q\d+\.webp", path):
        return path, "invalid path"
    target = DEST / Path(path).name
    if target.exists() and target.read_bytes()[:4] == b"RIFF":
        return path, "cached"
    for attempt in range(3):
        try:
            with urllib.request.urlopen(BASE + target.name, timeout=20) as response:
                data = response.read()
                if response.status != 200 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
                    raise ValueError("response is not a WebP image")
            target.write_bytes(data)
            return path, "downloaded"
        except Exception as error:
            if attempt == 2:
                return path, str(error)
            time.sleep(attempt + 1)
    raise AssertionError("unreachable")


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(fetch, PATHS))
    counts = {state: sum(result == state for _, result in results) for state in {result for _, result in results}}
    print(f"Referenced: {len(PATHS)}; results: {counts}")
    failures = [(path, result) for path, result in results if result not in {"cached", "downloaded"}]
    for path, reason in failures:
        print(f"FAILED {path}: {reason}")
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
