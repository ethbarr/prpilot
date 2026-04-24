import { getSettings, saveSettings, clearSettings } from './storage';
import { DEFAULT_SETTINGS, Settings } from '../types';

// Manual in-memory mock for chrome.storage.local — jest-webextension-mock's
// get(string) implementation has a known bug, so we provide a proper one here.
const store: Record<string, unknown> = {};

beforeAll(() => {
  jest.spyOn(chrome.storage.local, 'get').mockImplementation((key: any, callback: any) => {
    const result: Record<string, unknown> = {};
    if (typeof key === 'string') {
      result[key] = store[key];
    } else if (key === null || key === undefined) {
      Object.assign(result, store);
    } else if (Array.isArray(key)) {
      key.forEach((k: string) => (result[k] = store[k]));
    }
    callback(result);
    return undefined as any;
  });

  jest.spyOn(chrome.storage.local, 'set').mockImplementation((items: any, callback?: any) => {
    Object.assign(store, items);
    callback?.();
    return undefined as any;
  });

  jest.spyOn(chrome.storage.local, 'remove').mockImplementation((key: any, callback?: any) => {
    if (typeof key === 'string') delete store[key];
    else if (Array.isArray(key)) key.forEach((k: string) => delete store[k]);
    callback?.();
    return undefined as any;
  });
});

beforeEach(() => {
  // Clear in-memory store before each test
  Object.keys(store).forEach((k) => delete store[k]);
});

describe('storage adapter', () => {
  describe('getSettings', () => {
    it('returns default settings when storage is empty', async () => {
      const settings = await getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('returns saved settings merged over defaults', async () => {
      store['prpilot_settings'] = { apiKey: 'sk-test-123', apiProvider: 'openai' };
      const settings = await getSettings();
      expect(settings.apiKey).toBe('sk-test-123');
      expect(settings.apiProvider).toBe('openai');
      // Defaults still fill in missing fields
      expect(settings.reviewStyle).toBe(DEFAULT_SETTINGS.reviewStyle);
    });

    it('handles corrupt storage gracefully by returning defaults', async () => {
      store['prpilot_settings'] = null;
      const settings = await getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('saveSettings', () => {
    it('persists settings to chrome.storage.local', async () => {
      const newSettings: Settings = {
        ...DEFAULT_SETTINGS,
        apiKey: 'anthropic-key-abc',
        apiProvider: 'anthropic',
        reviewStyle: 'security',
      };
      await saveSettings(newSettings);
      const retrieved = await getSettings();
      expect(retrieved.apiKey).toBe('anthropic-key-abc');
      expect(retrieved.reviewStyle).toBe('security');
    });

    it('overwrites previously saved settings', async () => {
      await saveSettings({ ...DEFAULT_SETTINGS, apiKey: 'first-key' });
      await saveSettings({ ...DEFAULT_SETTINGS, apiKey: 'second-key' });
      const settings = await getSettings();
      expect(settings.apiKey).toBe('second-key');
    });
  });

  describe('clearSettings', () => {
    it('removes saved settings and restores defaults on next read', async () => {
      await saveSettings({ ...DEFAULT_SETTINGS, apiKey: 'some-key' });
      await clearSettings();
      const settings = await getSettings();
      expect(settings.apiKey).toBe('');
    });
  });
});
