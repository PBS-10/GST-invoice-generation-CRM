import unittest

from wer import corpus_wer, normalize, wer


class WerTest(unittest.TestCase):
    def test_perfect_match_is_zero(self):
        self.assertEqual(wer("two kilo rice", "two kilo rice"), 0.0)

    def test_one_substitution_in_four_words(self):
        self.assertEqual(wer("two kilo rice rupees", "two kilo ari rupees"), 0.25)

    def test_ignores_case_and_punctuation(self):
        self.assertEqual(wer("Two kilo, rice!", "two kilo rice"), 0.0)

    def test_malayalam_words_are_tokens(self):
        self.assertEqual(wer("രണ്ട് കിലോ അരി", "രണ്ട് കിലോ അരി"), 0.0)

    def test_insertion_counts(self):
        self.assertEqual(wer("rice", "two rice"), 1.0)

    def test_empty_reference_with_hypothesis_is_total_error(self):
        self.assertEqual(wer("", "rice"), 1.0)

    def test_corpus_reports_overall_and_per_language(self):
        report = corpus_wer(
            [
                {"language": "en", "reference": "two kilo rice", "hypothesis": "two kilo rice"},
                {"language": "en", "reference": "one packet sugar", "hypothesis": "one packet rice"},
                {"language": "ml", "reference": "രണ്ട് കിലോ അരി", "hypothesis": "രണ്ട് കിലോ അരി"},
            ]
        )
        self.assertEqual(report["languages"]["ml"]["wer"], 0.0)
        self.assertAlmostEqual(report["languages"]["en"]["wer"], 1 / 6)
        self.assertEqual(report["words"], 9)
        self.assertEqual(report["errors"], 1)

    def test_normalize_collapses_whitespace(self):
        self.assertEqual(normalize("  Two   kilo "), "two kilo")


if __name__ == "__main__":
    unittest.main()
