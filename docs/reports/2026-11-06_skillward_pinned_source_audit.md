# SkillWard pinned-source audit — What can we actually verify about Agent runtime safety?

- **Date / timestamp:** 2026-11-06 00:34 Asia/Shanghai
- **Subject:** [Fangcun-AI/SkillWard](https://github.com/Fangcun-AI/SkillWard)
- **Source revision:** `7e406b78dcc18a1cb95cd6a616c3b9f5928d4345` (upstream authored 2026-07-17 UTC)
- **Tree:** `798c3885f224dd91ea1ce3fb6e963a2fb741ede4` (216 tree entries, 180 blobs; not truncated)
- **Audience:** Public P-Trust / technical research only
- **Method:** GitHub pinned-commit read-only source inspection; no clone/install/Docker/Skill/MCP execution
- **Status:** LIMITED_SOURCE_REVIEW / NOT_PEN_TESTED / NOT_A_SECURITY_CERTIFICATION / NO_VENDOR_PARTNERSHIP
- **Previous note:** [Fangcun AI Agent runtime safety](../notes/2026-11-05_2344_FANGCUN_AI_AGENT_RUNTIME_SAFETY.md)

## Outcome in one paragraph

The checked-in code supports a **three-stage Skill scanning workflow**: policy-controlled static detectors, model-based triage, and Docker-orchestrated execution of selected Skills. It also includes a separate operation-audit API returning a suggested `pass/warn/block` decision. However, the actual Fangcun Guard extension executed **inside the referenced Docker image** is not present as a complete independent implementation in the checked-in tree. From this revision alone we cannot prove that every blocked tool call is stopped before effects occur, that the container has hardened egress/resource confinement, or that the company-reported accuracy metrics generalize. This is a **scope and evidence gap**, not a conclusion that the product is ineffective or exploitable.

## Architecture backed by pinned code

| Component | Verified code path | What we can establish | What we cannot establish |
|---|---|---|---|
| Stage A: static analyzer | [skill-scanner/skill_scanner/core/analyzer_factory.py:25–81](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/skill-scanner/skill_scanner/core/analyzer_factory.py#L25-L81), [skill-scanner/skill_scanner/core/scanner.py:182–306](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/skill-scanner/skill_scanner/core/scanner.py#L182-L306) | Factory selects static, bytecode, pipeline analyzers under policy; scanner gathers findings and defers LLM-backed analyzers | Rule-level held-out quality, zero false negatives, complete semantic/data-flow coverage |
| Pipeline / taint heuristics | [skill-scanner/skill_scanner/core/analyzers/pipeline_analyzer.py:143–287](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/skill-scanner/skill_scanner/core/analyzers/pipeline_analyzer.py#L143-L287) | Parsed text/command pipelines and taint labels can produce findings | General interprocedural program proof |
| Stage B: LLM triage | [guardian-api/guardian.py:355–430](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/guardian-api/guardian.py#L355-L430), [guardian-api/guardian.py:433–495](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/guardian-api/guardian.py#L433-L495) | `litellm.completion` supplies safety confidence; thresholds route unsafe/skip/sandbox | Probabilistic calibration or proof an unexecuted Skill is safe |
| Stage C: Docker orchestrator | [guardian-api/guardian.py:658–711](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/guardian-api/guardian.py#L658-L711), [guardian-api/guardian.py:916–965](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/guardian-api/guardian.py#L916-L965) | Orchestrator mounts a Skill source path as read-only, injects settings and starts a container with timeout watchdog | Full container image content, effective host isolation and egress policy |
| Phase switching | [guardian-api/guardian.py:781–835](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/guardian-api/guardian.py#L781-L835) | Environment preparation runs with the Guard extension disabled, followed by a Guard-enabled execution phase | Whether all preparation side effects are harmless or constrained at the container boundary |
| Runtime risk extraction | [guardian-api/guardian.py:992–1079](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/guardian-api/guardian.py#L992-L1079) | Output lines are parsed into risk levels, blocks, timeouts, errors and incomplete results | Independent timing proofs that flagged actions were prevented before real effects |
| Operation audit API | [main.py:64–84](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/main.py#L64-L84), [services/skill_audit_service.py:143–225](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/services/skill_audit_service.py#L143-L225) | Accepts context/operation and returns `risk_level`, `suggest_action` via classifier and LLM | Enforcement by the calling client, privileged-action gate, safe fallback for all failure conditions |
| MCP | [docs/UPDATE_REPORT_2026-07-17_CN.md:1–23](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/docs/UPDATE_REPORT_2026-07-17_CN.md#L1-L23) | Release note describes MCP Sentinel, local scans and bounded unauthenticated remote introspection | Internal MCP Sentinel code or its remote tool-call protections; not located in this pinned tree |

**Separation:** An API that returns `suggest_action: "block"` is a **decision interface**. An enforceable execution boundary additionally needs authenticated policy binding, host-side tool mediation, a before-effect decision receipt, timeout defaults and anti-bypass controls.

## Specific code-level findings / evidence gaps

| ID | Observation from this revision | Consequence / evaluation request | Assessment |
|---|---|---|---|
| SW-01 | [guardian-api/guardian.py:916–925](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/guardian-api/guardian.py#L916-L925) constructs `docker run` with `--rm`, `--dns`, `--entrypoint`, read-only source bind and `-e` env values. No explicit `--network none`, `--cap-drop`, `--security-opt`, memory or PID limits appear in this command. | Do not infer full isolation from the word Docker. Verify hardened host/runtime configuration, network policy, writable mounts, resource/cgroup limits and image digest independently. | **Needs configuration evidence**, not verified exploit |
| SW-02 | [guardian-api/guardian.py:892–925](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/guardian-api/guardian.py#L892-L925) places model/provider credentials and configured Guard service keys into container environment. Test-only dummy values are also generated for Skill-requested variables. | Real provider keys must be disposable, tightly scoped, and protected from untrusted test actions. Test runner should never use employer/production credentials. Do not log credential values. | **Key-handling control to test** |
| SW-03 | [guardian-api/guardian.py:711–835](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/guardian-api/guardian.py#L711-L835) configures broad in-container tools and elevated behavior; Phase 1 prepares dependencies with the Guard disabled. | This may be intentional to elicit hidden behavior, but the outside-container containment must withstand that phase too. Verify egress, filesystem and package-install boundaries, and whether preparation signals are observed. | **Intentional test design; isolation unknown** |
| SW-04 | [guardian-api/guardian.py:747–749](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/guardian-api/guardian.py#L747-L749) and [guardian-api/guardian.py:820–835](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/guardian-api/guardian.py#L820-L835) refer to an in-image OpenClaw Fangcun Guard extension. A full extension implementation is not present in the enumerated public tree. | Request pinned source or independently auditable image digest; verify `before_tool` versus `after_tool` hooks and failure policy. | **Blocking implementation not verifiable here** |
| SW-05 | [guardian-api/guardian.py:355–430](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/guardian-api/guardian.py#L355-L430) returns a confidence of 0.0 on model/unavailable/parse failure, while [guardian-api/config.py:45–57](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/guardian-api/config.py#L45-L57) sets default thresholds 0.3/0.9. | Failure is routed conservatively to `UNSAFE` in this CLI path; evaluate availability/false-block costs separately. Confirm other API paths have equivalent failure semantics. | **Code-observed routing, not an outcome test** |
| SW-06 | [guardian-api/guardian.py:1040–1095](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/guardian-api/guardian.py#L1040-L1095) derives `High Risk`, `Medium Risk`, `Safe`, `TIMEOUT`, `ERROR`, `INCOMPLETE` from output text/events. | Reports need authenticated event provenance and causal action receipts; an alert line alone is not evidence of an earlier prevented effect. | **Audit semantics unvalidated** |
| SW-07 | [main.py:27–44](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/main.py#L27-L44) configures permissive CORS and optional API-key authentication if a secret is configured. | Enterprise API deployment requires verified ingress/authn/authz, TLS, origin/cross-domain policy, rate limits, retention and incident response. | **Deployment-specific, not claim of exposed service** |
| SW-08 | [docs/UPDATE_REPORT_2026-07-17_CN.md:1–23](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/docs/UPDATE_REPORT_2026-07-17_CN.md#L1-L23) describes MCP Sentinel and some live protocol enumeration; no MCP Sentinel source module appeared in this checked-in tree. | Cannot audit remote MCP side-effect boundaries from this revision. Need separate component version/documentation. | **Source coverage gap** |
| SW-09 | The pinned tree includes the project code and docs but no obvious `tests/` or `test_*.py` suite. | Ask for reproducible CI/fixture suite or documented benchmark harness. This does **not** mean the vendor has no external/internal tests. | **Checked-in evidence gap** |

## Why reported scan percentages are not precision/recall

The pinned [README_CN.md:119–148](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/README_CN.md#L119-L148) claims an observed set of approximately 5,000 real-world Skills:

- Stage A+B outcomes: approximately **49% safe**, **13% unsafe**, **38% suspicious**.
- Among the suspicious subset tested in Stage C: approximately **69% safe**, **17% medium**, **14% high**.
- Derived **flagged distribution**, not accuracy: `13% + 38% × (17% + 14%) ≈ 24.78%` flagged unsafe/at-risk under the vendor's own workflow.

A detection **flag rate** does not identify true positives/false positives. Independent **precision = TP/(TP+FP)** and **recall = TP/(TP+FN)** require ground-truth labels for the same population. The more recent Fangcun website's Skill/MCP F1 announcements need explicit matching version/dataset before comparison to this July commit.

Unknown: labeling protocol, independent assessors, sampling bias, held-out test independence, confidence intervals, model versions, Docker image digest, false-positive intervention cost, temporal leakage, failure cases. No independent reproduction of SkillWard benchmarks is reported here.

## Evaluation protocol — bridge to P-Trust (no vendor tests run)

**Threat model:** A Skill or MCP tool can return misleading instructions, request unauthorized file/network/command operations, or change state unexpectedly. A runtime policy gate must distinguish normal authorized usage from unsafe tool effects while keeping privileged control separate from a model's request.

| Layer | Question | Minimum record | Proposed metric |
|---|---|---|---|
| Source safety screening | Was this artifact marked suspicious? | SHA, version, rules, code context, independent label | Precision/recall/F1, PR-AUC, confusion matrix |
| Guard decision | Was the action flagged and what did policy do? | Action ID, task ID, role, policy ID, decision | Detection-to-block conversion, false blocks per 1,000 benign actions |
| Enforcement boundary | Did block happen before consequence? | Before-tool request timestamp, guard decision timestamp, actual effect receipt or absence with trusted causal trace | Pre-effect confirmed block rate; bypass rate; side effects despite a block |
| Availability | Is the guard reachable in the critical path? | Retry, timeout, fail-open/closed decision, API errors | p95/p99 latency, timeout and error rates |
| Audit / accountability | Can authorized reviewers reconstruct the event? | Versioned, minimized, protected trace with actor/action linkage | Trace coverage, retention compliance, incident replay completeness |
| Recovery | Can harm be contained or reversed? | Revocation, rollback and compensating action receipts | Time-to-containment and recovery, unresolved irreversible effects |

**Mandatory separation:** Detection `flagged` ≠ suggested `block` ≠ enforced before effect ≠ proven harm prevented. Human authorization for irreversible banking actions is a separate governance gate.

## Reproducible **synthetic-only** measurement smoke test

A small Python standard-library harness is in [research/agent_runtime_eval](../../research/agent_runtime_eval/README.md). It uses twelve **fictional** rows; it neither executes this vendor repository nor claims empirical performance.

On 2026-11-06 local verification: **5 unit tests passed**; example metrics: TP=4, FP=2, FN=2, TN=4; precision=recall=F1≈0.667; false blocks 166.667/1,000 benign examples; pre-effect *synthetic proxy* 2/6; p95 decision latency (nearest-rank) 180 ms; trace coverage 11/12. These values exist exclusively to test **formula correctness** and are not product outcomes.

## Decision and next evidence requests

1. **Public research verdict: KEEP ON WATCHLIST / NOT CALIBRATED.**
2. Ask for pinned Guard extension implementation or verifiable container image digest, SBOM and isolation settings before making enforcement claims.
3. Obtain a labeled held-out dataset or independently construct benign/malicious samples with fixed annotation rules; no external attacker payload publication necessary.
4. Specify an instrumented action lifecycle with independent tool-execution receipts to confirm before-effect blocking.
5. No dynamic vendor sandbox, OpenClaw gateway, Docker pull, networked MCP probe or real AI model call performed. No private contacts, employer/customer records or actual credentials included.

## Source list (all public; accessed 2026-11-06)

- [Upstream revision `7e406b78dcc18a1cb95cd6a616c3b9f5928d4345`](https://github.com/Fangcun-AI/SkillWard/tree/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345) — direct pinned source, main evidence throughout.
- [Source tree API](https://api.github.com/repos/Fangcun-AI/SkillWard/git/trees/798c3885f224dd91ea1ce3fb6e963a2fb741ede4?recursive=1) — 216 entries and 180 blobs; complete Git tree.
- [README_CN](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/README_CN.md) — stated three-stage pipeline and 5,000-sample distribution (vendor claim).
- [2026-07-17 MCP update](https://github.com/Fangcun-AI/SkillWard/blob/7e406b78dcc18a1cb95cd6a616c3b9f5928d4345/docs/UPDATE_REPORT_2026-07-17_CN.md) — MCP Sentinel product claim, including unauthenticated remote support and stated limits.
- [Fangcun SkillWard public explanation](https://www.fangcunleap.com/blog/skillward) — company-authored architecture, not independent validation.
- [P-Trust v0.1 README](../../README.md) — P-Trust itself remains bounded static inspection.
