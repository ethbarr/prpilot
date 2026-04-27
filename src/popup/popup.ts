import { getSettings, saveSettings, clearSettings } from '../adapters/storage';
import { ApiProvider, Settings } from '../types';

const MODELS: Record<ApiProvider, string[]> = {
  anthropic: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
};

const providerEl = document.getElementById('provider') as HTMLSelectElement;
const modelEl = document.getElementById('model') as HTMLSelectElement;
const apiKeyEl = document.getElementById('api-key') as HTMLInputElement;
const reviewStyleEl = document.getElementById('review-style') as HTMLSelectElement;
const githubTokenEl = document.getElementById('github-token') as HTMLInputElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;

function populateModels(provider: ApiProvider): void {
  modelEl.innerHTML = '';
  MODELS[provider].forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    modelEl.appendChild(opt);
  });
}

function showStatus(message: string, type: 'success' | 'error'): void {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  setTimeout(() => {
    statusEl.className = 'status';
  }, 3000);
}

async function loadSettings(): Promise<void> {
  const settings = await getSettings();
  providerEl.value = settings.apiProvider;
  populateModels(settings.apiProvider);
  modelEl.value = settings.model;
  apiKeyEl.value = settings.apiKey;
  reviewStyleEl.value = settings.reviewStyle;
  githubTokenEl.value = settings.githubToken ?? '';
}

providerEl.addEventListener('change', () => {
  populateModels(providerEl.value as ApiProvider);
});

saveBtn.addEventListener('click', async () => {
  try {
    const key = apiKeyEl.value.trim();
    if (!key) {
      showStatus('Please enter an API key.', 'error');
      return;
    }

    // Preserve fields not exposed in the UI (maxFilesPerReview, maxPatchCharsPerFile)
    // so saving from the popup never silently resets them to hardcoded defaults.
    const existing = await getSettings();
    const settings: Settings = {
      ...existing,
      apiKey: key,
      apiProvider: providerEl.value as ApiProvider,
      model: modelEl.value,
      reviewStyle: reviewStyleEl.value as Settings['reviewStyle'],
      githubToken: githubTokenEl.value.trim() || undefined,
    };

    await saveSettings(settings);
    showStatus('Settings saved!', 'success');
  } catch {
    showStatus('Failed to save settings.', 'error');
  }
});

clearBtn.addEventListener('click', async () => {
  await clearSettings();
  await loadSettings();
  showStatus('Settings cleared.', 'success');
});

// Bootstrap
loadSettings();
