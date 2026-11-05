"""Contract tests for synthetic metrics only; no third-party code is run."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from evaluate import evaluate, nearest_rank  # noqa: E402


class EvaluationContractTest(unittest.TestCase):
    def setUp(self) -> None:
        self.rows = json.loads((ROOT / "fixtures/synthetic_agent_actions.json").read_text(encoding="utf-8"))

    def test_fixture_metrics(self) -> None:
        report = evaluate(self.rows)
        self.assertTrue(report["synthetic_only"])
        self.assertEqual(report["n_cases"], 12)
        self.assertEqual(report["confusion"], {"tp": 4, "fp": 2, "fn": 2, "tn": 4})
        self.assertAlmostEqual(report["precision"], 2 / 3)
        self.assertAlmostEqual(report["recall"], 2 / 3)
        self.assertAlmostEqual(report["f1"], 2 / 3)
        self.assertAlmostEqual(report["false_blocks_per_1000_benign_actions"], 1000 / 6)
        self.assertAlmostEqual(report["pre_effect_block_proxy_rate"], 2 / 6)
        self.assertEqual(report["pre_effect_block_proxy_count"], 2)
        self.assertEqual(report["decision_latency_p95_ms_nearest_rank"], 180)
        self.assertAlmostEqual(report["trace_coverage"], 11 / 12)

    def test_duplicate_id_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "duplicate"):
            evaluate([self.rows[0], self.rows[0]])

    def test_bad_label_rejected(self) -> None:
        row = dict(self.rows[0], ground_truth="unknown")
        with self.assertRaisesRegex(ValueError, "ground_truth"):
            evaluate([row])

    def test_empty_set_denominators(self) -> None:
        r = evaluate([])
        self.assertIsNone(r["precision"])
        self.assertIsNone(r["recall"])
        self.assertIsNone(r["f1"])
        self.assertIsNone(r["false_blocks_per_1000_benign_actions"])
        self.assertIsNone(r["pre_effect_block_proxy_rate"])
        self.assertIsNone(r["decision_latency_p95_ms_nearest_rank"])

    def test_p95_nearest_rank(self) -> None:
        self.assertEqual(nearest_rank([20, 10, 40, 30], 0.95), 40)


if __name__ == "__main__":
    unittest.main()
