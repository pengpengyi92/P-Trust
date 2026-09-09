# Static Evidence Policy v0.1

Policy ID: `static-evidence-2026-09-09.1`.

| Dimension     | Weight | Presence checks and points                                            |
| ------------- | -----: | --------------------------------------------------------------------- |
| Security      |     25 | validation call 40, CI security command 30, safety documentation 30   |
| Permissions   |     15 | approval/authorization call 70, boundary documentation 30             |
| Trajectory    |     15 | tool call 20, state write 40, approval 20, trace 20                   |
| Observability |     15 | logging 30, correlated identifier 50, exception syntax 20             |
| CI            |     15 | install 20, test command 40, lint/type command 20, test assertions 20 |
| Recovery      |     10 | exception 30, timeout 30, retry-count guard 25, backoff 15            |
| Documentation |      5 | usage 40, limitations 35, architecture 25                             |

Each dimension is the sum of observed checks, minus 15 per high-severity review signal in that dimension, floored at zero. Overall score is the weighted average, rounded to an integer. Non-agent trajectory is excluded and remaining weights renormalized. No fetched files produces `INSUFFICIENT`, not 100. Zero points means no recognized positive evidence, **not maliciousness**.

A >= 90; B >= 80; C >= 70; D >= 60; F < 60. These letters are policy buckets, not calibrated risk ratings. Before cross-repository comparison, compare classification, eligible files, sampled bytes and missing checks. Documentation can contribute only the explicit checks above; it cannot fabricate a runtime trace or approval gate.

Confidence is a transparent heuristic: `(0.3 + 0.4 * fetched/eligible)`, halved for a truncated tree. Empty samples have zero confidence. It is **not a statistically calibrated probability** and cannot exceed 0.7 on a complete static sample. Large repositories are severely under-sampled.

## Review Decisions

- `approval_required`: observed high-impact capability or dangerous configuration; human review, not a maliciousness verdict.
- `warn`: review a potential boundary or continuous loop; intentional safe implementations are possible.
- `info`: reserved for informational findings.
- `block`: part of the schema but no v0.1 rule unconditionally blocks a repository. Powerful APIs alone do not justify that conclusion.

Evidence uses exact source spans from syntax trees for code calls and matched lines for configuration/documentation. URLs pin the scanned commit. Snippets are redacted. Named calls do not prove implementation behavior; aliases and dynamic dispatch may be missed. Workflow checks are textual configuration evidence, not successful CI runs.

## Model Boundary

Only a permutation of existing finding IDs is accepted. Unknown IDs, extra fields, duplicate IDs, missing IDs and fabricated claims fail validation. No model output can create evidence, override a score or grant permission. No raw repository text enters the model in v0.1.

## Falsifiable Next Step

Hypothesis: syntax-aware matching produces fewer comment/string false positives than keyword search on a fixed adversarial corpus. Current tests cover that boundary, but a real-world labeled precision/recall evaluation is **UNMEASURED**. A 100-point synthetic fixture is only a rule coverage test.
