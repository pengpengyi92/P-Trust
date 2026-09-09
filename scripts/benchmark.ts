import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { scanSnapshot } from "../src/core/report";
import { fixtures, fixtureSnapshot } from "../src/fixtures";
const results = [];
for (const id of Object.keys(fixtures)) {
  const times = [];
  let report;
  for (let n = 0; n < 10; n++) {
    const start = performance.now();
    report = await scanSnapshot(fixtureSnapshot(id), `fixture-${id}`);
    times.push(performance.now() - start);
  }
  results.push({
    fixture: id,
    score: report!.overall_score,
    classification: report!.classification.kind,
    findings: report!.findings.map((f) => f.id),
    mean_ms: Number(
      (times.reduce((a, b) => a + b, 0) / times.length).toFixed(3),
    ),
    runs: times.length,
  });
}
await mkdir("output", { recursive: true });
await writeFile(
  "output/benchmark.json",
  JSON.stringify(
    {
      measured_at: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      protocol:
        "Seven fixed harmless fixtures, ten sequential warm/cold mixed runs. No network. Not a real-world accuracy evaluation.",
      results,
    },
    null,
    2,
  ),
);
console.table(results.map((r) => ({ ...r, findings: r.findings.length })));
