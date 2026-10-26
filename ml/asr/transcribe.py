"""Transcribe a local manifest with Whisper or IndicConformer.

Does not download weights unless --allow-download is passed.
Does not write a guess when the audio file is missing.
The phone app does not import this module.

From the repo root:

  python ml/asr/transcribe.py --backend whisper --model tiny ^
    --manifest ml/datasets/manifest.example.jsonl ^
    --out ml/experiments/runs/whisper.jsonl --allow-download
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from manifest import load_manifest


def transcribe_file(backend: str, model_name: str, audio_path: Path, language: str, allow_download: bool) -> str:
    if backend == "whisper":
        return transcribe_whisper(audio_path, model_name, language, allow_download)
    if backend == "indicconformer":
        return transcribe_indicconformer(audio_path, language, allow_download)
    raise SystemExit(f"Unknown backend: {backend}")


def transcribe_whisper(audio_path: Path, model_name: str, language: str, allow_download: bool) -> str:
    if not allow_download:
        raise SystemExit(
            "Refusing to fetch Whisper weights. Re-run with --allow-download when you want that checkpoint cached locally."
        )
    try:
        import whisper
    except ImportError as error:
        raise SystemExit("Install the asr extra: pip install -r ml/requirements-asr.txt") from error
    model = whisper.load_model(model_name)
    result = model.transcribe(str(audio_path), language=None if language == "unknown" else language)
    return str(result["text"]).strip()


def transcribe_indicconformer(audio_path: Path, language: str, allow_download: bool) -> str:
    if not allow_download:
        raise SystemExit(
            "Refusing to fetch IndicConformer weights. Re-run with --allow-download when you want that checkpoint cached locally."
        )
    try:
        import torch
        import torchaudio
        from transformers import AutoModel
    except ImportError as error:
        raise SystemExit("Install the asr extra: pip install -r ml/requirements-asr.txt") from error
    model = AutoModel.from_pretrained(
        "ai4bharat/indic-conformer-600m-multilingual",
        trust_remote_code=True,
    )
    waveform, sample_rate = torchaudio.load(str(audio_path))
    if sample_rate != 16000:
        waveform = torchaudio.transforms.Resample(sample_rate, 16000)(waveform)
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    text = model(waveform, language, "rnnt")
    return str(text).strip()


def write_hypotheses(backend: str, model_name: str, manifest_path: Path, out_path: Path, allow_download: bool) -> int:
    ready, missing = load_manifest(manifest_path)
    for item_id in missing:
        print(f"skip {item_id}: audio file not found", file=sys.stderr)
    if not ready:
        raise SystemExit("No audio files found. Put a small slice under ml/datasets/raw/ and point the manifest at it.")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as handle:
        for item in ready:
            hypothesis = transcribe_file(
                backend,
                model_name,
                Path(str(item["audio_path"])),
                str(item["language"]),
                allow_download,
            )
            handle.write(
                json.dumps(
                    {
                        "id": item["id"],
                        "language": item["language"],
                        "reference": item["transcript"],
                        "hypothesis": hypothesis,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
    return len(ready)


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcribe a local eval slice.")
    parser.add_argument("--backend", choices=("whisper", "indicconformer"), required=True)
    parser.add_argument("--model", default="tiny", help="Whisper checkpoint name. Ignored by IndicConformer.")
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument(
        "--allow-download",
        action="store_true",
        help="Permit the backend to cache its pretrained weights. Off by default.",
    )
    args = parser.parse_args()
    count = write_hypotheses(args.backend, args.model, args.manifest, args.out, args.allow_download)
    print(f"wrote {count} hypotheses to {args.out}")


if __name__ == "__main__":
    main()
