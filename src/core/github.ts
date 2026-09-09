import { z } from "zod";
import type { RepoRef, SourceFile, TreeEntry } from "../types";

export const LIMITS = {
  files: 16,
  fileBytes: 16_384,
  totalBytes: 262_144,
  responseBytes: 2_500_000,
  timeoutMs: 12_000,
};
export class ScanError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryAfter: number | null = null,
  ) {
    super(message);
  }
}
export function parseRepository(input: string): RepoRef {
  const match =
    /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9_.-]{1,100})(?:\/)?$/.exec(
      input.trim(),
    );
  if (!match || /^(\.|\.\.)$/.test(match[2]))
    throw new ScanError(
      "INVALID_REPOSITORY",
      "Use a public https://github.com/owner/repository URL without query parameters.",
    );
  const name = match[2].replace(/\.git$/, "");
  if (!name || /^(\.|\.\.)$/.test(name))
    throw new ScanError("INVALID_REPOSITORY", "Invalid repository name.");
  return {
    owner: match[1],
    name,
    url: `https://github.com/${match[1]}/${name}`,
  };
}
export async function boundedText(
  response: Response,
  limit = LIMITS.responseBytes,
): Promise<string> {
  if (Number(response.headers.get("content-length")) > limit)
    throw new ScanError(
      "RESPONSE_TOO_LARGE",
      "Upstream response exceeds the scan limit.",
    );
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let result = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit)
        throw new ScanError(
          "RESPONSE_TOO_LARGE",
          "Upstream response exceeds the scan limit.",
        );
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
export class GitHubReader {
  constructor(private transport: typeof fetch = fetch) {}
  private async get(
    path: string,
    maxBytes = LIMITS.responseBytes,
  ): Promise<unknown> {
    const response = await this.transport(`https://api.github.com${path}`, {
      redirect: "error",
      signal: AbortSignal.timeout(LIMITS.timeoutMs),
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "P-Trust/0.1-static-research",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 403 || response.status === 429)
        throw new ScanError(
          "UPSTREAM_RATE_LIMIT",
          "GitHub anonymous quota is unavailable. Try later or use a synthetic benchmark.",
          3600,
        );
      if (response.status === 404)
        throw new ScanError(
          "NOT_PUBLIC_OR_NOT_FOUND",
          "Repository is not publicly readable or does not exist.",
        );
      throw new ScanError(
        "UPSTREAM_FAILURE",
        `GitHub returned HTTP ${response.status}.`,
        response.status >= 500 ? 30 : null,
      );
    }
    return JSON.parse(await boundedText(response, maxBytes));
  }
  async metadata(ref: RepoRef) {
    const base = `/repos/${ref.owner}/${ref.name}`;
    const meta = z
      .object({
        private: z.boolean(),
        default_branch: z.string(),
        description: z.string().nullable(),
      })
      .parse(await this.get(base, 100_000));
    if (meta.private)
      throw new ScanError(
        "PRIVATE_REPOSITORY",
        "Only public repositories are supported.",
      );
    const commit = z
      .object({
        sha: z.string().regex(/^[a-f0-9]{40}$/),
        commit: z.object({
          tree: z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/) }),
        }),
      })
      .parse(
        await this.get(
          `${base}/commits/${encodeURIComponent(meta.default_branch)}`,
          600_000,
        ),
      );
    return {
      commit: commit.sha,
      tree: commit.commit.tree.sha,
      description: meta.description || "",
    };
  }
  async tree(ref: RepoRef, sha: string) {
    const data = z
      .object({
        truncated: z.boolean(),
        tree: z.array(
          z.object({
            path: z.string(),
            mode: z.string(),
            type: z.string(),
            sha: z.string().regex(/^[a-f0-9]{40}$/),
            size: z.number().optional(),
          }),
        ),
      })
      .parse(
        await this.get(
          `/repos/${ref.owner}/${ref.name}/git/trees/${sha}?recursive=1`,
        ),
      );
    return {
      truncated: data.truncated,
      entries: data.tree.map((e) => ({ ...e, size: e.size || 0 })),
    };
  }
  async blob(ref: RepoRef, entry: TreeEntry): Promise<SourceFile> {
    const data = z
      .object({
        encoding: z.literal("base64"),
        size: z.number().max(LIMITS.fileBytes),
        content: z.string(),
      })
      .parse(
        await this.get(
          `/repos/${ref.owner}/${ref.name}/git/blobs/${entry.sha}`,
          LIMITS.fileBytes * 2,
        ),
      );
    const raw = atob(data.content.replace(/\s/g, ""));
    if (raw.length > LIMITS.fileBytes)
      throw new ScanError("FILE_TOO_LARGE", "File exceeds the scan limit.");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(raw, (c) => c.charCodeAt(0)),
    );
    if (text.includes("\0"))
      throw new ScanError("BINARY_FILE", "Binary files are not analyzed.");
    return { path: entry.path, sha: entry.sha, text };
  }
}
export function selectFiles(entries: TreeEntry[]) {
  const skipped: { path: string; reason: string }[] = [];
  const eligible = entries.filter((e) => {
    let reason = "";
    if (e.type !== "blob") return false;
    if (!["100644", "100755"].includes(e.mode))
      reason = "symlink or non-regular file";
    else if (
      /(^|\/)(\.\.?|node_modules|vendor|dist|build|coverage|\.git|fixtures|__fixtures__)(\/|$)/i.test(
        e.path,
      ) ||
      e.path.includes("\\")
    )
      reason = "excluded path";
    else if (
      /(^|\/)(\.env.*|.*\.(pem|key|p12)|credentials.*|secrets.*)$/i.test(e.path)
    )
      reason = "sensitive filename";
    else if (e.size > LIMITS.fileBytes) reason = "file size limit";
    else if (
      !/\.(py|[cm]?jsx?|tsx?|json|ya?ml|md|toml)$/i.test(e.path) ||
      /(lock\.json|lock\.yaml|package-lock|pnpm-lock)/i.test(e.path)
    )
      reason = "unsupported or generated file";
    if (reason) {
      if (skipped.length < 80) skipped.push({ path: e.path, reason });
      return false;
    }
    return true;
  });
  const priority = (p: string) =>
    /^\.github\/workflows\//.test(p)
      ? 0
      : /^(package.json|pyproject.toml|README.md|SECURITY.md)$/i.test(p)
        ? 1
        : /(agent|permission|policy|risk|recover|runtime|worker|security|tool)/i.test(
              p,
            )
          ? 2
          : /test/i.test(p)
            ? 4
            : 3;
  eligible.sort(
    (a, b) =>
      priority(a.path) - priority(b.path) || a.path.localeCompare(b.path, "en"),
  );
  return {
    selected: eligible.slice(0, LIMITS.files),
    eligible: eligible.length,
    skipped,
  };
}
