/**
 * PRPilot background service worker
 *
 * Handles API calls to Anthropic / OpenAI on behalf of the content script.
 * Because service workers run outside the page context they are not subject
 * to GitHub's Content Security Policy, so fetch() to external APIs works fine.
 *
 * Security: the API key is read directly from chrome.storage here — it is never
 * accepted from the message bus, so other extensions cannot intercept credentials.
 */
import { reviewPR } from '../ai/reviewer';
import { getSettings } from '../adapters/storage';
import { DiffFile, ReviewStyle } from '../types';

/** Non-sensitive options the content script is allowed to pass. */
interface ReviewOptions {
  reviewStyle?: ReviewStyle;
  maxFilesPerReview?: number;
  maxPatchCharsPerFile?: number;
}

interface ReviewMessage {
  type: string;
  files: DiffFile[];
  options: ReviewOptions;
}

interface ReviewResponse {
  ok: boolean;
  /** Numeric HTTP status code, 0 if not applicable. */
  status: number;
  result?: import('../types').ReviewResult;
  error?: string;
}

chrome.runtime.onMessage.addListener(
  (message: ReviewMessage, _sender, sendResponse: (r: ReviewResponse) => void) => {
    if (message.type !== 'REVIEW_PR') return false;

    (async () => {
      try {
        // Credentials are read from storage — never from the message payload.
        const settings = await getSettings();
        const merged = {
          ...settings,
          reviewStyle:         message.options?.reviewStyle         ?? settings.reviewStyle,
          maxFilesPerReview:   message.options?.maxFilesPerReview   ?? settings.maxFilesPerReview,
          maxPatchCharsPerFile: message.options?.maxPatchCharsPerFile ?? settings.maxPatchCharsPerFile,
        };

        const result = await reviewPR(message.files, merged);
        sendResponse({ ok: true, status: 0, result });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Extract an HTTP status code if present (e.g. "Anthropic API error: 401 …").
        const match = msg.match(/\b([45]\d{2})\b/);
        const status = match ? parseInt(match[1], 10) : 0;
        sendResponse({ ok: false, status, error: msg });
      }
    })();

    // Return true to keep the message channel open for the async response.
    return true;
  }
);
