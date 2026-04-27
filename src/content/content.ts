import { getSettings, saveSettings } from '../adapters/storage';
import { parsePRUrl, isPRUrl } from '../github/prDetector';
import { fetchPRDiff } from '../github/diffExtractor';
import { injectReviewButton, showLoadingPanel, addLoadingStep, showReviewPanel, showErrorPanel, showSetupPanel } from './ui';
import { DEFAULT_SETTINGS, ReviewResult } from '../types';

async function handleReviewClick(): Promise<void> {
  const settings = await getSettings();

  // No API key → show inline setup instead of a dead-end error
  if (!settings.apiKey) {
    showSetupPanel(async (apiKey: string, provider: string) => {
      const model = provider === 'anthropic' ? DEFAULT_SETTINGS.model : 'gpt-4o';
      await saveSettings({ ...settings, apiKey, apiProvider: provider as 'anthropic' | 'openai', model });
      handleReviewClick();
    });
    return;
  }

  showLoadingPanel();

  const prInfo = parsePRUrl(window.location.href);
  if (!prInfo) {
    showErrorPanel('Could not detect a pull request on this page. Navigate to a GitHub PR and try again.');
    return;
  }

  try {
    const files = await fetchPRDiff(
      prInfo.owner,
      prInfo.repo,
      prInfo.prNumber,
      settings.githubToken || undefined
    );

    if (files.length === 0) {
      showErrorPanel('This pull request has no changed files to review.');
      return;
    }

    addLoadingStep(`Fetched ${files.length} changed file${files.length !== 1 ? 's' : ''}`);
    addLoadingStep(`Sending to ${settings.apiProvider === 'anthropic' ? 'Claude' : 'GPT'} for review…`);

    // Send diff to background service worker for the API call.
    // The SW runs outside the page context so GitHub's CSP doesn't block it.
    const response = await chrome.runtime.sendMessage({
      type: 'REVIEW_PR',
      files,
      settings,
    }) as { ok: boolean; result?: ReviewResult; error?: string };

    addLoadingStep('Response received — parsing review…');

    if (!response.ok) {
      const msg = response.error ?? 'Background worker returned an error.';
      // 401 means the saved key is wrong — re-show setup so they can fix it
      if (msg.includes('401')) {
        showSetupPanel(async (apiKey: string, provider: string) => {
          const model = provider === 'anthropic' ? DEFAULT_SETTINGS.model : 'gpt-4o';
          await saveSettings({ ...settings, apiKey, apiProvider: provider as 'anthropic' | 'openai', model });
          handleReviewClick();
        }, true /* invalidKey */);
      } else {
        showErrorPanel(msg);
      }
      return;
    }
    showReviewPanel(response.result!);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    showErrorPanel(message);
  }
}

function init(): void {
  if (!isPRUrl(window.location.href)) return;
  injectReviewButton(handleReviewClick);
}

// Run on initial load
init();

// Re-run on GitHub's client-side navigation (GitHub is a SPA)
const observer = new MutationObserver(() => {
  if (isPRUrl(window.location.href) && !document.getElementById('prpilot-btn')) {
    injectReviewButton(handleReviewClick);
  }
});
observer.observe(document.body, { childList: true, subtree: true });
