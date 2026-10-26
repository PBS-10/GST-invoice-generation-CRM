import json
import tempfile
import unittest
from pathlib import Path

from manifest import load_manifest


class ManifestTest(unittest.TestCase):
    def test_marks_missing_audio_and_keeps_rows_that_exist(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            wav = root / "en-001.wav"
            wav.write_bytes(b"RIFF")
            manifest = root / "manifest.jsonl"
            rows = [
                {"id": "en-001", "language": "en", "audio": "en-001.wav", "transcript": "two kilo rice"},
                {"id": "ml-001", "language": "ml", "audio": "missing.wav", "transcript": "രണ്ട് കിലോ അരി"},
            ]
            manifest.write_text("\n".join(json.dumps(row) for row in rows), encoding="utf-8")
            ready, missing = load_manifest(manifest)
            self.assertEqual([item["id"] for item in ready], ["en-001"])
            self.assertEqual(ready[0]["audio_path"], wav.resolve())
            self.assertEqual(missing, ["ml-001"])


if __name__ == "__main__":
    unittest.main()
