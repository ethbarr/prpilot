import { parsePRUrl, isPRUrl } from './prDetector';

describe('prDetector', () => {
  describe('isPRUrl', () => {
    it('returns true for a standard PR URL', () => {
      expect(isPRUrl('https://github.com/facebook/react/pull/12345')).toBe(true);
    });

    it('returns true for a PR URL with trailing slash', () => {
      expect(isPRUrl('https://github.com/owner/repo/pull/1/')).toBe(true);
    });

    it('returns true for a PR URL with files tab', () => {
      expect(isPRUrl('https://github.com/owner/repo/pull/42/files')).toBe(true);
    });

    it('returns false for a repo root URL', () => {
      expect(isPRUrl('https://github.com/facebook/react')).toBe(false);
    });

    it('returns false for an issues URL', () => {
      expect(isPRUrl('https://github.com/owner/repo/issues/10')).toBe(false);
    });

    it('returns false for a pulls list URL (not a single PR)', () => {
      expect(isPRUrl('https://github.com/owner/repo/pulls')).toBe(false);
    });

    it('returns false for a non-github URL', () => {
      expect(isPRUrl('https://gitlab.com/owner/repo/merge_requests/1')).toBe(false);
    });

    it('returns false for an empty string', () => {
      expect(isPRUrl('')).toBe(false);
    });
  });

  describe('parsePRUrl', () => {
    it('correctly parses owner, repo, and PR number', () => {
      const result = parsePRUrl('https://github.com/microsoft/vscode/pull/999');
      expect(result).toEqual({ owner: 'microsoft', repo: 'vscode', prNumber: 999 });
    });

    it('handles numeric PR numbers of varying lengths', () => {
      expect(parsePRUrl('https://github.com/a/b/pull/1')?.prNumber).toBe(1);
      expect(parsePRUrl('https://github.com/a/b/pull/99999')?.prNumber).toBe(99999);
    });

    it('handles PR URLs with sub-paths (e.g. /files)', () => {
      const result = parsePRUrl('https://github.com/owner/repo/pull/42/files');
      expect(result).toEqual({ owner: 'owner', repo: 'repo', prNumber: 42 });
    });

    it('returns null for non-PR URLs', () => {
      expect(parsePRUrl('https://github.com/owner/repo/issues/1')).toBeNull();
    });

    it('returns null for malformed URLs', () => {
      expect(parsePRUrl('not-a-url')).toBeNull();
    });
  });
});
