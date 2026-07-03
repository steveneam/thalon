"""B0.4 DeepEval scaffold - keyless, deterministic.

Proves the DeepEval harness runs without any API key by exercising a custom
deterministic metric (denylist screening - the G1 shape) against the golden
seed. Model-graded metrics join at B1.3 (judge) via the gateway.

Run:  python -m venv .venv && .venv\\Scripts\\pip install -r requirements.txt
      .venv\\Scripts\\python -m pytest
"""

import json
import pathlib

from deepeval.metrics import BaseMetric
from deepeval.test_case import LLMTestCase

GOLDEN = pathlib.Path(__file__).resolve().parents[1] / "golden" / "seed.jsonl"


def load_golden():
    rows = [json.loads(line) for line in GOLDEN.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert rows, "golden seed is empty"
    return rows


def test_golden_seed_rows_are_well_formed():
    for row in load_golden():
        assert set(row) >= {"kind", "input", "expected", "origin"}, row
        assert row["origin"] == "golden"


class DenylistMetric(BaseMetric):
    """Deterministic pure-function metric: fails when any denylist term appears.

    This is the G1 gate's shape (SPINE section 1: deterministic fallbacks are
    never delegated to a model); the real implementation lands in
    proprietary/judge at B1.3 and will be evaluated with this same metric.
    """

    def __init__(self, denylist, threshold: float = 1.0):
        self.denylist = denylist
        self.threshold = threshold

    def measure(self, test_case: LLMTestCase) -> float:
        text = (test_case.actual_output or "").lower()
        hits = [term for term in self.denylist if term.lower() in text]
        self.score = 0.0 if hits else 1.0
        self.reason = f"denylist hits: {hits or 'none'}"
        self.success = self.score >= self.threshold
        return self.score

    async def a_measure(self, test_case: LLMTestCase) -> float:
        return self.measure(test_case)

    def is_successful(self) -> bool:
        return self.success

    @property
    def __name__(self):
        return "Denylist (deterministic)"


def test_denylist_metric_matches_golden_verdicts():
    cases = [row for row in load_golden() if row["kind"] == "judge_g1_denylist"]
    assert cases, "golden seed must include g1 denylist cases"
    for row in cases:
        metric = DenylistMetric(denylist=row["input"]["denylist"])
        metric.measure(LLMTestCase(input="g1", actual_output=row["input"]["body"]))
        expected_pass = row["expected"]["verdict"] == "pass"
        assert metric.is_successful() == expected_pass, row["sourceRef"]
