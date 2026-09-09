# P Trust: First Public Self-Inspection

Date: 2026-09-09. Source: the deployed Cloudflare service reading the actual public GitHub repository, not a fixture or local source scan.

- Repository: [pengpengyi92/P-Trust](https://github.com/pengpengyi92/P-Trust)
- Pinned commit: `2925a9c3e6b51aa3bd4b293910549ccdb78a69c9`
- Score: **67 / 100, grade D** under `static-evidence-2026-09-09.1`.
- Classification: software (heuristic; the current matcher does not recognize every agent orchestration idiom).
- Coverage: **16 / 27 eligible files**, 50,372 bytes; full tree response not truncated.
- Lifecycle observed: metadata -> tree -> files -> seven analyzers -> scoring -> persisted report.
- One observed successful job duration: 9.294 seconds (03:56:24.577Z to 03:56:33.871Z). N=1, not a performance distribution.
- [Raw report](self-inspection-2026-09-09.json). This permanently retained public artifact is a historical snapshot, not current HEAD certification.

## Dimension Results

| Security | Permissions | Trajectory | Observability | CI | Recovery | Documentation |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 100 | 30 | N/A | 50 | 60 | 60 | 100 |

These numbers measure recognized patterns, not effectiveness. Security 100 in particular does not mean absence of vulnerabilities. Do not optimize code merely to improve this score.

## Findings And Human Interpretation

1. **Filesystem mutation capability:** `scripts/benchmark.ts` and `scripts/self-scan.ts` write generated JSON artifacts under `output/`. These are local maintenance scripts, not the public Worker ingestion path. Capability detection is correct; the model lacks entry-point/deployment separation.
2. **Outbound network capability:** the Worker fetch wrapper and self-scan script make HTTP requests. The ingestion reader restricts requests to the GitHub API and rejects redirects; a call-name detector cannot establish the wrapper's full constraints. The maintenance script's base URL is a developer-controlled CLI argument, not an HTTP input to the public scanner.
3. **Continuous loop needs exit-path review:** the stream reader uses `while (true)` with an EOF break, byte ceiling and fetch timeout. This is an intentional bounded streaming pattern. The review signal should not be treated as proof of an infinite retry defect.

## What We Learned

- Recognizing named `trace_id`/`request_id` arguments misses correlated `job_id` fields in structured JSON logs.
- CI command matching does not follow `npm run check` into package scripts.
- Sampling excluded the large frontend, dependency lock and unsupported JSONC config. Coverage cannot be generalized to the whole repository.
- The non-agent classification evidence presentation was improved afterward, but this raw report is preserved unchanged.
- Better symbol resolution, entry-point classification, guard dominance and workflow-script resolution need held-out tests before changing scores. Real-world accuracy remains UNMEASURED.

The first production attempt exposed a Workers-specific redirect mode incompatibility. Explicit manual redirect rejection repaired it. The successful self-scan is evidence of that end-to-end integration, not a claim that all failure/recovery modes have been exercised.
