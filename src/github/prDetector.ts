import { PRInfo } from '../types';

// Matches: https://github.com/{owner}/{repo}/pull/{number}[/anything]
const PR_URL_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(\/.*)?$/;

/**
 * Returns true if the given URL is a GitHub pull request page.
 */
export function isPRUrl(url: string): boolean {
  return PR_URL_PATTERN.test(url);
}

/**
 * Extracts owner, repo, and PR number from a GitHub PR URL.
 * Returns null if the URL is not a valid PR URL.
 */
export function parsePRUrl(url: string): PRInfo | null {
  const match = url.match(PR_URL_PATTERN);
  if (!match) return null;

  const [, owner, repo, prNumberStr] = match;
  const prNumber = parseInt(prNumberStr, 10);

  if (!owner || !repo || isNaN(prNumber)) return null;

  return { owner, repo, prNumber };
}
