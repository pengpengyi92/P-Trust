# Synthetic Agent runtime evaluation contract (v0.1)

**Status:** public research-only measurement harness; **not** a runtime guard, malware
scanner, SkillWard benchmark, security guarantee, or real-world dataset.

This directory evaluates a deliberately small **fictional** set of twelve Agent
tool-action decisions. It does not run any untrusted code, Skill, MCP service,
container, network request, model, or vendor package.

## Reproduce

Python 3.10+; only the standard library is required.

```sh
python3 research/agent_runtime_eval/evaluate.py
python3 -m unittest discover -s research/agent_runtime_eval/tests -v
```

The generated JSON is labeled `"synthetic_only": true`. The five local unit
tests validate example arithmetic, empty denominator behavior and basic schema.
They are **not** detector quality/regression tests for SkillWard or P-Trust.

## Data contract

Each row must contain:

| Field | Meaning |
|---|---|
| `case_id` | Unique synthetic action identifier |
| `ground_truth` | Independently assigned `malicious` or `benign` label (fictional here) |
| `detector_flagged` | Whether the hypothetical detector raised an alert |
| `guard_action` | `allow`, `warn` or `block` |
| `gate_enforced` | Whether a block passed through an enforcement gate |
| `effect_observed` | Whether the fictional consequential action occurred |
| `guard_decision_ms` | Synthetic decision latency from action request |
| `effect_boundary_ms` | Synthetic latest time to block before effect |
| `trace_complete` | Whether the example contains a complete audit chain |

The evaluator computes **classification** precision, recall, F1 and confusion
counts separately from **policy** outcomes: false blocks per 1,000 benign
actions, a pre-effect block *proxy*, p95 decision latency (nearest rank) and
trace coverage. A correct detector can still warn without blocking or block
after an effect, and an incorrect detector can stop a benign action.

The pre-effect proxy counts labeled malicious actions that were blocked by a
gate before the *fictional* effect boundary and had no observed effect. This
does **not** establish real-world causality or prevented harm. Real deployment
requires trusted clock synchronization, tool-execution receipts, clear action
IDs, policies, independently verified effects and retained audit evidence.

## Synthetic smoke-test output (12 rows; no measured product performance)

| Metric | Illustrative result |
|---|---:|
| TP / FP / FN / TN | 4 / 2 / 2 / 4 |
| Precision / recall / F1 | 0.667 / 0.667 / 0.667 |
| False blocks per 1,000 benign actions | 166.667 |
| Pre-effect block proxy | 2 / 6 = 0.333 |
| Decision latency p95 (nearest rank) | 180 ms |
| Trace completeness | 11 / 12 = 0.917 |

**Do not use these numbers to rate SkillWard or P-Trust.** The ratios are
manufactured for verifying formulas and edge cases, not sampled from real
activities. Small denominators make the per-1,000 result intentionally noisy.

## Future *independent* research

1. Write a threat model and annotation guide; independently label a held-out
   corpus before comparing vendors.
2. Pin source code and container digests, document external model versions,
   rule packs, permission boundaries and dataset selection.
3. Split scanning, sandbox observation and production interception into
   separate evaluations; log all undecidable/unavailable cases.
4. Run any dynamic test only with separate approval and a hardened isolated
   environment, fictional credentials and explicit egress restrictions.
5. Never submit employer/customer information, private code or real secrets.

See [fixed-SHA SkillWard source audit](../../docs/reports/2026-11-06_skillward_pinned_source_audit.md).
