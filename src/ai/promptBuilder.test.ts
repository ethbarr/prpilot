import { buildReviewPrompt } from './promptBuilder';
import { DiffFile, DEFAULT_SETTINGS } from '../types';

const SAMPLE_FILES: DiffFile[] = [
  {
    filename: 'src/auth.ts',
    status: 'modified',
    additions: 10,
    deletions: 2,
    patch: '@@ -1,2 +1,10 @@\n-const secret = "hardcoded";\n+const secret = process.env.SECRET_KEY;',
  },
  {
    filename: 'src/utils.ts',
    status: 'added',
    additions: 5,
    deletions: 0,
    patch: '@@ -0,0 +1,5 @@\n+export const add = (a: number, b: number) => a + b;',
  },
];

describe('promptBuilder', () => {
  describe('buildReviewPrompt', () => {
    it('includes the diff content in the prompt', () => {
      const prompt = buildReviewPrompt(SAMPLE_FILES, DEFAULT_SETTINGS);
      expect(prompt).toContain('src/auth.ts');
      expect(prompt).toContain('hardcoded');
      expect(prompt).toContain('process.env.SECRET_KEY');
    });

    it('includes the review style in the prompt', () => {
      const securityPrompt = buildReviewPrompt(SAMPLE_FILES, {
        ...DEFAULT_SETTINGS,
        reviewStyle: 'security',
      });
      expect(securityPrompt.toLowerCase()).toContain('security');
    });

    it('requests JSON output format', () => {
      const prompt = buildReviewPrompt(SAMPLE_FILES, DEFAULT_SETTINGS);
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('summary');
      expect(prompt).toContain('comments');
      expect(prompt).toContain('overallScore');
    });

    it('includes file status context (added, modified, etc.)', () => {
      const prompt = buildReviewPrompt(SAMPLE_FILES, DEFAULT_SETTINGS);
      expect(prompt).toContain('modified');
      expect(prompt).toContain('added');
    });

    it('handles an empty file list without throwing', () => {
      expect(() => buildReviewPrompt([], DEFAULT_SETTINGS)).not.toThrow();
    });

    it('handles files with no patch field', () => {
      const filesNoPatch: DiffFile[] = [
        { filename: 'image.png', status: 'added', additions: 0, deletions: 0 },
      ];
      const prompt = buildReviewPrompt(filesNoPatch, DEFAULT_SETTINGS);
      expect(prompt).toContain('image.png');
      expect(prompt).toContain('[binary or too large');
    });
  });
});
