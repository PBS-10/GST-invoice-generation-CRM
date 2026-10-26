import unittest

from transcribe import transcribe_whisper


class TranscribeGuardTest(unittest.TestCase):
    def test_refuses_to_download_weights(self):
        with self.assertRaises(SystemExit) as raised:
            transcribe_whisper(__import__("pathlib").Path("missing.wav"), "tiny", "en", allow_download=False)
        self.assertIn("allow-download", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
