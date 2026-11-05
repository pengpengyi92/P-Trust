# SkillWard source audit research log

- **Timestamp:** 2026-11-06 00:34 Asia/Shanghai
- **Type:** Public documentation + reproducible synthetic evaluator; no P-Trust v0.1 runtime feature
- **Fixed upstream SHA:** `7e406b78dcc18a1cb95cd6a616c3b9f5928d4345`
- **Full note:** [Pinned-source audit](../reports/2026-11-06_skillward_pinned_source_audit.md)
- **Synthetic experiment:** [Research evaluation contract](../../research/agent_runtime_eval/README.md)

## Activity

- Enumerated the complete upstream Git tree (216 entries, 180 tracked file blobs), reviewed the public README, scanner factory/policy/pipeline, guardian orchestration, Docker launch flags, API request/response, risk routing and July MCP update.
- Distinguishes static classification, LLM triage, sandbox experimentation and live execution control.
- Records that implementation of in-image Guard enforcement and MCP Sentinel component is not available for full independent source verification from this tree.
- Wrote a harmless 12-row labeled test dataset and dependency-free evaluation contract.
- Local verification: `python3 -m unittest discover -s research/agent_runtime_eval/tests -v` → 5 passed; CLI output reviewed.

## Security boundary

Did **not** clone or execute SkillWard, install dependencies, pull images, run MCP tools, use model-provider keys, probe endpoints or test with real credentials. Public notes cite source paths, no attack payloads or friend/employer/private details. Observed unknowns do not imply confirmed vendor vulnerabilities.

## Next

Design independent annotation/corpus and harness for pass/warn/block and effect receipts in a separately approved safe environment. P-Trust's shipping product remains static.
