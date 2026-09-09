import { mkdir, writeFile } from 'node:fs/promises';
import type { JobState, TrustReport } from '../src/types';

const base = process.argv[2] || 'http://127.0.0.1:8801';
const repository = 'https://github.com/pengpengyi92/P-Trust';
const response = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repository }) });
const start = await response.json() as { jobId?: string; error?: string };
if (!response.ok || !start.jobId) throw Error(start.error || 'Job creation failed');
console.log(`Job ${start.jobId}`);
let previous = '';
for (let count = 0; count < 300; count++) {
  const response = await fetch(`${base}/api/jobs/${start.jobId}`);
  if (!response.ok) throw Error(`Job status HTTP ${response.status}`);
  const job = await response.json() as JobState;
  const stage = `${job.stage} ${job.progress.done}/${job.progress.total}`;
  if (stage !== previous) { console.log(stage); previous = stage; }
  if (job.status === 'failed') throw Error(JSON.stringify(job.error));
  if (job.status === 'completed') {
    const reportResponse = await fetch(`${base}/api/reports/${job.id}`);
    if (!reportResponse.ok) throw Error('Report retrieval failed');
    const report = await reportResponse.json() as TrustReport;
    if (report.repository.source !== 'github' || !/^[a-f0-9]{40}$/.test(report.repository.commit_sha)) throw Error('Not a real pinned GitHub snapshot');
    await mkdir('output', { recursive: true });
    await writeFile('output/self-scan.json', JSON.stringify(report, null, 2));
    await writeFile('output/self-scan-job.json', JSON.stringify(job, null, 2));
    console.log(JSON.stringify({ score: report.overall_score, grade: report.grade, commit: report.repository.commit_sha, coverage: report.repository.coverage, dimensions: report.dimensions.map(d => ({ name: d.dimension, score: d.score })), findings: report.findings.map(f => f.title), url: `${base}/?report=${job.id}` }, null, 2));
    process.exit(0);
  }
  await new Promise(resolve => setTimeout(resolve, 2000));
}
throw Error('Ten-minute polling deadline exceeded');
