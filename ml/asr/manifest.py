"""Load an eval manifest. Audio stays on disk; this module never downloads it."""

from __future__ import annotations

import json
from pathlib import Path


def load_manifest(path: Path) -> tuple[list[dict[str, object]], list[str]]:
    ready: list[dict[str, object]] = []
    missing: list[str] = []
    for line_number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        stripped = raw.strip()
        if not stripped:
            continue
        row = json.loads(stripped)
        audio_field = row.get("audio")
        if not isinstance(audio_field, str) or not audio_field:
            raise ValueError(f"{path}:{line_number} needs an audio path")
        audio_path = Path(audio_field)
        if not audio_path.is_absolute():
            audio_path = path.parent / audio_path
        item_id = str(row.get("id", line_number))
        if not audio_path.is_file():
            missing.append(item_id)
            continue
        ready.append(
            {
                "id": item_id,
                "language": str(row.get("language", "unknown")),
                "transcript": str(row.get("transcript", "")),
                "audio_path": audio_path.resolve(),
            }
        )
    return ready, missing
