# Fangcun AI: from static trust signals to Agent runtime safety

- **Timestamp:** 2026-11-05 23:44 Asia/Shanghai
- **Type:** External technical research note; build in public
- **Status:** RESEARCH_ONLY / NO_VENDOR_ENDORSEMENT / NO_RUNTIME_INTEGRATION / PUBLIC_SOURCES_ONLY
- **Project:** P-Trust (v0.1 static inspection), independent of Fangcun AI
- **Case entity:** Fangcun AI / 方寸跃迁 (company-public product descriptions)

## Executive observation

Agent safety is not only about whether an LLM produces an unsafe answer. An autonomous agent can **use tools, access files, call MCP servers, invoke third-party Skills, and change state**. Effective controls have to be placed at the point where a proposed action turns into an externally consequential effect. Runtime observability supplies evidence, but observability alone does **not** necessarily prevent or stop damage.

Fangcun AI publicly describes **SkillWard** for Skill/MCP screening (including static inspection and isolated execution) and **Fangcun Observer / Agent Guard / Agent IAM** for observability, guardrails and identity/policy controls. This creates an informative external benchmark for P-Trust's next research questions. It does not imply partnership, integration, or proof of deployment efficacy.

## Three independent control planes

| Stage | Typical evidence | Useful controls | Failure mode to test |
|---|---|---|---|
| **Before enabling** a Skill / MCP / repo | Pinned version, permissions, import graph, manifest, known risky calls | Dependency provenance, least privilege, allowlists, static checks; optional segregated dynamic test | Obfuscated tool call; indirect import; silent upgrade after approval |
| **During an Agent run** | Step/trace, tool name + arguments, permission context, file/network event, decision timestamp | Policy gate **before** privileged action, identity scoping, suspend/deny/escalate to human, reversible dry-run | Prompt-injection tool misuse; exfiltration; guard bypass; latency/availability failure |
| **After execution** | Append-only audit trail, outcome, incident timeline, corrections | Retention + redaction, forensic replay, revocation, incident review, rules update | Missing traces, post-hoc reconstruction error, unclear ownership |

**Important:** a monitor that only logs a forbidden action *after* execution is a detective control, not a preventive gate. An active control must establish where the authorization decision occurs relative to tool execution, which actions can actually be interrupted, and what happens when the guard fails.

## Threat-model questions

1. **Assets:** credentials, personal data, proprietary source code, payment / transaction endpoints, client communications, agent memory and system prompts.
2. **Attack surfaces:** user prompt, retrieved webpage, tool result, malicious package / Skill / MCP server, transitive dependencies, cross-agent messages.
3. **Trust boundaries:** user intent → planner → tool-call request → permission broker → external system → audit.
4. **Controls:** provenance and pinned versions; no default secret exposure; per-action scoped authorization; human approval for irreversible/high-value changes; non-bypassable tooling boundary; recovery.
5. **Residual risk:** false negative, false interruption, telemetry loss, insider/configuration error, guard model manipulation, race conditions and incomplete semantic context.

## Evaluation matrix (a proposed test protocol, not reported results)

| Dimension | Measurement / question | Acceptance criteria |
|---|---|---|
| Detection | Precision, recall, F1 on independently labeled benign and malicious traces | **UNSET** until dataset and policy chosen |
| False blocks | False-positive interrupts per 1,000 legitimate tool actions | **UNSET** |
| Prevented harm | Fraction of adversarial actions blocked **before** effect; separately report audit-only catches | **UNSET** |
| Intervention timing | Time from risky action request to decision; p50/p95/p99 | **UNSET** |
| Availability | Fail-open vs fail-closed by action class; dropped events | **UNSET** |
| Overhead | Added p95 latency, CPU / cost / token usage | **UNSET** |
| Observability | Trace coverage; idempotent action ID and causal chain completeness | **UNSET** |
| Recovery | Rollback/revocation effectiveness and time-to-recover | **UNSET** |
| Generalization | Hold-out unseen Skills/MCPs, benign hard cases, adversarial adaptations | **UNSET** |
| Governance | Retention, isolation, trace PII minimization, user consent, evidence of policy enforcement | **UNSET** |

**Benchmark hygiene:** identify dataset source, positive-class prevalence, train/test separation, baselines, version, handling of inconclusive cases and confidence intervals. A vendor-reported F1 without these does not establish independent field performance.

## P-Trust boundary and research backlog

**What P-Trust v0.1 actually does:** bounded, read-only analysis of public GitHub repositories using seven static analyzers, syntactic evidence and synthetic fixtures. It does not execute target code, reconstruct actual runtime traces, certify security or monitor a live Agent. The report grade is uncalibrated.

**Potential research sequence (not shipped):**
1. Develop a transparent labeled corpus for static Skill/MCP risk patterns, rule-level precision/recall and failure taxonomy.
2. Design harmless synthetic tool-action traces with explicit authorization boundaries and interruption timestamps; treat them as a separate benchmark, not a v0.1 analyzer feature.
3. Review a *pinned* SkillWard open-source commit (license, test harness, claimed threat model and benchmark construction). Run nothing from untrusted repos outside a separately approved sandbox.
4. Specify opt-in isolated dynamic testing and retention model before considering any implementation.
5. Only after validation, evaluate runtime policy gating and immutable/minimally sensitive traces as a **separate future capability** with a separately documented threat model.

## Unverified claims / caveats

- Fangcun's website reports SkillWard detection F1 figures. They are **vendor claims**; the figures cannot be compared to P-Trust synthetic scores without matched data, labels and baseline.
- Product names (Observer, Guard, IAM) do not show whether a particular customer deploys active *blocking*, audit-only telemetry, or a beta product.
- No customer contract, bank deployment, revenue, ownership or investment conclusion is established by this technical note.
- No friend, private contact or sensitive company materials are identified or exposed.

## Evidence ledger (public material; reviewed 2026-11-05 Asia/Shanghai)

| ID | Source, publication date | Publicly supported point | Evidence boundary |
|---|---|---|---|
| S1 | Fangcun AI official [About](https://fangcunleap.com/about), accessed 2026-11-05 | Self-description as Tsinghua College of AI / IIIS-incubated AI-safety company; Observer, IAM, Guard, Skill/MCP checking | Company self-description; not independent university ownership verification |
| S2 | Fangcun AI official [Products](https://fangcunleap.com/products), accessed 2026-11-05 | Agent execution observability, guardrails, identity, SkillWard | Product description; actual deployment/SLA/customer outcomes not independently checked |
| S3 | Fangcun AI official [SkillWard technical blog](https://www.fangcunleap.com/blog/skillward), accessed 2026-11-05 | Static analysis + model judgment + isolated honeypot execution workflow | Vendor's claimed architecture, not an independent security assessment |
| S4 | [Fangcun-AI/SkillWard](https://github.com/Fangcun-AI/SkillWard), accessed 2026-11-05 | Public source code is available for future pinned-commit review | Repository availability is not a confirmed end-to-end review or test in this note |
| S5 | Fangcun AI [Research](https://fangcunleap.com/research), accessed 2026-11-05 | Frontier evaluation research, risk dimensions and company-stated benchmark results | Benchmarks require protocol inspection and independent reproduction |
| S6 | [arXiv:2610.35671](https://arxiv.org/abs/2610.35671), dated 2026-10 (preprint) | Public model-evaluation research relevant to evaluation awareness / control risks | Preprint and reported results are not independently replicated here |
| S7 | [Fangcun official Observer post](https://fangcunleap.com/blog/observer), accessed 2026-11-05 | Company explanation of runtime observation and audit | Roadmap/product statements ≠ production guarantee |

All source dates above are **access dates** unless independently indicated as a publication date. This file uses no private or employer material.

## Next checkpoint

Do a **read-only pinned-commit source audit** of SkillWard; extract schema, telemetry fields, policy precedence, test corpus and guard decision points. Publish only reproducible, non-sensitive observations, with explicit test dates and no harmful exploit instructions.
