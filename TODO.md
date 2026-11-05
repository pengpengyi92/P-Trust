# Roadmap

## P0: v0.1 Delivery

- [x] Bounded public GitHub reader, pinned evidence and seven analyzers.
- [x] Durable job pipeline, retry limits and visible failure states.
- [x] Functional report UI, permissions, trajectory, coverage and exports.
- [x] Seven fixed synthetic fixtures and deterministic regression tests.
- [x] Verify persisted production job/report, desktop/mobile UI and keyboard operation.
- [x] Publish public repository, verify CI and deploy Cloudflare.
- [x] Scan the published P Trust commit and retain an honest self-inspection report (67/D, 16/27 eligible files).

## P1: Research Quality

- [ ] Label a held-out real-world corpus; report precision/recall per rule, classification confusion and missed-language coverage.
- [ ] Parse workflow YAML structurally and distinguish disabled/unreachable jobs from executable checks.
- [ ] Add resolved-symbol analysis for aliases/wrappers and guard dominance; test false positives explicitly.
- [ ] Add richer manifest permission/configuration rules with exact evidence.
- [ ] Validate actual interruption/restart, at-least-once delivery and retention expiry under injected failures.
- [ ] Validate the optional live AI ranking adapter separately; default remains off.

## P2: Explicitly Future

- [ ] Opt-in isolated dynamic sandbox with a separate threat model and approval.
- [ ] GitHub App integration, per-owner quota and authenticated private reports.
- [ ] Interprocedural trajectory graphs, badges and continuous monitoring.

## Research watch (2026-11-05; not committed product scope)

- [x] First read-only, pinned-commit SkillWard source review (2026-11-06) and risk/evidence ledger in [pinned audit](docs/reports/2026-11-06_skillward_pinned_source_audit.md). No vendor code executed.\n- [x] Reproducible **synthetic-only** metrics smoke test with five passed unit tests; no empirical performance claim.\n- [ ] Review external Agent runtime safety literature and validate the pinned-code findings independently.
- [ ] Develop independently labeled Agent trace and tool-interruption scenarios; report precision/recall, false blocks, latency, trace coverage and pre-effect prevention separately. No runtime protection is claimed in P-Trust v0.1.
