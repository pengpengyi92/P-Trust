import type { RepositorySnapshot } from "../types";
const readme =
  "# Synthetic fixture\n## Usage\nHarmless static source samples.\n## Architecture\nValidation, approval, execution.\n## Security limitations\nNever execute this fixture.\n";
const workflow =
  "name: checks\non: [push]\njobs:\n  check:\n    steps:\n      - run: npm ci\n      - run: npm run typecheck\n      - run: npm test\n      - run: npm audit\n";
const safe = `async function agent(input, attempt, trace_id) {
  const value = schema.parse(input);
  if (attempt >= 3) throw Error('retry exhausted');
  requireApproval(value);
  try {
    await runAgent(value, AbortSignal.timeout(1000));
    saveState(value);
    logger.info(trace_id);
  } catch (error) { await backoff(attempt); }
}`;
export const fixtures: Record<
  string,
  { title: string; files: Record<string, string> }
> = {
  "safe-agent": {
    title: "Safe agent patterns",
    files: {
      "agent.ts": safe,
      "README.md": readme,
      ".github/workflows/ci.yml": workflow,
      "tests/agent.test.ts": "expect(checkPermission()).toBe(true);",
    },
  },
  "over-permissioned-agent": {
    title: "Over-permissioned agent",
    files: {
      "agent.py":
        "def agent(cmd):\n  run_agent(cmd)\n  subprocess.run(cmd, shell=True)\n  requests.post(url)\n",
      ".github/workflows/ci.yml": "permissions: write-all\n",
      "README.md": "# Example\n",
    },
  },
  "unsafe-filesystem-agent": {
    title: "Filesystem boundary review",
    files: {
      "agent.ts": "function agent(path){ runAgent(path); fs.rm(path); }",
    },
  },
  "weak-ci-project": {
    title: "Weak CI project",
    files: {
      "app.ts": "export const sum = (a,b) => a+b;",
      ".github/workflows/ci.yml": "name: noop\njobs: {}",
      "README.md": "# App\n",
    },
  },
  "good-engineering-project": {
    title: "Good engineering patterns",
    files: {
      "app.ts": safe.replace("runAgent", "work"),
      "README.md": readme,
      ".github/workflows/ci.yml": workflow,
      "tests/app.test.ts": "expect(sum(1,2)).toBe(3);",
    },
  },
  "retry-loop-agent": {
    title: "Retry loop review",
    files: { "agent.py": "def agent():\n  while True:\n    run_agent()\n" },
  },
  "well-observed-agent": {
    title: "Well-observed agent",
    files: {
      "agent.ts":
        "function agent(trace_id){ try { runAgent(); saveState(); logger.info(trace_id); } catch(e){ logger.error(trace_id); } }",
      "README.md": readme,
    },
  },
};
export function fixtureSnapshot(id: string): RepositorySnapshot {
  const fixture = fixtures[id];
  if (!fixture) throw Error("Unknown fixture");
  const files = Object.entries(fixture.files).map(([path, text]) => ({
    path,
    text,
    sha: "0".repeat(40),
  }));
  return {
    ref: {
      owner: "synthetic",
      name: id,
      url: `https://github.com/synthetic/${id}`,
    },
    commit_sha: "0".repeat(40),
    tree_sha: "0".repeat(40),
    description: fixture.title,
    files,
    tree: files.map((f) => ({
      path: f.path,
      sha: f.sha,
      size: f.text.length,
      mode: "100644",
      type: "blob",
    })),
    coverage: {
      tree_entries: files.length,
      eligible_files: files.length,
      fetched_files: files.length,
      bytes: files.reduce((n, f) => n + f.text.length, 0),
      truncated_tree: false,
      skipped: [],
    },
    captured_at: new Date().toISOString(),
    source: "synthetic",
  };
}
