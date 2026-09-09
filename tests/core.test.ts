import { describe, expect, it } from "vitest";
import {
  GitHubReader,
  LIMITS,
  boundedText,
  parseRepository,
  selectFiles,
} from "../src/core/github";
import { extractSignals, redact } from "../src/core/signals";
import { scanSnapshot, validateInterpretation } from "../src/core/report";
import { fixtureSnapshot, fixtures } from "../src/fixtures";
import { advance, type Work } from "../src/core/job";
import type { JobState } from "../src/types";

describe("public URL boundary", () => {
  it("normalizes supported URLs", () =>
    expect(parseRepository("https://github.com/example/repo.git/").name).toBe(
      "repo",
    ));
  it.each([
    "http://github.com/a/b",
    "https://evil.com/a/b",
    "https://github.com@evil.com/a/b",
    "https://u:p@github.com/a/b",
    "https://github.com/a/b?token=x",
    "https://github.com/a/b#x",
    "https://github.com/a/../b",
    "https://github.com/a/%2e%2e",
    "https://github.com/a/.git",
    "file:///etc/passwd",
    "https://127.0.0.1/a/b",
  ])("rejects %s", (url) => expect(() => parseRepository(url)).toThrow());
  it("does not follow symlinks or sensitive/vendor paths", () => {
    const entries = [
      "agent.ts",
      "../bad.ts",
      ".env",
      "node_modules/a.ts",
      "fixtures/bad.ts",
      "private.key",
      "link.py",
      "large.py",
    ].map((path) => ({
      path,
      mode: path === "link.py" ? "120000" : "100644",
      type: "blob",
      size: path === "large.py" ? LIMITS.fileBytes + 1 : 20,
      sha: "a".repeat(40),
    }));
    expect(selectFiles(entries).selected.map((e) => e.path)).toEqual([
      "agent.ts",
    ]);
  });
  it("bounds chunked responses, not just content-length", async () => {
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array(11));
        c.close();
      },
    });
    await expect(boundedText(new Response(stream), 10)).rejects.toThrow(
      "limit",
    );
  });
  it("uses fixed API host, no authorization and no redirects", async () => {
    const reader = new GitHubReader(async (url, init) => {
      expect(String(url).startsWith("https://api.github.com/repos/a/b")).toBe(
        true,
      );
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
        expect(init?.redirect).toBe("manual");
      return new Response("{}", { status: 404 });
    });
    await expect(
      reader.metadata(parseRepository("https://github.com/a/b")),
    ).rejects.toMatchObject({ code: "NOT_PUBLIC_OR_NOT_FOUND" });
  });
  it("surfaces upstream quota without leaking response body", async () => {
    const reader = new GitHubReader(
      async () => new Response("secret detail", { status: 403 }),
    );
    await expect(
      reader.metadata(parseRepository("https://github.com/a/b")),
    ).rejects.toMatchObject({ code: "UPSTREAM_RATE_LIMIT", retryAfter: 3600 });
  });
  it("refuses private repository metadata", async () => {
    const reader = new GitHubReader(async () =>
      Response.json({ private: true, description: "", default_branch: "main" }),
    );
    await expect(
      reader.metadata(parseRepository("https://github.com/a/b")),
    ).rejects.toMatchObject({ code: "PRIVATE_REPOSITORY" });
  });
});
describe("evidence and trust boundaries", () => {
  it.each(Object.keys(fixtures))(
    "%s has seven analyzers and exact source evidence",
    async (id) => {
      const fixture = fixtureSnapshot(id);
      const report = await scanSnapshot(fixture, id);
      expect(report.dimensions).toHaveLength(7);
      expect(report.overall_score).toBeGreaterThanOrEqual(0);
      expect(report.overall_score).toBeLessThanOrEqual(100);
      for (const f of report.findings)
        for (const e of f.evidence) {
          const file = fixture.files.find((f) => f.path === e.path)!;
          expect(e.snippet).toBe(
            redact(
              file.text
                .split("\n")
                .slice(e.line_start - 1, e.line_end)
                .join("\n")
                .slice(0, 800),
            ),
          );
          expect(e.source_url).toBeNull();
          expect(e.line_start).toBeGreaterThan(0);
        }
    },
  );
  it("safe patterns outperform the over-permissioned fixture", async () => {
    const safe = await scanSnapshot(fixtureSnapshot("safe-agent"), "a");
    const broad = await scanSnapshot(
      fixtureSnapshot("over-permissioned-agent"),
      "b",
    );
    expect(safe.overall_score!).toBeGreaterThan(broad.overall_score!);
    expect(broad.findings.map((f) => f.id)).toContain("security:shell_true");
    expect(broad.findings.every((f) => f.decision !== "block")).toBe(true);
  });
  it("ignores security keywords in comments and ordinary strings", () => {
    const f = fixtureSnapshot("unsafe-filesystem-agent");
    f.files[0].text =
      '// requireApproval(x); fs.rm(path)\nconst example="eval(input); runAgent(); logger.info(trace_id)";';
    expect(extractSignals(f)).toEqual([]);
  });
  it("README prose cannot create runtime safeguards", async () => {
    const f = fixtureSnapshot("weak-ci-project");
    f.files.find((f) => f.path === "README.md")!.text +=
      "\nrequireApproval(x); logger.info(trace_id); runAgent();";
    expect(extractSignals(f).some((s) => s.context === "code")).toBe(false);
    expect((await scanSnapshot(f, "r")).classification.kind).toBe("software");
  });
  it("identifies filesystem and loop review signals", async () => {
    expect(
      (
        await scanSnapshot(fixtureSnapshot("unsafe-filesystem-agent"), "f")
      ).findings.map((f) => f.id),
    ).toContain("permissions:filesystem_write");
    expect(
      (
        await scanSnapshot(fixtureSnapshot("retry-loop-agent"), "r")
      ).findings.map((f) => f.id),
    ).toContain("recovery:unbounded_loop");
  });
  it("no files means insufficient evidence, not perfect trust", async () => {
    const f = fixtureSnapshot("safe-agent");
    f.files = [];
    f.coverage.fetched_files = 0;
    expect((await scanSnapshot(f, "empty")).grade).toBe("INSUFFICIENT");
  });
  it("redacts token and email patterns", () => {
    expect(
      redact('secret = "example-secret"; email="test@example.com"'),
    ).not.toContain("example-secret");
    expect(redact('email="test@example.com"')).not.toContain(
      "test@example.com",
    );
  });
  it("rejects model-invented claims, locations and ids", async () => {
    const r = await scanSnapshot(
      fixtureSnapshot("over-permissioned-agent"),
      "r",
    );
    for (const value of [
      { finding_order: ["invented"] },
      { finding_order: r.findings.map((f) => f.id), claim: "malware" },
      { finding_order: [] },
    ])
      expect(validateInterpretation(value, r).status).toBe("rejected");
    expect(
      validateInterpretation(
        { finding_order: r.findings.map((f) => f.id).reverse() },
        r,
      ).status,
    ).toBe("validated");
  });
  it("marks incomplete trees and partial samples", async () => {
    const f = fixtureSnapshot("safe-agent");
    f.coverage.truncated_tree = true;
    f.coverage.eligible_files = 100;
    const r = await scanSnapshot(f, "r");
    expect(r.warnings.some((w) => w.includes("truncated"))).toBe(true);
    expect(r.confidence).toBeLessThan(0.4);
  });
});
describe("resumable job pipeline", () => {
  it("runs all persisted stages against a mock public GitHub transport", async () => {
    const fixture = fixtureSnapshot("safe-agent");
    let calls = 0;
    const reader = new GitHubReader(async (url) => {
      calls++;
      const u = String(url);
      if (u.endsWith("/repos/a/b"))
        return Response.json({
          private: false,
          default_branch: "main",
          description: "Fixture",
        });
      if (u.includes("/commits/"))
        return Response.json({
          sha: "a".repeat(40),
          commit: { tree: { sha: "b".repeat(40) } },
        });
      if (u.includes("/trees/"))
        return Response.json({
          truncated: false,
          tree: fixture.tree.map((e, i) => ({
            ...e,
            sha: i.toString(16).padStart(40, "0"),
          })),
        });
      const i = parseInt(u.split("/").at(-1)!, 16);
      const text = fixture.files[i].text;
      return Response.json({
        encoding: "base64",
        size: text.length,
        content: btoa(text),
      });
    });
    let job = {
      id: "r",
      ref: parseRepository("https://github.com/a/b"),
      stage: "queued",
      status: "running",
      progress: { done: 0, total: 1 },
    } as JobState;
    let work: Work | undefined;
    let report;
    for (let i = 0; i < 30; i++) {
      const result = await advance(job, work, reader);
      work = result.work;
      report = result.report;
      if (report) break;
      job = JSON.parse(JSON.stringify(job));
      work = JSON.parse(JSON.stringify(work ?? null)) || undefined;
    }
    expect(job.status).toBe("completed");
    expect(report?.dimensions).toHaveLength(7);
    expect(report?.repository.commit_sha).toBe("a".repeat(40));
    expect(calls).toBe(fixture.files.length + 3);
  });
});
