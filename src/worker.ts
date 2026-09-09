import { DurableObject } from "cloudflare:workers";
import { z } from "zod";
import {
  GitHubReader,
  LIMITS,
  ScanError,
  boundedText,
  parseRepository,
} from "./core/github";
import { advance, type Work } from "./core/job";
import { scanSnapshot, validateInterpretation } from "./core/report";
import { fixtures, fixtureSnapshot } from "./fixtures";
import type { JobState, RepoRef, TrustReport } from "./types";

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export class ScanBudget extends DurableObject<Env> {
  async take(): Promise<boolean> {
    const hour = Math.floor(Date.now() / 3_600_000);
    return this.ctx.storage.transaction(async (tx) => {
      const old = await tx.get<{ hour: number; count: number }>("quota");
      const count = old?.hour === hour ? old.count : 0;
      if (count >= 57) return false;
      await tx.put("quota", { hour, count: count + 1 });
      return true;
    });
  }
}
export class AnalysisJob extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    );
  }
  private read<T>(key: string): T | undefined {
    const row = this.ctx.storage.sql
      .exec<{ value: string }>("SELECT value FROM records WHERE key = ?", key)
      .toArray()[0];
    return row ? JSON.parse(row.value) : undefined;
  }
  private put(key: string, value: unknown) {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO records (key,value) VALUES (?,?)",
      key,
      JSON.stringify(value),
    );
  }
  async initialize(id: string, ref: RepoRef) {
    const existing = this.read<JobState>("job");
    if (existing && existing.status !== "failed") {
      if (!(await this.ctx.storage.getAlarm()))
        await this.ctx.storage.setAlarm(Date.now() + 100);
      return existing;
    }
    const now = new Date().toISOString();
    const job: JobState = {
      id,
      ref,
      stage: "queued",
      status: "queued",
      created_at: now,
      updated_at: now,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      attempt: 0,
      error: null,
      progress: { done: 0, total: 1 },
      history: [{ stage: "queued", at: now }],
    };
    this.put("job", job);
    await this.ctx.storage.setAlarm(Date.now() + 100);
    return job;
  }
  async status() {
    const job = this.read<JobState>("job");
    return job && Date.parse(job.expires_at) > Date.now() ? job : null;
  }
  async report() {
    return (await this.status())
      ? this.read<TrustReport>("report") || null
      : null;
  }
  async alarm() {
    const job = this.read<JobState>("job");
    if (!job) return;
    if (Date.now() >= Date.parse(job.expires_at)) {
      await this.ctx.storage.deleteAll();
      return;
    }
    if (job.status === "completed" || job.status === "failed") {
      await this.ctx.storage.setAlarm(Date.parse(job.expires_at));
      return;
    }
    const startStage = job.stage;
    try {
      if (Date.now() - Date.parse(job.created_at) > 600_000)
        throw new ScanError(
          "JOB_TIMEOUT",
          "The scan exceeded the ten-minute job deadline.",
        );
      job.status = "running";
      const reader = new GitHubReader(async (input, init) => {
        if (
          !(await this.env.BUDGET.get(
            this.env.BUDGET.idFromName("github-anonymous-hourly"),
          ).take())
        )
          throw new ScanError(
            "SERVICE_QUOTA",
            "The public service reached its conservative GitHub budget. Try next hour; synthetic examples remain available.",
            3600,
          );
        return fetch(input, init);
      });
      const result = await advance(job, this.read<Work>("work"), reader);
      if (result.report) {
        const report = result.report;
        if (
          String(this.env.AI_INTERPRETATION) === "true" &&
          report.findings.length
        ) {
          try {
            const result = await this.env.AI.run(
              "@cf/meta/llama-3.1-8b-instruct",
              {
                messages: [
                  {
                    role: "system",
                    content:
                      'Return JSON only: {"finding_order":[all supplied ids ordered by importance]}. Never add claims or ids.',
                  },
                  {
                    role: "user",
                    content: JSON.stringify(
                      report.findings.map((f) => ({
                        id: f.id,
                        severity: f.severity,
                        decision: f.decision,
                      })),
                    ),
                  },
                ],
                max_tokens: 300,
              },
            );
            report.interpretation = validateInterpretation(
              JSON.parse("response" in result ? String(result.response) : "{}"),
              report,
            );
          } catch {
            report.interpretation = {
              ...report.interpretation,
              status: "unavailable",
              limitation:
                "Optional interpretation unavailable; deterministic evidence preserved.",
            };
          }
        }
        this.put("report", report);
        this.put("findings", report.findings);
        this.ctx.storage.sql.exec("DELETE FROM records WHERE key = 'work'");
      } else if (result.work) this.put("work", result.work);
      job.attempt = 0;
      job.error = null;
      job.updated_at = new Date().toISOString();
      if (startStage !== job.stage)
        job.history.push({ stage: job.stage, at: job.updated_at });
      this.put("job", job);
      console.log(
        JSON.stringify({
          event: "scan_stage",
          job_id: job.id,
          stage: job.stage,
          done: job.progress.done,
        }),
      );
      await this.ctx.storage.setAlarm(
        result.report ? Date.parse(job.expires_at) : Date.now() + 200,
      );
    } catch (error) {
      const known =
        error instanceof ScanError
          ? error
          : new ScanError(
              "SCAN_FAILURE",
              "Upstream response or parsing failed. No target code was executed.",
              10,
            );
      job.attempt++;
      job.updated_at = new Date().toISOString();
      const retry =
        known.retryAfter !== null && known.retryAfter < 60 && job.attempt < 3;
      job.error = {
        code: known.code,
        message: known.message,
        retry_after: known.retryAfter,
      };
      if (!retry) {
        job.status = "failed";
        job.stage = "failed";
        this.ctx.storage.sql.exec("DELETE FROM records WHERE key = 'work'");
      }
      this.put("job", job);
      console.warn(
        JSON.stringify({
          event: "scan_failure",
          job_id: job.id,
          code: known.code,
          attempt: job.attempt,
          error_type: error instanceof Error ? error.name : typeof error,
          error_detail: error instanceof Error ? error.message.slice(0, 240) : "unknown",
        }),
      );
      await this.ctx.storage.setAlarm(
        retry
          ? Date.now() + (known.retryAfter || 10) * job.attempt * 1000
          : Date.parse(job.expires_at),
      );
    }
  }
}
async function digest(value: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/health")
        return json({
          status: "ok",
          version: "0.1.0",
          mode: "public-static-only",
          ai: String(env.AI_INTERPRETATION) === "true",
          limits: LIMITS,
        });
      if (url.pathname === "/api/fixtures" && request.method === "GET")
        return json(
          Object.entries(fixtures).map(([id, f]) => ({ id, title: f.title })),
        );
      if (
        url.pathname.startsWith("/api/fixtures/") &&
        request.method === "GET"
      ) {
        const id = url.pathname.split("/").at(-1)!;
        if (!Object.hasOwn(fixtures, id))
          return json({ error: "Fixture not found" }, 404);
        return json(await scanSnapshot(fixtureSnapshot(id), `fixture-${id}`));
      }
      if (url.pathname === "/api/analyze" && request.method === "POST") {
        if (
          request.headers.get("origin") &&
          request.headers.get("origin") !== url.origin
        )
          return json({ error: "Same-origin requests only" }, 403);
        if (
          !request.headers.get("content-type")?.startsWith("application/json")
        )
          return json({ error: "JSON required" }, 415);
        const limited = await env.SCAN_LIMIT.limit({
          key: request.headers.get("CF-Connecting-IP") || "local",
        });
        if (!limited.success)
          return json(
            { error: "Too many scan requests. Retry in one minute." },
            429,
          );
        const body = z
          .object({ repository: z.string().max(250) })
          .strict()
          .parse(
            JSON.parse(await boundedText(new Response(request.body), 2048)),
          );
        const ref = parseRepository(body.repository);
        const id = await digest(
          `${ref.url.toLowerCase()}:${Math.floor(Date.now() / 3_600_000)}`,
        );
        const job = await env.ANALYSES.get(
          env.ANALYSES.idFromName(id),
        ).initialize(id, ref);
        return json(
          {
            jobId: job.id,
            status: job.status,
            cache:
              "Same repository reuses the first snapshot in this UTC hour; reports expire after 24 hours.",
          },
          202,
        );
      }
      const match = /^\/api\/(jobs|reports)\/([a-f0-9]{64})$/.exec(
        url.pathname,
      );
      if (match && request.method === "GET") {
        const stub = env.ANALYSES.get(env.ANALYSES.idFromName(match[2]));
        const result =
          match[1] === "jobs" ? await stub.status() : await stub.report();
        return result
          ? json(result)
          : json({ error: "Not found, not ready, or expired" }, 404);
      }
      if (url.pathname.startsWith("/api/"))
        return json({ error: "Not found" }, 404);
      const asset = await env.ASSETS.fetch(request);
      const response = new Response(asset.body, asset);
      response.headers.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      );
      response.headers.set("Referrer-Policy", "no-referrer");
      response.headers.set("X-Content-Type-Options", "nosniff");
      return response;
    } catch (error) {
      return json(
        {
          error:
            error instanceof ScanError
              ? error.message
              : "Invalid request or service unavailable",
        },
        error instanceof ScanError ||
          error instanceof z.ZodError ||
          error instanceof SyntaxError
          ? 400
          : 503,
      );
    }
  },
} satisfies ExportedHandler<Env>;
