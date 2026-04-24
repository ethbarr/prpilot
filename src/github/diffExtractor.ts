import { DiffFile } from '../types';

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Fetches the list of changed files (with patches) for a given PR
 * using the GitHub REST API. Works on public repos without a token;
 * private repos require a githubToken.
 */
export async function fetchPRDiff(
  owner: string,
  repo: string,
  prNumber: number,
  githubToken?: string
): Promise<DiffFile[]> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/files`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (githubToken) {
    headers['Authorization'] = `Bearer ${githubToken}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText} — ` +
        `check your GitHub token or repo visibility.`
    );
  }

  const data = await response.json();

  return data.map((file: any): DiffFile => ({
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    ...(file.patch !== undefined ? { patch: file.patch } : {}),
  }));
}

/**
 * Trims the diff to a manageable size for the AI prompt:
 * - Limits total files to maxFiles (prioritising files with patches)
 * - Truncates individual patch strings to maxPatchCharsPerFile characters
 */
export function truncateDiff(
  files: DiffFile[],
  maxPatchCharsPerFile: number,
  maxFiles: number
): DiffFile[] {
  // Prioritise files that have a patch; cap total count
  const limited = files.slice(0, maxFiles);

  return limited.map((file) => {
    if (!file.patch || file.patch.length <= maxPatchCharsPerFile) {
      return file;
    }
    return {
      ...file,
      patch: file.patch.slice(0, maxPatchCharsPerFile) + '\n... [truncated]',
    };
  });
}
