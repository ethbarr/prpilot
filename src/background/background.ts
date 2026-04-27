/**
 * PRPilot background service worker
 *
 * Handles API calls to Anthropic / OpenAI on behalf of the content script.
 * Because service workers run outside the page context they are not subject
 * to GitHub's Content Security Policy, so fetch() to external APIs works fine.
 */
import { reviewPR } from '../ai/reviewer';
import { DiffFile, Settings } from '../types';

chrome.runtime.onMessage.addListener(
  (message: { type: string; files: DiffFile[]; settings: Settings }, _sender, sendResponse) => {
    if (message.type !== 'REVIEW_PR') return false;

    reviewPR(message.files, message.settings)
      .then(result  => sendResponse({ ok: true,  result }))
      .catch(err    => sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }));

    // Return true to keep the message channel open for the async response.
    return true;
  }
);
