export const VERSION = "0.1.0";
export const POLICY = "static-evidence-2026-09-09.1";
export const WEIGHTS = {
  security: 25,
  permissions: 15,
  trajectory: 15,
  observability: 15,
  ci: 15,
  recovery: 10,
  documentation: 5,
} as const;
export type Dimension = keyof typeof WEIGHTS;
export type RepositoryKind =
  "agentic" | "software" | "library" | "research" | "unknown";
export interface RepoRef {
  owner: string;
  name: string;
  url: string;
}
export interface TreeEntry {
  path: string;
  sha: string;
  size: number;
  mode: string;
  type: string;
}
export interface SourceFile {
  path: string;
  sha: string;
  text: string;
}
export interface Coverage {
  tree_entries: number;
  eligible_files: number;
  fetched_files: number;
  bytes: number;
  truncated_tree: boolean;
  skipped: { path: string; reason: string }[];
}
export interface RepositorySnapshot {
  ref: RepoRef;
  commit_sha: string;
  tree_sha: string;
  description: string;
  files: SourceFile[];
  tree: TreeEntry[];
  coverage: Coverage;
  captured_at: string;
  source: "github" | "synthetic";
}
export interface Evidence {
  id: string;
  path: string;
  line_start: number;
  line_end: number;
  snippet: string;
  blob_sha: string;
  source_url: string | null;
}
export interface Classification {
  kind: RepositoryKind;
  confidence: number;
  evidence: Evidence[];
  method: string;
}
export interface TrustFinding {
  id: string;
  title: string;
  category: Dimension;
  severity: "critical" | "high" | "medium" | "low" | "info";
  decision: "block" | "approval_required" | "warn" | "info";
  summary: string;
  evidence: Evidence[];
  why_it_matters: string;
  recommendation: string;
  confidence: number;
}
export interface Check {
  id: string;
  title: string;
  observed: boolean;
  evidence: Evidence[];
  points: number;
  meaning: string;
}
export interface AnalyzerContext {
  repository: RepositorySnapshot;
  classification: Classification;
  signals: Signal[];
}
export interface AnalyzerResult {
  dimension: Dimension;
  score: number | null;
  confidence: number;
  applicable: boolean;
  checks: Check[];
  findings: TrustFinding[];
  strengths: string[];
  limitations: string[];
}
export interface TrustAnalyzer {
  name: string;
  analyze(ctx: AnalyzerContext): Promise<AnalyzerResult>;
}
export interface Signal {
  kind: string;
  evidence: Evidence;
  context: "code" | "config" | "documentation" | "tree";
}
export interface Interpretation {
  status: "off" | "unavailable" | "validated" | "rejected";
  finding_order: string[];
  summary: string;
  model: string | null;
  limitation: string;
}
export interface TrustReport {
  id: string;
  version: string;
  policy: string;
  repository: Omit<RepositorySnapshot, "files" | "tree">;
  classification: Classification;
  overall_score: number | null;
  grade: "A" | "B" | "C" | "D" | "F" | "INSUFFICIENT";
  confidence: number;
  dimensions: AnalyzerResult[];
  findings: TrustFinding[];
  permission_map: {
    capability: string;
    status: string;
    evidence: Evidence[];
  }[];
  trajectory: {
    stage: string;
    status: "observed" | "review" | "not_detected" | "not_applicable";
    evidence: Evidence[];
  }[];
  interpretation: Interpretation;
  created_at: string;
  disclaimer: string;
  warnings: string[];
}
export type JobStage =
  | "queued"
  | "metadata"
  | "tree"
  | "files"
  | "classifying"
  | Dimension
  | "scoring"
  | "complete"
  | "failed";
export interface JobState {
  id: string;
  ref: RepoRef;
  stage: JobStage;
  status: "queued" | "running" | "completed" | "failed";
  created_at: string;
  updated_at: string;
  expires_at: string;
  attempt: number;
  error: { code: string; message: string; retry_after: number | null } | null;
  progress: { done: number; total: number };
  history: { stage: JobStage; at: string }[];
}
