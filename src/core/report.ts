import {
  WEIGHTS,
  VERSION,
  POLICY,
  type AnalyzerResult,
  type RepositorySnapshot,
  type TrustReport,
  type Classification,
  type Signal,
  type Interpretation,
} from "../types";
import { extractSignals, classify } from "./signals";
import { analyzers } from "../analyzers";
export function assemble(
  id: string,
  repository: RepositorySnapshot,
  classification: Classification,
  signals: Signal[],
  dimensions: AnalyzerResult[],
): TrustReport {
  const applicable = dimensions.filter((d) => d.applicable && d.score !== null);
  const weights = applicable.reduce((n, d) => n + WEIGHTS[d.dimension], 0);
  const overall = weights
    ? Math.round(
        applicable.reduce(
          (n, d) => n + (d.score || 0) * WEIGHTS[d.dimension],
          0,
        ) / weights,
      )
    : null;
  const { files: _files, tree: _tree, ...repo } = repository;
  const findings = dimensions.flatMap((d) => d.findings);
  return {
    id,
    version: VERSION,
    policy: POLICY,
    repository: repo,
    classification,
    overall_score: overall,
    grade:
      overall === null
        ? "INSUFFICIENT"
        : overall >= 90
          ? "A"
          : overall >= 80
            ? "B"
            : overall >= 70
              ? "C"
              : overall >= 60
                ? "D"
                : "F",
    confidence: dimensions.length
      ? Math.round(
          (dimensions.reduce((n, d) => n + d.confidence, 0) /
            dimensions.length) *
            100,
        ) / 100
      : 0,
    dimensions,
    findings,
    permission_map: [
      "network",
      "shell",
      "filesystem_write",
      "dynamic_eval",
    ].map((capability) => ({
      capability,
      status: signals.some((s) => s.kind === capability)
        ? "observed; review required"
        : "not detected in sample",
      evidence: signals
        .filter((s) => s.kind === capability)
        .slice(0, 6)
        .map((s) => s.evidence),
    })),
    trajectory: [
      ["Input validation", "validation"],
      ["Tool invocation", "agent_call"],
      ["Approval", "permission_gate"],
      ["State transition", "state_write"],
      ["Observation", "trace"],
      ["Recovery", "exception_handling"],
    ].map(([stage, kind]) => ({
      stage,
      status:
        classification.kind !== "agentic"
          ? "not_applicable"
          : signals.some((s) => s.kind === kind)
            ? "observed"
            : "not_detected",
      evidence: signals
        .filter((s) => s.kind === kind)
        .slice(0, 3)
        .map((s) => s.evidence),
    })),
    interpretation: {
      status: "off",
      finding_order: findings.map((f) => f.id),
      model: null,
      summary: "Deterministic evidence report. No model-generated claims.",
      limitation:
        "LLM interpretation is disabled by default. Static results do not prove runtime safety.",
    },
    created_at: new Date().toISOString(),
    disclaimer:
      "This is a heuristic evidence-coverage score, not a security certification, malware verdict, probability of safety, or authorization to execute.",
    warnings: [
      ...(repository.coverage.eligible_files > repository.coverage.fetched_files
        ? [
            "Partial file sample: undetected controls and risks may exist outside the sample.",
          ]
        : []),
      ...(repository.coverage.truncated_tree
        ? [
            "GitHub truncated the repository tree; coverage denominator is incomplete.",
          ]
        : []),
      ...(signals.some((s) => s.kind === "parse_error")
        ? ["Some source syntax could not be parsed completely."]
        : []),
      "No dependency resolution, runtime sandbox, interprocedural data flow or exploit validation in v0.1.",
    ],
  };
}
export async function scanSnapshot(
  repository: RepositorySnapshot,
  id: string,
): Promise<TrustReport> {
  const signals = extractSignals(repository);
  const classification = classify(repository, signals);
  const dimensions: AnalyzerResult[] = [];
  for (const analyzer of analyzers)
    dimensions.push(
      await analyzer.analyze({ repository, classification, signals }),
    );
  return assemble(id, repository, classification, signals, dimensions);
}
// Models may prioritize existing finding IDs; they cannot add claims or evidence.
export function validateInterpretation(
  value: unknown,
  report: TrustReport,
): Interpretation {
  const invalid: Interpretation = {
    ...report.interpretation,
    status: "rejected",
    limitation: "Model output did not match the evidence-only protocol.",
  };
  if (
    !value ||
    typeof value !== "object" ||
    Object.keys(value).some((k) => k !== "finding_order")
  )
    return invalid;
  const order = (value as { finding_order?: unknown }).finding_order;
  if (
    !Array.isArray(order) ||
    order.length !== report.findings.length ||
    new Set(order).size !== order.length ||
    !order.every((id) => report.findings.some((f) => f.id === id))
  )
    return invalid;
  return {
    status: "validated",
    finding_order: order,
    summary:
      "Existing evidence findings prioritized by an optional model; no additional factual claims accepted.",
    model: "@cf/meta/llama-3.1-8b-instruct",
    limitation:
      "Ranking is uncalibrated and does not change scores, evidence or permissions.",
  };
}
