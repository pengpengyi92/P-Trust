# P Trust

**Evidence before autonomy.** A research-driven, static inspection tool for public GitHub repositories and agents.

P Trust asks: what can this code do, what keeps it in bounds, and what evidence supports that conclusion?

## v0.1

- Public GitHub URL to a pinned-commit, evidence-backed report.
- Seven replaceable analyzers: security, permissions, trajectory, observability, CI, recovery and documentation.
- Python / JavaScript / TypeScript syntax-tree inspection, exact file/line evidence and review recommendations.
- Permission map, static lifecycle-stage evidence, transparent scores, coverage and limitations.
- Durable asynchronous jobs, bounded retries, 24-hour retention and JSON / Markdown export.
- Seven harmless synthetic benchmark fixtures. Fixture code is parsed as text, never executed.

This is **not a security certification or authorization to run code**. The score measures observed patterns under a bounded static policy. It does not establish runtime safety, detect all malicious code, or prove that safeguards are effective. A synthetic fixture can achieve 100 by containing every expected pattern; this is not evidence of real-world accuracy.

## Quick Start

Node.js 22.12+ (Node 24 used in development):

```sh
npm ci --ignore-scripts
npm run check
npm run dev
```

Open http://127.0.0.1:8801. `dev` builds the React frontend and starts a local Worker with SQLite Durable Objects. Use `npm run dev:web` for frontend hot reload against that Worker.

No personal GitHub token is accepted or required. Cloudflare deployment requires your own account and `npx wrangler login`, then `npm run deploy`. SQLite namespaces are provisioned by the checked-in migration. Never add account secrets to Git.

## Usage

Enter `https://github.com/owner/repository`. A persistent job progresses through metadata, tree, bounded file reads, classification, seven analyzers and scoring. Reloading a report link reconnects to the job. Reports are public and expire after 24 hours; download a copy for long-term use.

The public service conservatively caps anonymous GitHub requests at 57 per UTC hour, plus three scan submissions per minute per IP. One scan can consume up to 19 requests. Other GitHub egress users can exhaust upstream quota sooner. A repository reuses its first snapshot in the same UTC hour: **a cached report is not a guarantee of current HEAD**. Synthetic examples remain available without GitHub calls.

## Architecture

```text
React / TypeScript
    -> Worker API / input boundary / rate limit
    -> AnalysisJob (SQLite Durable Object + alarms)
    -> pinned public GitHub metadata / tree / blobs
    -> syntax signals / classification / seven analyzers
    -> score / evidence / report
```

`src/core` is platform-independent. `src/analyzers` implements the analyzer contract. `src/worker.ts` owns storage, scheduling and HTTP. `src/fixtures` contains harmless strings, excluded from real repository sampling. No target subprocesses, package installs, imports or dynamic execution exist in the ingestion pipeline.

Optional Workers AI interpretation is **off by default**. Enabling `AI_INTERPRETATION` permits ranking only known finding IDs. The model receives no repository snippets and cannot change scores, permissions, evidence or factual claims. Invalid output is rejected. Live provider behavior is not part of the deterministic benchmark.

## Security And Limitations

- Read-only public GitHub REST API at a fixed hostname; no redirects, arbitrary URLs or user tokens.
- Up to 16 files, 16 KiB each, 256 KiB total; bounded response streams and timeouts.
- Symlinks, traversal paths, dependencies, generated assets, fixture directories and sensitive filenames excluded.
- Common credential and email patterns redacted in report snippets. Redaction is best effort, not a DLP guarantee; do not use this service for private or confidential materials.
- Sample-based syntax heuristics can miss aliases, wrappers, unsupported languages, larger files and unrecognized control patterns. Names can be spoofed. CI command matching does not prove a workflow is runnable or passed.
- No semantic/data-flow proof, dependency vulnerability resolution, runtime trace reconstruction or sandbox execution in v0.1.
- Grades/confidence are uncalibrated and gameable. Review both positive and negative evidence before granting access.
- Raw sampled files exist only in bounded transient job storage and are removed at terminal completion/failure. Report evidence expires after 24 hours. Metadata-only operational telemetry follows the hosting provider's retention settings.

## API

```sh
curl -X POST http://127.0.0.1:8801/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{"repository":"https://github.com/pengpengyi92/P-Trust"}'
# {"jobId":"...","status":"queued",...}
curl http://127.0.0.1:8801/api/jobs/JOB_ID
curl http://127.0.0.1:8801/api/reports/JOB_ID
curl http://127.0.0.1:8801/api/fixtures/over-permissioned-agent
```

## Research

[Scoring protocol](docs/scoring.md) · [Architecture](docs/architecture.md) · [Benchmark card](BENCHMARK_CARD.md) · [Roadmap](TODO.md) · [Version log](docs/logs/v0.1.md)

Contributions should include a harmless reproduction, expected behavior and regression test. Report false positives without publishing real secrets. The public repository contains the product and concise engineering documentation, not private construction notes or personal material.

## License

MIT. Generated visual asset provenance: [assets](docs/assets.md).
