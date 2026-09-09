import { parser as javascript } from "@lezer/javascript";
import { parser as python } from "@lezer/python";
import type {
  RepositorySnapshot,
  SourceFile,
  Evidence,
  Signal,
  Classification,
} from "../types";

export function redact(text: string): string {
  return text
    .replace(
      /(?:gh[pousr]_|github_pat_|sk-)[A-Za-z0-9_-]{8,}/g,
      "[REDACTED_TOKEN]",
    )
    .replace(
      /((?:password|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*["'])[^"'\n]+/gi,
      "$1[REDACTED]",
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]");
}
export function evidence(
  repo: RepositorySnapshot,
  file: SourceFile,
  from: number,
  to: number,
): Evidence {
  const start = file.text.slice(0, from).split("\n").length;
  const end = Math.min(start + 4, file.text.slice(0, to).split("\n").length);
  return {
    id: `${file.path}:${start}:${end}`,
    path: file.path,
    line_start: start,
    line_end: end,
    snippet: redact(
      file.text
        .split("\n")
        .slice(start - 1, end)
        .join("\n")
        .slice(0, 800),
    ),
    blob_sha: file.sha,
    source_url:
      repo.source === "github"
        ? `${repo.ref.url}/blob/${repo.commit_sha}/${file.path.split("/").map(encodeURIComponent).join("/")}#L${start}-L${end}`
        : null,
  };
}
export function extractSignals(repo: RepositorySnapshot): Signal[] {
  const out: Signal[] = [];
  for (const file of repo.files) {
    const add = (
      kind: string,
      from: number,
      to: number,
      context: Signal["context"] = "code",
    ) => {
      if (
        !out.some(
          (s) =>
            s.kind === kind &&
            s.evidence.path === file.path &&
            s.evidence.line_start ===
              file.text.slice(0, from).split("\n").length,
        )
      )
        out.push({ kind, evidence: evidence(repo, file, from, to), context });
    };
    if (/\.(py|[cm]?jsx?|tsx?)$/.test(file.path)) {
      const tree = (
        /\.py$/.test(file.path)
          ? python
          : javascript.configure({ dialect: "ts jsx" })
      ).parse(file.text);
      tree.iterate({
        enter(node) {
          if (node.type.isError) add("parse_error", node.from, node.to);
          if (node.name === "CallExpression") {
            const calleeNode = node.node.firstChild;
            const callee = calleeNode
              ? file.text
                  .slice(calleeNode.from, calleeNode.to)
                  .replace(/\s/g, "")
              : "";
            const call = file.text.slice(node.from, node.to);
            const tests: [string, RegExp][] = [
              [
                "network",
                /^(fetch|requests\.(get|post|request)|httpx\.(get|post)|axios\.(get|post))$/,
              ],
              [
                "shell",
                /^(subprocess\.(run|Popen|call)|os\.system|child_process\.(exec|spawn)|exec|execSync|spawn)$/,
              ],
              [
                "filesystem_write",
                /^(fs\.(writeFile|writeFileSync|rm|rmSync|unlink|unlinkSync)|shutil\.rmtree|os\.(remove|unlink)|writeFile|writeFileSync)$/,
              ],
              ["dynamic_eval", /^(eval|Function)$/],
              [
                "logging",
                /^(console\.(log|info|error|warn)|logger\.(info|error|warning|debug)|logging\.(info|error|warning))$/,
              ],
              ["validation", /\.(safeParse|parse|validate)$/],
              [
                "permission_gate",
                /(^|\.)(requireApproval|checkPermission|authorize|require_approval|check_permission)$/,
              ],
              [
                "state_write",
                /(^|\.)(saveState|save_state|checkpoint|transition)$/,
              ],
              ["timeout", /^(AbortSignal\.timeout|asyncio\.wait_for)$/],
              ["backoff", /(^|\.)(backoff|sleep|retryDelay)$/],
              ["test_assert", /^(expect|assert\..+|assertEqual)$/],
              [
                "agent_call",
                /(^|\.)(runAgent|run_agent|invokeTool|invoke_tool|executeTool|execute_tool)$/,
              ],
            ];
            for (const [kind, pattern] of tests)
              if (pattern.test(callee)) add(kind, node.from, node.to);
            if (
              /^(subprocess\.(run|Popen|call))$/.test(callee) &&
              /\bshell\s*=\s*True\b/.test(call)
            )
              add("shell_true", node.from, node.to);
            if (
              /^(console|logger|logging)\./.test(callee) &&
              /\b(trace_id|traceId|request_id|requestId)\b/.test(call)
            )
              add("trace", node.from, node.to);
          }
          if (node.name === "TryStatement")
            add(
              "exception_handling",
              node.from,
              Math.min(node.from + 120, node.to),
            );
          if (
            node.name === "WhileStatement" &&
            /^while\s*(?:\(\s*true\s*\)|True\s*:)/.test(
              file.text.slice(node.from, node.to),
            )
          )
            add(
              "unbounded_loop",
              node.from,
              Math.min(node.from + 100, node.to),
            );
          if (
            node.name === "IfStatement" &&
            /\b(attempt|attempts|retry_count|retryCount)\s*(>=|>|==)/.test(
              file.text.slice(node.from, Math.min(node.to, node.from + 120)),
            )
          )
            add("retry_bound", node.from, Math.min(node.from + 120, node.to));
        },
      });
    } else {
      const lines = file.text.split("\n");
      let offset = 0;
      for (const line of lines) {
        if (
          /^\.github\/workflows\/.+\.ya?ml$/.test(file.path) &&
          !/^\s*#/.test(line)
        ) {
          if (/\b(?:npm (?:ci|install)|pnpm install|pip install)\b/.test(line))
            add("ci_install", offset, offset + line.length, "config");
          if (/\b(?:npm (?:run )?test|pytest|vitest|pnpm test)\b/.test(line))
            add("ci_test", offset, offset + line.length, "config");
          if (/\b(?:typecheck|tsc|mypy|lint|ruff)\b/.test(line))
            add("ci_checks", offset, offset + line.length, "config");
          if (/\b(?:npm audit|pip-audit|codeql|dependency-review)\b/.test(line))
            add("ci_security", offset, offset + line.length, "config");
          if (/permissions:\s*write-all/.test(line))
            add("broad_ci_permission", offset, offset + line.length, "config");
        }
        if (/^(README|SECURITY|LICENSE)(\.|$)/i.test(file.path)) {
          if (
            /^#{1,4}\s+.*(install|quick.?start|usage|getting started)/i.test(
              line,
            )
          )
            add("doc_usage", offset, offset + line.length, "documentation");
          if (/^#{1,4}\s+.*(limit|security|threat|safety|risk)/i.test(line))
            add("doc_limits", offset, offset + line.length, "documentation");
          if (/^#{1,4}\s+.*(architecture|design|workflow)/i.test(line))
            add(
              "doc_architecture",
              offset,
              offset + line.length,
              "documentation",
            );
        }
        offset += line.length + 1;
      }
    }
  }
  return out;
}
export function classify(
  repo: RepositorySnapshot,
  signals: Signal[],
): Classification {
  const agent = signals.filter((s) => s.kind === "agent_call");
  const library = repo.files.find((file) => {
    if (file.path !== "package.json") return false;
    try {
      const manifest: unknown = JSON.parse(file.text);
      return manifest !== null && typeof manifest === "object" && !Array.isArray(manifest) &&
        (Object.hasOwn(manifest, "exports") || Object.hasOwn(manifest, "main"));
    } catch { return false; }
  });
  const code = repo.files.find((f) => /\.(py|[cm]?jsx?|tsx?)$/.test(f.path));
  const research = repo.files.find((f) => /research|paper/i.test(f.path));
  const supporting = library || code || research;
  const supportOffset = library ? Math.max(0, library.text.search(/"(?:exports|main)"\s*:/)) : 0;
  return {
    kind: agent.length
      ? "agentic"
      : library
        ? "library"
        : code
          ? "software"
          : research
            ? "research"
            : "unknown",
    confidence: agent.length ? 0.7 : code ? 0.55 : 0.25,
    evidence: agent.length ? agent.map((s) => s.evidence).slice(0, 5) : supporting ? [evidence(repo, supporting, supportOffset, supportOffset + 100)] : [],
    method:
      "Static call-name, parsed manifest-key and source-filename heuristic, not a runtime or semantic classification. Non-agent evidence identifies the supporting file, not a proof of behavior; no match yields unknown. Ambiguous repositories may be misclassified.",
  };
}
