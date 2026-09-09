import type {
  AnalyzerResult,
  JobState,
  RepositorySnapshot,
  TreeEntry,
  TrustReport,
} from "../types";
import { GitHubReader, LIMITS, ScanError, selectFiles } from "./github";
import { redact, extractSignals, classify } from "./signals";
import { assemble } from "./report";
import { analyzers } from "../analyzers";
export type Work = {
  snapshot: RepositorySnapshot;
  selected: TreeEntry[];
  index: number;
  dimensions: AnalyzerResult[];
};
// One bounded durable step per alarm; no repository code is imported or executed.
export async function advance(
  job: JobState,
  work: Work | undefined,
  reader: GitHubReader,
): Promise<{ work?: Work; report?: TrustReport }> {
  if (job.stage === "queued") job.stage = "metadata";
  else if (job.stage === "metadata") {
    const meta = await reader.metadata(job.ref);
    work = {
      snapshot: {
        ref: job.ref,
        commit_sha: meta.commit,
        tree_sha: meta.tree,
        description: redact(meta.description),
        files: [],
        tree: [],
        coverage: {
          tree_entries: 0,
          eligible_files: 0,
          fetched_files: 0,
          bytes: 0,
          truncated_tree: false,
          skipped: [],
        },
        captured_at: new Date().toISOString(),
        source: "github",
      },
      selected: [],
      index: 0,
      dimensions: [],
    };
    job.stage = "tree";
  } else if (job.stage === "tree" && work) {
    const tree = await reader.tree(job.ref, work.snapshot.tree_sha);
    const selection = selectFiles(tree.entries);
    // Retain only selected entries; the full bounded tree is not needed after selection.
    work.snapshot.tree = selection.selected;
    work.selected = selection.selected;
    work.snapshot.coverage = {
      ...work.snapshot.coverage,
      tree_entries: tree.entries.length,
      eligible_files: selection.eligible,
      truncated_tree: tree.truncated,
      skipped: selection.skipped,
    };
    job.stage = "files";
    job.progress = { done: 0, total: work.selected.length };
  } else if (job.stage === "files" && work) {
    const entry = work.selected[work.index];
    if (entry) {
      try {
        const file = await reader.blob(job.ref, entry);
        const bytes = new TextEncoder().encode(file.text).byteLength;
        if (work.snapshot.coverage.bytes + bytes > LIMITS.totalBytes)
          throw new ScanError(
            "TOTAL_SIZE_LIMIT",
            "Total scan size limit reached.",
          );
        work.snapshot.files.push(file);
        work.snapshot.coverage.bytes += bytes;
        work.snapshot.coverage.fetched_files++;
      } catch (error) {
        if (
          error instanceof ScanError &&
          [
            "FILE_TOO_LARGE",
            "BINARY_FILE",
            "TOTAL_SIZE_LIMIT",
            "RESPONSE_TOO_LARGE",
          ].includes(error.code)
        )
          work.snapshot.coverage.skipped.push({
            path: entry.path,
            reason: error.code,
          });
        else throw error;
      }
      work.index++;
      job.progress.done = work.index;
    }
    if (work.index >= work.selected.length) job.stage = "classifying";
  } else if (job.stage === "classifying" && work) {
    job.stage = "security";
    job.progress = { done: 0, total: analyzers.length };
  } else if (work && analyzers.some((a) => a.name === job.stage)) {
    const analyzer = analyzers.find((a) => a.name === job.stage)!;
    const signals = extractSignals(work.snapshot);
    const classification = classify(work.snapshot, signals);
    work.dimensions.push(
      await analyzer.analyze({
        repository: work.snapshot,
        classification,
        signals,
      }),
    );
    job.progress.done = work.dimensions.length;
    job.stage =
      (analyzers[work.dimensions.length]?.name as JobState["stage"]) ||
      "scoring";
  } else if (job.stage === "scoring" && work) {
    const signals = extractSignals(work.snapshot);
    const report = assemble(
      job.id,
      work.snapshot,
      classify(work.snapshot, signals),
      signals,
      work.dimensions,
    );
    job.stage = "complete";
    job.status = "completed";
    return { report };
  } else
    throw new ScanError(
      "INVALID_STATE",
      "The persisted job state is inconsistent.",
    );
  return { work };
}
