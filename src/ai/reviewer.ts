import { DiffFile, Settings, ReviewResult } from '../types';
import { buildReviewPrompt } from './promptBuilder';
import { truncateDiff } from '../github/diffExtractor';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Calls the configured AI provider (Anthropic or OpenAI) and returns
 * a structured ReviewResult parsed from the model's JSON response.
 */
export async function reviewPR(
  files: DiffFile[],
  settings: Settings
): Promise<ReviewResult> {
  const trimmed = truncateDiff(files, settings.maxPatchCharsPerFile, settings.maxFilesPerReview);
  const prompt = buildReviewPrompt(trimmed, settings);

  const rawText =
    settings.apiProvider === 'anthropic'
      ? await callAnthropic(prompt, settings)
      : await callOpenAI(prompt, settings);

  return parseReviewResponse(rawText);
}

async function callAnthropic(prompt: string, settings: Settings): Promise<string> {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Anthropic API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.content[0].text as string;
}

async function callOpenAI(prompt: string, settings: Settings): Promise<string> {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.choices[0].message.content as string;
}

function parseReviewResponse(raw: string): ReviewResult {
  // Strip markdown code fences if the model wrapped the JSON anyway
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned non-JSON response: ${cleaned.slice(0, 200)}`);
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as any).summary !== 'string' ||
    !Array.isArray((parsed as any).comments) ||
    typeof (parsed as any).overallScore !== 'number'
  ) {
    throw new Error('AI response does not match expected ReviewResult schema.');
  }

  return parsed as ReviewResult;
}
