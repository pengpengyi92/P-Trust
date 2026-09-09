import type {
  AnalyzerContext,
  AnalyzerResult,
  Dimension,
  TrustAnalyzer,
  TrustFinding,
} from "../types";

const checks: Record<Dimension, [string, string, number][]> = {
  security: [
    ["validation", "Input validation call", 40],
    ["ci_security", "Security check in CI", 30],
    ["doc_limits", "Documented safety limitations", 30],
  ],
  permissions: [
    ["permission_gate", "Explicit permission or approval check", 70],
    ["doc_limits", "Documented permission boundary", 30],
  ],
  trajectory: [
    ["agent_call", "Agent or tool invocation", 20],
    ["state_write", "State persistence or transition call", 40],
    ["permission_gate", "Approval checkpoint", 20],
    ["trace", "Correlated event logging", 20],
  ],
  observability: [
    ["logging", "Structured logging candidate", 30],
    ["trace", "Trace or request identifier", 50],
    ["exception_handling", "Exception handling syntax", 20],
  ],
  ci: [
    ["ci_install", "Dependency installation", 20],
    ["ci_test", "Automated tests", 40],
    ["ci_checks", "Type or lint checks", 20],
    ["test_assert", "Assertions in source", 20],
  ],
  recovery: [
    ["exception_handling", "Exception handling", 30],
    ["timeout", "Explicit timeout", 30],
    ["retry_bound", "Retry-count boundary", 25],
    ["backoff", "Backoff or sleep call", 15],
  ],
  documentation: [
    ["doc_usage", "Installation or usage section", 40],
    ["doc_limits", "Limitations or security section", 35],
    ["doc_architecture", "Architecture section", 25],
  ],
};
function finding(
  ctx: AnalyzerContext,
  dimension: Dimension,
  kind: string,
  title: string,
  severity: TrustFinding["severity"],
  decision: TrustFinding["decision"],
  why: string,
  recommendation: string,
): TrustFinding | null {
  const matches = ctx.signals.filter((s) => s.kind === kind);
  if (!matches.length) return null;
  return {
    id: `${dimension}:${kind}`,
    title,
    category: dimension,
    severity,
    decision,
    summary: `${matches.length} static occurrence(s) found in the sampled files. This is a review signal, not proof of exploitation or malicious intent.`,
    evidence: matches.slice(0, 8).map((s) => s.evidence),
    why_it_matters: why,
    recommendation,
    confidence: 0.8,
  };
}
export function analyzeDimension(
  dimension: Dimension,
  ctx: AnalyzerContext,
): AnalyzerResult {
  const applicable =
    dimension !== "trajectory" || ctx.classification.kind === "agentic";
  const evaluated = checks[dimension].map(([kind, title, points]) => {
    const hits = ctx.signals.filter(
      (s) =>
        s.kind === kind &&
        (kind !== "test_assert" || /test|spec/i.test(s.evidence.path)),
    );
    return {
      id: kind,
      title,
      observed: hits.length > 0,
      evidence: hits.slice(0, 4).map((s) => s.evidence),
      points,
      meaning:
        "Presence only; effectiveness, reachability and branch coverage remain unverified.",
    };
  });
  const findings: TrustFinding[] = [];
  const add = (
    ...args: Parameters<typeof finding> extends [
      AnalyzerContext,
      Dimension,
      ...infer T,
    ]
      ? T
      : never
  ) => {
    const f = finding(ctx, dimension, ...args);
    if (f) findings.push(f);
  };
  if (dimension === "security") {
    add(
      "dynamic_eval",
      "Dynamic code evaluation",
      "high",
      "approval_required",
      "Dynamic evaluation expands the code-execution boundary.",
      "Trace the input provenance and replace dynamic evaluation with a bounded parser where possible.",
    );
    add(
      "shell_true",
      "Shell interpretation enabled",
      "high",
      "approval_required",
      "Shell metacharacters may be interpreted when constructing commands.",
      "Prefer argument arrays with shell=False; test untrusted-input cases and apply an execution allowlist.",
    );
  }
  if (dimension === "permissions") {
    add(
      "filesystem_write",
      "Filesystem mutation capability",
      "medium",
      "approval_required",
      "A write or deletion API may affect persistent data.",
      "Verify the resolved target stays inside an approved workspace, require approval for destructive operations, and test traversal and symlink cases.",
    );
    add(
      "shell",
      "Subprocess capability",
      "medium",
      "approval_required",
      "Processes inherit environmental permissions unless constrained.",
      "Review command allowlists, environment isolation, timeout, output size and user approval.",
    );
    add(
      "network",
      "Outbound network capability",
      "low",
      "warn",
      "Network calls cross a data boundary; static detection cannot establish destination safety.",
      "Review host allowlists, redirects, credential scope and data redaction.",
    );
    add(
      "broad_ci_permission",
      "Workflow requests write-all",
      "high",
      "approval_required",
      "Broad workflow token permissions increase CI impact.",
      "Declare job-level least-privilege permissions and isolate untrusted pull requests.",
    );
  }
  if (dimension === "recovery")
    add(
      "unbounded_loop",
      "Continuous loop needs exit-path review",
      "medium",
      "warn",
      "A continuous loop may be intentional but termination and resource bounds are not proved.",
      "Test cancellation, retry exhaustion and failure recovery; inspect control flow before treating this as a defect.",
    );
  const coverage = ctx.repository.coverage;
  const fraction = coverage.eligible_files
    ? Math.min(1, coverage.fetched_files / coverage.eligible_files)
    : 0;
  const score =
    applicable && coverage.fetched_files
      ? Math.max(
          0,
          evaluated
            .filter((c) => c.observed)
            .reduce((n, c) => n + c.points, 0) -
            findings.filter((f) => f.severity === "high").length * 15,
        )
      : null;
  return {
    dimension,
    score,
    applicable,
    confidence: coverage.fetched_files
      ? Math.round(
          (0.3 + fraction * 0.4) * (coverage.truncated_tree ? 0.5 : 1) * 100,
        ) / 100
      : 0,
    checks: evaluated,
    findings,
    strengths: evaluated.filter((c) => c.observed).map((c) => c.title),
    limitations: [
      "Sampled static evidence only. Absence means not detected, not necessarily absent.",
      "Named calls can be aliases, stubs or unused code; no control/data-flow proof.",
      ...(applicable
        ? []
        : [
            "Agent trajectory is not applicable under the current heuristic classification.",
          ]),
    ],
  };
}
export const analyzers: TrustAnalyzer[] = (
  Object.keys(checks) as Dimension[]
).map((dimension) => ({
  name: dimension,
  analyze: async (ctx) => analyzeDimension(dimension, ctx),
}));
