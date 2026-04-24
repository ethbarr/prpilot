import { fetchPRDiff, truncateDiff } from './diffExtractor';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const MOCK_API_RESPONSE = [
  {
    filename: 'src/auth/login.ts',
    status: 'modified',
    additions: 15,
    deletions: 3,
    patch: '@@ -1,3 +1,15 @@\n-const login = () => {};\n+const login = async (user: string, pass: string) => {\n+  const hash = await bcrypt.hash(pass, 10);\n+  return db.users.find({ user, hash });\n+};',
  },
  {
    filename: 'src/utils/helper.ts',
    status: 'added',
    additions: 5,
    deletions: 0,
    patch: '@@ -0,0 +1,5 @@\n+export const clamp = (n: number, min: number, max: number) =>\n+  Math.min(Math.max(n, min), max);',
  },
  {
    filename: 'README.md',
    status: 'modified',
    additions: 2,
    deletions: 1,
    // No patch — binary or too large
  },
];

describe('diffExtractor', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('fetchPRDiff', () => {
    it('fetches and returns diff files from GitHub API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_API_RESPONSE,
      });
      const files = await fetchPRDiff('owner', 'repo', 42);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/pulls/42/files',
        expect.objectContaining({ headers: expect.any(Object) })
      );
      expect(files).toHaveLength(3);
      expect(files[0].filename).toBe('src/auth/login.ts');
      expect(files[0].status).toBe('modified');
      expect(files[0].additions).toBe(15);
      expect(files[0].patch).toContain('bcrypt');
    });

    it('includes Authorization header when githubToken is provided', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
      await fetchPRDiff('owner', 'repo', 1, 'ghp_token123');
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer ghp_token123');
    });

    it('omits Authorization header when no token provided', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
      await fetchPRDiff('owner', 'repo', 1);
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBeUndefined();
    });

    it('throws an error when the API responds with a non-ok status', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' });
      await expect(fetchPRDiff('owner', 'private-repo', 1)).rejects.toThrow('403');
    });

    it('handles files with no patch field gracefully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => MOCK_API_RESPONSE });
      const files = await fetchPRDiff('owner', 'repo', 42);
      const readme = files.find((f) => f.filename === 'README.md');
      expect(readme).toBeDefined();
      expect(readme!.patch).toBeUndefined();
    });
  });

  describe('truncateDiff', () => {
    const makePatch = (length: number) => 'x'.repeat(length);

    it('keeps files under the char limit unchanged', () => {
      const files = [{ filename: 'a.ts', status: 'modified' as const, additions: 1, deletions: 0, patch: makePatch(100) }];
      const result = truncateDiff(files, 200, 10);
      expect(result[0].patch).toHaveLength(100);
    });

    it('truncates patch that exceeds maxPatchCharsPerFile', () => {
      const files = [{ filename: 'a.ts', status: 'modified' as const, additions: 1, deletions: 0, patch: makePatch(500) }];
      const result = truncateDiff(files, 200, 5);
      // 200 chars of patch + truncation suffix (~16 chars)
      expect(result[0].patch!.length).toBeLessThanOrEqual(220);
      expect(result[0].patch).toContain('[truncated]');
    });

    it('limits total files to maxFiles', () => {
      const files = Array.from({ length: 15 }, (_, i) => ({
        filename: `file${i}.ts`,
        status: 'modified' as const,
        additions: 1,
        deletions: 0,
        patch: 'small patch',
      }));
      const result = truncateDiff(files, 100, 5);
      expect(result).toHaveLength(5);
    });

    it('keeps files without a patch in the truncated set', () => {
      const files = [
        { filename: 'a.ts', status: 'modified' as const, additions: 1, deletions: 0, patch: 'has patch' },
        { filename: 'b.ts', status: 'modified' as const, additions: 1, deletions: 0 },
      ];
      const result = truncateDiff(files, 100, 10);
      expect(result.find((f) => f.filename === 'b.ts')).toBeDefined();
    });
  });
});
