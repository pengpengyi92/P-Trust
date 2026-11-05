# P-Trust public research log — Fangcun AI Agent runtime safety

- **Timestamp:** 2026-11-05 23:44 Asia/Shanghai
- **Type:** Research-only log, not a v0.1 product release
- **Related note:** [Fangcun Agent runtime safety](../notes/2026-11-05_2344_FANGCUN_AI_AGENT_RUNTIME_SAFETY.md)

## Trigger

Public product research about Fangcun AI raised a useful distinction: **pre-execution static inspection, in-execution monitoring / authorization, and after-execution audit are different controls**. The user wants to build in public while preserving private contacts and due diligence outside the public repo.

## What changed

- Added an **external-company research note** and a measured evaluation-matrix proposal.
- Distinguished vendor declarations from verified benchmark outcomes.
- Mapped possible future P-Trust experiments against the v0.1 scope and security boundaries.
- Added no executable scans, dependencies, runtime hooks, production claims, private files or unreviewed business information.

## Open experiments

- Read-only review of a pinned SkillWard commit with provenance.
- Benign/malicious trace labeling design and false-positive quantification.
- Agent runtime policy gate specification, including latency, authorization, revocation, logging and human escalation.
- Reproducible baseline comparison with no implied equivalence to vendor F1.

## Validation statement

Documentation-only update; **no tests run** and **no target code executed**. Runtime protection remains unimplemented in P-Trust v0.1. Source coverage and open questions are in the [research note](../notes/2026-11-05_2344_FANGCUN_AI_AGENT_RUNTIME_SAFETY.md).

## Privacy boundary

All published claims derive from public company, paper and repository sources. No private friend identity, user relationship, employer record, private P-DD report, credentials or client material is included.
