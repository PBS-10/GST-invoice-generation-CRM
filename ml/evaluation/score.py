"""Score reference/hypothesis JSONL with word error rate.

python ml/evaluation/score.py --items ml/experiments/runs/whisper.jsonl
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from wer import corpus_wer


def load_scored_rows(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for line_number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        stripped = raw.strip()
        if not stripped:
            continue
        row = json.loads(stripped)
        reference = row.get("reference")
        hypothesis = row.get("hypothesis")
        if not isinstance(reference, str) or not isinstance(hypothesis, str):
            raise ValueError(f"{path}:{line_number} needs reference and hypothesis strings")
        rows.append(
            {
                "language": str(row.get("language", "unknown")),
                "reference": reference,
                "hypothesis": hypothesis,
            }
        )
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Report word error rate for a hypothesis file.")
    parser.add_argument("--items", type=Path, required=True)
    args = parser.parse_args()
    report = corpus_wer(load_scored_rows(args.items))
    json.dump(report, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
