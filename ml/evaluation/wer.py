"""Word error rate for speech evaluation. No model and no audio."""

from __future__ import annotations

import unicodedata


def normalize(text: str) -> str:
    folded = unicodedata.normalize("NFC", text).casefold()
    kept: list[str] = []
    for char in folded:
        if char.isspace():
            kept.append(" ")
        elif unicodedata.category(char).startswith(("L", "M", "N")):
            kept.append(char)
    return " ".join("".join(kept).split())


def tokenize(text: str) -> list[str]:
    normalized = normalize(text)
    if not normalized:
        return []
    return normalized.split(" ")


def edit_distance(reference: list[str], hypothesis: list[str]) -> int:
    rows = len(reference) + 1
    cols = len(hypothesis) + 1
    previous = list(range(cols))
    for i in range(1, rows):
        current = [i]
        for j in range(1, cols):
            substitute = previous[j - 1] + (reference[i - 1] != hypothesis[j - 1])
            current.append(min(previous[j] + 1, current[j - 1] + 1, substitute))
        previous = current
    return previous[-1]


def wer(reference: str, hypothesis: str) -> float:
    ref = tokenize(reference)
    hyp = tokenize(hypothesis)
    if not ref:
        return 0.0 if not hyp else 1.0
    return edit_distance(ref, hyp) / len(ref)


def corpus_wer(items: list[dict[str, str]]) -> dict[str, object]:
    totals: dict[str, list[int]] = {}
    words = 0
    errors = 0
    for item in items:
        ref = tokenize(item["reference"])
        hyp = tokenize(item["hypothesis"])
        if not ref and not hyp:
            item_words = 0
            item_errors = 0
        elif not ref:
            item_words = 1
            item_errors = 1
        else:
            item_words = len(ref)
            item_errors = edit_distance(ref, hyp)
        language = item.get("language", "unknown")
        bucket = totals.setdefault(language, [0, 0])
        bucket[0] += item_words
        bucket[1] += item_errors
        words += item_words
        errors += item_errors

    languages = {
        language: {
            "words": counts[0],
            "errors": counts[1],
            "wer": (counts[1] / counts[0]) if counts[0] else 0.0,
        }
        for language, counts in sorted(totals.items())
    }
    return {
        "words": words,
        "errors": errors,
        "wer": (errors / words) if words else 0.0,
        "languages": languages,
    }
