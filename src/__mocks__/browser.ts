// Re-export jest-webextension-mock as 'browser' for webextension-polyfill compatibility
export default (globalThis as any).chrome;
