import { getSettings } from '../adapters/storage';
import { parsePRUrl, isPRUrl } from '../github/prDetector';
import { fetchPRDiff } from '../github/diffExtractor';
import { reviewPR } from '../ai/reviewer';
import { injectReviewButton, showLoadingPanel, showReviewPanel, showErrorPanel } from './ui';

async function handleReviewClick(): Promise<void> {
  showLoadingPanel();

  const settings = await getSettings();

  if (!settings.apiKey) {
    showErrorPanel(
      'No API key configured. Click the PRPilot extension icon in your toolbar to add your Anthropic or OpenAI API key.'
    );
    return;
  }

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

    const result = await reviewPR(files, settings);
    showReviewPanel(result);
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
