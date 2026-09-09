# Benchmark Card: v0.1

## Baseline

No existing analyzer implementation. Seven fixed harmless synthetic fixtures represent expected patterns and review signals, not production accuracy. Keyword-only matching is the conceptual comparator; a quantitative paired baseline comparison is UNMEASURED.

## Change

Lezer syntax-tree call detection for Python/JS/TS, explicit documentation/configuration channels, seven deterministic analyzers and a strict model-output boundary.

## Measure

Protocol: `npm test`; `npm run benchmark` executes each fixture ten times sequentially, without network. Windows / Node 24.18.0 on 2026-09-09. Raw measurements are generated at `output/benchmark.json` (not an input to scores).

## Result

Initial regression run: **33 tests passed**. Seven fixture scores: safe-agent 100, over-permissioned-agent 3, unsafe-filesystem-agent 3, weak-ci-project 0, good-engineering-project 100, retry-loop-agent 3, well-observed-agent 47. Mean analysis time per fixture: **0.060–1.254 ms** in this initial local run (ten runs each). These tiny samples are not a capacity or production latency claim.

## Trade-off

Determinism, exact evidence and low local cost in exchange for incomplete semantics, limited languages and no runtime proof. The fixtures are intentionally constructed to cover rules, so their high scores are not independent validation. Real-world precision/recall, adversarial evasion, throughput, end-to-end GitHub latency and model costs remain **UNMEASURED** until separately recorded.

## Next Action

Publish a reproducible self-scan and record deployment/CI results in the implementation log. Expand held-out labeled tests before treating rankings as comparative research findings.
