import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  FileCode2,
  GitBranch,
  CodeXml as Github,
  Link,
  LoaderCircle,
  Search,
  ShieldCheck,
  ShieldAlert,
  X,
} from "lucide-react";
import type { Evidence, JobState, TrustReport } from "./types";
import { WEIGHTS } from "./types";
import "./styles.css";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    signal: init?.signal || AbortSignal.timeout(20_000),
  });
  const data = await response.json();
  if (!response.ok)
    throw Error(
      (data as { error?: string }).error || `HTTP ${response.status}`,
    );
  return data as T;
}
function Proof({ items }: { items: Evidence[] }) {
  return (
    <div className="proofs">
      {items.map((e) => (
        <div className="proof" key={e.id}>
          <div className="proof-title">
            <FileCode2 size={14} />
            {e.source_url ? (
              <a href={e.source_url} target="_blank" rel="noreferrer">
                {e.path}:{e.line_start} <ExternalLink size={12} />
              </a>
            ) : (
              <span>
                {e.path}:{e.line_start} · synthetic
              </span>
            )}
          </div>
          <pre>{e.snippet}</pre>
        </div>
      ))}
    </div>
  );
}
function download(report: TrustReport, format: "json" | "md") {
  const value =
    format === "json"
      ? JSON.stringify(report, null, 2)
      : `# P Trust report: ${report.repository.ref.name}\n\n${report.disclaimer}\n\n- Source: ${report.repository.source}\n- Commit: ${report.repository.commit_sha}\n- Score: ${report.overall_score ?? "Insufficient"} / 100 (${report.grade})\n- Files: ${report.repository.coverage.fetched_files}/${report.repository.coverage.eligible_files} eligible\n- Policy: ${report.policy}\n\n${report.dimensions.map((d) => `## ${d.dimension}: ${d.score ?? "N/A"}\n${d.checks.map((c) => `- ${c.observed ? "Observed" : "Not detected"}: ${c.title}`).join("\n")}`).join("\n\n")}\n\n${report.findings.map((f) => `## ${f.title}\n${f.severity} | ${f.decision}\n\n${f.summary}\n\n${f.evidence.map((e) => `${e.path}:${e.line_start}\n\n\`\`\`\n${e.snippet}\n\`\`\``).join("\n")}\n\nRecommendation: ${f.recommendation}`).join("\n\n")}`;
  const url = URL.createObjectURL(
    new Blob([value], {
      type: format === "json" ? "application/json" : "text/markdown",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `p-trust-${report.repository.ref.name}.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function App() {
  const [repository, setRepository] = useState(
    "https://github.com/pengpengyi92/P-Trust",
  );
  const [job, setJob] = useState<JobState | null>(null);
  const [report, setReport] = useState<TrustReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("Findings");
  const [filter, setFilter] = useState("all");
  const [fixtures, setFixtures] = useState<{ id: string; title: string }[]>([]);
  const [copied, setCopied] = useState(false);
  const [help, setHelp] = useState(false);
  const requestId = useRef(0);
  const polling = useRef<AbortController | null>(null);
  const dialog = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    if (help) dialog.current?.showModal();
  }, [help]);
  async function watch(id: string, run: number) {
    polling.current?.abort();
    const controller = new AbortController();
    polling.current = controller;
    try {
      for (let i = 0; i < 300 && !controller.signal.aborted; i++) {
        const state = await api<JobState>(`/api/jobs/${id}`, {
          signal: controller.signal,
        });
        if (run !== requestId.current) return;
        setJob(state);
        if (state.status === "failed")
          throw Error(state.error?.message || "Scan failed");
        if (state.status === "completed") {
          const result = await api<TrustReport>(`/api/reports/${id}`, {
            signal: controller.signal,
          });
          if (run === requestId.current) {
            setReport(result);
            setBusy(false);
          }
          return;
        }
        await new Promise<void>((resolve) => {
          const done = () => {
            clearTimeout(timer);
            controller.signal.removeEventListener("abort", done);
            resolve();
          };
          const timer = setTimeout(done, 2000);
          controller.signal.addEventListener("abort", done, { once: true });
        });
      }
      if (!controller.signal.aborted)
        throw Error(
          "Polling paused after ten minutes. Reload the report link to reconnect.",
        );
    } catch (e) {
      if (!controller.signal.aborted && run === requestId.current) {
        setError((e as Error).message);
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    api<{ id: string; title: string }[]>("/api/fixtures")
      .then(setFixtures)
      .catch(() => undefined);
    const id = new URLSearchParams(location.search).get("report");
    if (id && /^[a-f0-9]{64}$/.test(id)) {
      setBusy(true);
      void watch(id, ++requestId.current);
    }
    return () => polling.current?.abort();
  }, []);
  async function start(event: React.FormEvent) {
    event.preventDefault();
    const run = ++requestId.current;
    polling.current?.abort();
    setBusy(true);
    setError("");
    setReport(null);
    setJob(null);
    try {
      const data = await api<{ jobId: string }>("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repository }),
      });
      if (run !== requestId.current) return;
      history.replaceState(null, "", `?report=${data.jobId}`);
      await watch(data.jobId, run);
    } catch (e) {
      if (run === requestId.current) {
        setError((e as Error).message);
        setBusy(false);
      }
    }
  }
  async function example(id: string) {
    if (!id) return;
    const run = ++requestId.current;
    polling.current?.abort();
    setBusy(true);
    setError("");
    setJob(null);
    setReport(null);
    try {
      const result = await api<TrustReport>(`/api/fixtures/${id}`);
      if (run === requestId.current) {
        setReport(result);
        setBusy(false);
        history.replaceState(null, "", location.pathname);
      }
    } catch (e) {
      if (run === requestId.current) {
        setError((e as Error).message);
        setBusy(false);
      }
    }
  }
  const findings =
    report?.findings.filter((f) => filter === "all" || f.severity === filter) ||
    [];
  return (
    <>
      <a href="#workspace" className="skip">
        Skip to workspace
      </a>
      <header>
        <a className="brand" href="/">
          <ShieldCheck size={27} />
          <span>
            P Trust<span className="version">v0.1</span>
          </span>
        </a>
        <nav aria-label="Primary">
          <span className="nav-active">Inspect</span>
          <button onClick={() => setHelp(true)}>Methodology</button>
          <a
            href="https://github.com/pengpengyi92/P-Trust"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={17} />
            Source <ExternalLink size={12} />
          </a>
        </nav>
      </header>
      <main id="workspace">
        <section className="intro">
          <div className="eyebrow">
            <span className="status-dot" /> REPOSITORY TRUST LAB
          </div>
          <h1>Evidence before autonomy.</h1>
          <p>
            Inspect a public repository. Understand its permissions, safeguards
            and blind spots.
          </p>
        </section>
        <section className="scan" aria-label="Repository analysis">
          <form onSubmit={start}>
            <label htmlFor="repository">PUBLIC GITHUB REPOSITORY</label>
            <div className="input-row">
              <Github size={21} />
              <input
                id="repository"
                value={repository}
                onChange={(e) => setRepository(e.target.value)}
                placeholder="https://github.com/owner/repository"
                required
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" className="primary" disabled={busy}>
                {busy ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <Search size={17} />
                )}
                <span>{busy ? "Inspecting" : "Inspect repository"}</span>
                <ArrowRight size={17} />
              </button>
            </div>
          </form>
          <div className="scan-meta">
            <span>
              <ShieldCheck size={14} /> Static only · No target execution · No
              GitHub token
            </span>
            <label className="sample">
              Benchmark sample{" "}
              <select
                aria-label="Benchmark sample"
                value=""
                onChange={(e) => void example(e.target.value)}
                disabled={busy}
              >
                <option value="">Choose a fixture</option>
                {fixtures.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="privacy">
            Public reports expire after 24 hours. Up to 16 files / 256 KiB per
            scan. One cached snapshot per repository per UTC hour.
          </p>
        </section>
        {error && (
          <div className="error" role="alert">
            <ShieldAlert size={20} />
            <div>
              <strong>Inspection could not finish</strong>
              <p>{error}</p>
            </div>
            <button
              title="Dismiss error"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {busy && (
          <section className="progress" aria-live="polite">
            <LoaderCircle className="spin" size={20} />
            <div>
              <h2>{job ? job.stage.replaceAll("_", " ") : "Connecting"}</h2>
              <p>
                {job
                  ? `${job.progress.done} / ${job.progress.total} in current stage`
                  : "Creating a persistent inspection job"}
              </p>
              {job?.error && (
                <p>
                  {job.error.message} · retry {job.attempt}/3
                </p>
              )}
            </div>
            {job && (
              <div className="stage-history">
                {job.history.map((h, i) => (
                  <span key={i}>{h.stage}</span>
                ))}
              </div>
            )}
          </section>
        )}
        {report ? (
          <section className="report" aria-label="Trust report">
            <div className="report-top">
              <div>
                <div className="eyebrow">
                  {report.repository.source === "synthetic"
                    ? "SYNTHETIC BENCHMARK · NOT A REAL REPOSITORY"
                    : "PUBLIC REPOSITORY SNAPSHOT"}
                </div>
                <h2>
                  {report.repository.ref.owner}
                  <span> / </span>
                  {report.repository.ref.name}
                </h2>
                <div className="metadata">
                  <span>
                    <GitBranch size={14} />
                    {report.repository.source === "synthetic"
                      ? "fixture"
                      : report.repository.commit_sha.slice(0, 12)}
                  </span>
                  <span>{report.classification.kind}</span>
                  <span>{new Date(report.created_at).toLocaleString()}</span>
                </div>
              </div>
              <div className="tools">
                <button
                  title="Download JSON"
                  aria-label="Download JSON"
                  onClick={() => download(report, "json")}
                >
                  <Download size={16} />
                  JSON
                </button>
                <button
                  title="Download Markdown"
                  aria-label="Download Markdown"
                  onClick={() => download(report, "md")}
                >
                  <Download size={16} />
                  MD
                </button>
                {report.repository.source === "github" && (
                  <button
                    title="Copy report link"
                    aria-label="Copy report link"
                    onClick={() => {
                      navigator.clipboard
                        .writeText(location.href)
                        .then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        })
                        .catch(() =>
                          setError(
                            "Clipboard unavailable. The address bar contains the report URL.",
                          ),
                        );
                    }}
                  >
                    {copied ? <Check size={16} /> : <Link size={16} />}
                  </button>
                )}
              </div>
            </div>
            <div className="score-band">
              <div className="main-score">
                <span>OBSERVED TRUST SCORE</span>
                <div>
                  <strong>{report.overall_score ?? "—"}</strong>
                  <span>/100</span>
                  <b>{report.grade}</b>
                </div>
                <small>Heuristic evidence, not certification</small>
              </div>
              <div className="metric">
                <span>SCAN COVERAGE</span>
                <strong>
                  {report.repository.coverage.fetched_files}
                  <small>
                    {" "}
                    / {report.repository.coverage.eligible_files} eligible files
                  </small>
                </strong>
                <span>
                  {report.repository.coverage.bytes.toLocaleString()} bytes
                  inspected
                </span>
              </div>
              <div className="metric">
                <span>HEURISTIC CONFIDENCE</span>
                <strong>
                  {Math.round(report.confidence * 100)}
                  <small>% · uncalibrated</small>
                </strong>
                <span>{report.findings.length} review signals</span>
              </div>
              <img
                className="report-mascot"
                src="/trust-researcher.png"
                alt="P Trust researcher reviewing code evidence"
              />
            </div>
            <p className="disclaimer">
              <ShieldAlert size={15} />
              {report.disclaimer}
            </p>
            <div className="dimensions">
              {report.dimensions.map((d) => (
                <details key={d.dimension} name="dimension-breakdown">
                  <summary>
                    <span>{d.dimension}</span>
                    <b>{d.applicable ? (d.score ?? "N/A") : "N/A"}</b>
                    <ChevronDown size={13} />
                  </summary>
                  <div className="dimension-detail">
                    <p>
                      Weight {WEIGHTS[d.dimension]} · Presence does not prove
                      effectiveness.
                    </p>
                    {d.checks.map((c) => (
                      <div key={c.id} className="check">
                        <span className={c.observed ? "observed" : "muted"}>
                          {c.observed ? "Observed" : "Not detected"} · {c.title}
                        </span>
                        {c.observed && <Proof items={c.evidence} />}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
            <div className="tabs" role="tablist" aria-label="Report views">
              {["Findings", "Permissions", "Trajectory", "Coverage"].map(
                (t) => (
                  <button
                    key={t}
                    id={`tab-${t}`}
                    role="tab"
                    aria-selected={t === tab}
                    aria-controls="report-panel"
                    tabIndex={t === tab ? 0 : -1}
                    onKeyDown={(e) => {
                      const views = ['Findings', 'Permissions', 'Trajectory', 'Coverage'];
                      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
                      e.preventDefault();
                      const next = e.key === 'Home' ? views[0] : e.key === 'End' ? views[3] : views[(views.indexOf(t) + (e.key === 'ArrowRight' ? 1 : 3)) % 4];
                      setTab(next); document.getElementById(`tab-${next}`)?.focus();
                    }}
                    onClick={() => setTab(t)}
                  >
                    {t}
                    {t === "Findings" && <span>{report.findings.length}</span>}
                  </button>
                ),
              )}
            </div>
            <div
              id="report-panel"
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
            >
              {tab === "Findings" && (
                <>
                  <div className="list-heading">
                    <h3>Review signals</h3>
                    <label>
                      Severity{" "}
                      <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        {[
                          "all",
                          "critical",
                          "high",
                          "medium",
                          "low",
                          "info",
                        ].map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {findings.length ? (
                    findings.map((f) => (
                      <details className="finding" key={f.id}>
                        <summary>
                          <span className={`severity ${f.severity}`}>
                            {f.severity}
                          </span>
                          <strong>{f.title}</strong>
                          <span className="decision">
                            {f.decision.replaceAll("_", " ")}
                          </span>
                          <ChevronDown size={16} />
                        </summary>
                        <div className="finding-body">
                          <p>{f.summary}</p>
                          <h4>Evidence</h4>
                          <Proof items={f.evidence} />
                          <h4>Why review this</h4>
                          <p>{f.why_it_matters}</p>
                          <h4>Next action</h4>
                          <p>{f.recommendation}</p>
                        </div>
                      </details>
                    ))
                  ) : (
                    <div className="empty-small">
                      <Check size={22} />
                      <p>
                        No matching review signals. This does not establish that
                        the repository is safe.
                      </p>
                    </div>
                  )}
                </>
              )}
              {tab === "Permissions" &&
                report.permission_map.map((p) => (
                  <details className="finding" key={p.capability}>
                    <summary>
                      <strong>{p.capability.replaceAll("_", " ")}</strong>
                      <span>{p.status}</span>
                      <ChevronDown size={16} />
                    </summary>
                    <Proof items={p.evidence} />
                  </details>
                ))}
              {tab === "Trajectory" && (
                <>
                  <p className="note">
                    Static stage evidence, not a reconstructed runtime trace.
                    Ordering and enforcement have not been verified.
                  </p>
                  {report.trajectory.map((t) => (
                    <details className="finding" key={t.stage}>
                      <summary>
                        <strong>{t.stage}</strong>
                        <span>{t.status.replaceAll("_", " ")}</span>
                        <ChevronDown size={16} />
                      </summary>
                      <Proof items={t.evidence} />
                    </details>
                  ))}
                </>
              )}
              {tab === "Coverage" && (
                <div className="coverage">
                  <h3>What this inspection can establish</h3>
                  <p>{report.classification.method}</p>
                  <Proof items={report.classification.evidence} />
                  <ul>
                    {report.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                  <p>
                    {report.interpretation.summary}{" "}
                    {report.interpretation.limitation}
                  </p>
                  <h3>Skipped files</h3>
                  {report.repository.coverage.skipped.length ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Path</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.repository.coverage.skipped.map((s, i) => (
                          <tr key={i}>
                            <td>{s.path}</td>
                            <td>{s.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p>No skipped files recorded.</p>
                  )}
                </div>
              )}
            </div>
          </section>
        ) : (
          !busy && (
            <section className="welcome">
              <div className="welcome-main">
                <div className="eyebrow">INSPECTION WORKSPACE</div>
                <h2>
                  What can this code do?
                  <br />
                  What keeps it in bounds?
                </h2>
                <div className="scope-list">
                  <span>
                    <ShieldCheck />
                    Permissions & security
                  </span>
                  <span>
                    <GitBranch />
                    Trajectory & recovery
                  </span>
                  <span>
                    <FileCode2 />
                    Tests & observability
                  </span>
                </div>
                <button
                  className="text-command"
                  onClick={() => void example("over-permissioned-agent")}
                >
                  Open an evidence-backed example <ArrowRight size={17} />
                </button>
              </div>
              <img
                src="/trust-researcher.png"
                alt="P Trust researcher inspecting a shield and a code evidence clipboard"
              />
            </section>
          )
        )}
        <footer>
          <span>P Trust · Research-driven agent trust</span>
          <span>Policy {report?.policy || "static-evidence-2026-09-09.1"}</span>
          <a
            href="https://github.com/pengpengyi92/P-Trust/issues"
            target="_blank"
            rel="noreferrer"
          >
            Report a false positive <ExternalLink size={12} />
          </a>
        </footer>
      </main>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <dialog
            ref={dialog}
            aria-labelledby="method-title"
            onCancel={() => setHelp(false)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setHelp(false);
            }}
          >
            <button
              className="close"
              autoFocus
              title="Close methodology"
              aria-label="Close methodology"
              onClick={() => setHelp(false)}
            >
              <X />
            </button>
            <h2 id="method-title">Evidence, not a verdict.</h2>
            <p>
              P Trust reads a pinned public GitHub snapshot. It never installs
              dependencies or executes repository code.
            </p>
            <p>
              Seven rule-based analyzers assign points for observed patterns.
              Inapplicable agent-trajectory weights are redistributed. High-risk
              static patterns deduct points. Missing evidence receives no
              points.
            </p>
            <p>
              Scores and confidence are heuristic and gameable, not calibrated
              safety probabilities. Human review is required before granting
              permissions.
            </p>
            <a
              href="https://github.com/pengpengyi92/P-Trust/blob/main/docs/scoring.md"
              target="_blank"
              rel="noreferrer"
            >
              Read the scoring protocol <ExternalLink size={14} />
            </a>
          </dialog>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
