import { Settings, DEFAULT_SETTINGS } from '../types';

const STORAGE_KEY = 'prpilot_settings';

/**
 * Retrieves settings from chrome.storage.local.
 * Merges stored values over defaults so new fields survive extension updates.
 */
export async function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const stored = result[STORAGE_KEY];
      if (!stored || typeof stored !== 'object') {
        resolve({ ...DEFAULT_SETTINGS });
        return;
      }
      resolve({ ...DEFAULT_SETTINGS, ...stored });
    });
  });
}

/**
 * Persists settings to chrome.storage.local.
 */
export async function saveSettings(settings: Settings): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: settings }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Removes all saved settings, restoring defaults on next read.
 */
export async function clearSettings(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(STORAGE_KEY, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}
