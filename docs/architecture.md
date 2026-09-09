# Architecture And Threat Model

## Ownership

The frontend submits only a public GitHub repository URL. The Worker validates origin, JSON size and URL shape, applies per-IP submission limits, and assigns a repository/hour job ID. Durable Objects serialize work per job. An account-local budget object bounds anonymous GitHub calls. SQLite stores job state, transient working data, report and findings; no separate database service is needed.

Alarms perform one bounded step at a time. Metadata pins the default branch to a commit and tree; subsequent blobs use known SHA values. `advance` is a pure orchestration boundary that can be serialized between steps and tested with a mock transport. Failed upstream calls retry at most twice after the initial attempt, with increasing delay. Rate limits fail visibly instead of busy-looping. Jobs have a ten-minute deadline and 24-hour cleanup alarm.

Cloudflare alarms are at-least-once; the current persisted stage determines the next operation. No remote actions occur besides GET requests. A repeated read may consume quota but cannot execute target code. Local state and report updates occur synchronously before scheduling the next alarm. Optional AI executes before the terminal report commit; repeated delivery can repeat that bounded ranking call only when explicitly enabled.

## Input Boundaries

1. Exact GitHub host and owner/name shape. No arbitrary URLs, URL credentials, query tokens or redirect following.
2. Upstream JSON shape validation with Zod, bounded stream reads and fetch timeouts.
3. Regular blobs only; sensitive paths, vendors, generated files, binary data and oversized files excluded.
4. Parser-only source inspection. External code, comments and documentation are untrusted data.
5. React escaping, no `dangerouslySetInnerHTML`; code evidence is rendered as text.
6. AI sees deterministic finding IDs/severities only and may return only their permutation.
7. Report links are public, not authentication boundaries. Do not submit confidential material.

## Known Trade-offs

- Anonymous quota makes this a small public research demo, not a high-throughput scanning service.
- Default-branch commit metadata may exceed response bounds for huge commits; this fails closed.
- A bounded sample can miss important files. Selection is deterministic: workflows, root manifests/docs, security/agent-related paths, other code, then tests.
- No GitHub webhook, private-repository access, dynamic sandbox or interprocedural control-flow proof.
- Durable storage integration is tested locally; real-world process crashes and large-scale concurrent abuse require expanded validation.
- No LLM claim generation. Interpretation is optional ranking, disabled in the deployed default.

## Sources

- [Cloudflare Durable Object alarms](https://developers.cloudflare.com/durable-objects/api/alarms/)
- [Cloudflare rate-limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [GitHub Git trees API and truncation](https://docs.github.com/en/rest/git/trees?apiVersion=2022-11-28)
- [Workers static assets binding](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Workers AI model interface](https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct/)
