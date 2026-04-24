import { reviewPR } from './reviewer';
import { DiffFile, DEFAULT_SETTINGS, ReviewResult } from '../types';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const SAMPLE_FILES: DiffFile[] = [
  { filename: 'src/app.ts', status: 'modified', additions: 5, deletions: 1, patch: '+const x = 1;' },
];

const MOCK_REVIEW: ReviewResult = {
  summary: 'Small change adding a constant.',
  comments: [{ type: 'praise', severity: 'info', message: 'Clean and concise.' }],
  overallScore: 9,
};

function makeAnthropicResponse(content: string) {
  return {
    ok: true,
    json: async () => ({
      content: [{ type: 'text', text: content }],
    }),
  };
}

function makeOpenAIResponse(content: string) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  };
}

describe('reviewer', () => {
  beforeEach(() => mockFetch.mockReset());

  describe('reviewPR with Anthropic', () => {
    const settings = { ...DEFAULT_SETTINGS, apiKey: 'sk-ant-test', apiProvider: 'anthropic' as const };

    it('calls the Anthropic API with the correct endpoint and headers', async () => {
      mockFetch.mockResolvedValueOnce(makeAnthropicResponse(JSON.stringify(MOCK_REVIEW)));
      await reviewPR(SAMPLE_FILES, settings);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'x-api-key': 'sk-ant-test' }),
        })
      );
    });

    it('parses and returns a valid ReviewResult', async () => {
      mockFetch.mockResolvedValueOnce(makeAnthropicResponse(JSON.stringify(MOCK_REVIEW)));
      const result = await reviewPR(SAMPLE_FILES, settings);

      expect(result.summary).toBe('Small change adding a constant.');
      expect(result.overallScore).toBe(9);
      expect(result.comments).toHaveLength(1);
    });

    it('throws when the API responds with an error status', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' });
      await expect(reviewPR(SAMPLE_FILES, settings)).rejects.toThrow('401');
    });

    it('throws when the AI returns malformed JSON', async () => {
      mockFetch.mockResolvedValueOnce(makeAnthropicResponse('not json at all'));
      await expect(reviewPR(SAMPLE_FILES, settings)).rejects.toThrow();
    });
  });

  describe('reviewPR with OpenAI', () => {
    const settings = { ...DEFAULT_SETTINGS, apiKey: 'sk-openai-test', apiProvider: 'openai' as const, model: 'gpt-4o' };

    it('calls the OpenAI API with the correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce(makeOpenAIResponse(JSON.stringify(MOCK_REVIEW)));
      await reviewPR(SAMPLE_FILES, settings);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('parses OpenAI response format correctly', async () => {
      mockFetch.mockResolvedValueOnce(makeOpenAIResponse(JSON.stringify(MOCK_REVIEW)));
      const result = await reviewPR(SAMPLE_FILES, settings);
      expect(result.overallScore).toBe(9);
    });
  });
});
