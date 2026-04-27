import { ReviewResult, ReviewComment, Severity } from '../types';

const PANEL_ID = 'prpilot-panel';
const BUTTON_ID = 'prpilot-btn';

const SEVERITY_COLORS: Record<Severity, string> = {
  high: '#d73a49',
  medium: '#e36209',
  low: '#6f42c1',
  info: '#0366d6',
};

const SCORE_COLORS = (score: number): string => {
  if (score >= 8) return '#28a745';
  if (score >= 5) return '#e36209';
  return '#d73a49';
};

// Track the log element and pending auto-step timers so we can
// clear them when the panel transitions to a new state.
let _logEl: HTMLElement | null = null;
let _logTimers: ReturnType<typeof setTimeout>[] = [];
// Track copy-button reset timer to avoid stale-closure mutations (#3 from review).
let _copyResetTimer: ReturnType<typeof setTimeout> | null = null;

function clearLogTimers(): void {
  _logTimers.forEach(clearTimeout);
  _logTimers = [];
  _logEl = null;
}

function formatComment(comment: ReviewComment): string {
  const color = SEVERITY_COLORS[comment.severity];
  const fileTag = comment.file
    ? `<span style="font-family:monospace;font-size:11px;background:#f1f3f4;padding:1px 4px;border-radius:3px;">${comment.file}</span> `
    : '';
  const typeLabel = comment.type === 'issue' ? '⚠️' : comment.type === 'praise' ? '✅' : '💡';
  return `
    <div style="padding:10px 0;border-bottom:1px solid #e1e4e8;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <span>${typeLabel}</span>
        ${fileTag}
        <span style="font-size:11px;color:${color};font-weight:600;text-transform:uppercase;">${comment.severity}</span>
      </div>
      <p style="margin:0;font-size:13px;color:#24292e;line-height:1.5;">${comment.message}</p>
    </div>`;
}

/**
 * Injects the "AI Review" button into the GitHub PR page.
 */
export function injectReviewButton(onClick: () => void): void {
  if (document.getElementById(BUTTON_ID)) return;

  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.textContent = '🤖 AI Review';
  btn.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 9999;
    background: #0366d6;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  `;
  btn.addEventListener('click', onClick);
  document.body.appendChild(btn);
}

/**
 * Shows a loading panel with a live scrolling activity log.
 * Call addLoadingStep() to append real progress entries.
 * Auto-timed fallback messages keep it feeling active during long API calls.
 */
export function showLoadingPanel(): void {
  clearLogTimers();

  const panel = getOrCreatePanel();
  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
      <div id="prpilot-spinner" style="width:18px;height:18px;border:2px solid #e1e4e8;border-top-color:#0366d6;border-radius:50%;animation:prpilot-spin 0.8s linear infinite;flex-shrink:0;"></div>
      <h2 style="margin:0;font-size:15px;font-weight:600;color:#24292e;">Reviewing…</h2>
    </div>
    <div id="prpilot-log" style="
      font-size:12px;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',monospace;
      color:#586069;
      line-height:1.9;
      max-height:200px;
      overflow-y:auto;
    "></div>
    <style>
      @keyframes prpilot-spin { to { transform: rotate(360deg); } }
      @keyframes prpilot-fadein { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
    </style>`;

  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  _logEl = panel.querySelector('#prpilot-log');

  // Auto-timed fallback messages for when real steps are slow.
  const autoSteps: [number, string][] = [
    [200,   '→ Connecting to GitHub API…'],
    [8000,  '→ Still waiting for AI response…'],
    [20000, '→ Large PR — AI is still thinking…'],
    [40000, '→ Almost there…'],
  ];
  autoSteps.forEach(([delay, msg]) => {
    const t = setTimeout(() => {
      if (_logEl) appendLogLine(msg, '#959da5');
    }, delay);
    _logTimers.push(t);
  });
}

/**
 * Appends a step to the loading log. Call this from the content script
 * at real transition points (diff fetched, files counted, etc.).
 */
export function addLoadingStep(message: string): void {
  if (!_logEl) return;
  appendLogLine(`✓ ${message}`, '#28a745');
}

function appendLogLine(text: string, color: string): void {
  if (!_logEl) return;
  const line = document.createElement('div');
  line.textContent = text;
  line.style.cssText = `color:${color};animation:prpilot-fadein 0.25s ease;`;
  _logEl.appendChild(line);
  _logEl.scrollTop = _logEl.scrollHeight;
}

/**
 * Formats a ReviewResult as Markdown suitable for pasting into a PR comment.
 * Exported so it can be unit-tested independently.
 */
export function formatReviewAsText(result: ReviewResult): string {
  const lines: string[] = [
    `### PRPilot Review — ${result.overallScore}/10`,   // ### is less aggressive than ## in GH comments
    '',
    result.summary,
    '',
  ];
  // Iterating an empty array is a no-op — guard removed per review feedback.
  for (const c of result.comments) {
    const icon = c.type === 'issue' ? '⚠️' : c.type === 'praise' ? '✅' : '💡';
    const file = c.file ? ` \`${c.file}\`` : '';
    lines.push(`${icon} **[${c.severity.toUpperCase()}]**${file} ${c.message}`);
  }
  lines.push('', '*Generated by [PRPilot](https://github.com/ethbarr/prpilot)*');
  return lines.join('\n');
}

/**
 * Renders a completed review result in the panel.
 */
export function showReviewPanel(result: ReviewResult): void {
  clearLogTimers();
  if (_copyResetTimer) { clearTimeout(_copyResetTimer); _copyResetTimer = null; }

  const panel = getOrCreatePanel();
  const scoreColor = SCORE_COLORS(result.overallScore);
  const commentsHtml = result.comments.map(formatComment).join('');

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h2 style="margin:0;font-size:16px;font-weight:600;color:#24292e;">PRPilot Review</h2>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:20px;font-weight:700;color:${scoreColor};">${result.overallScore}/10</span>
        <button id="prpilot-copy" title="Copy review as Markdown" style="background:none;border:1px solid #d1d5da;border-radius:4px;cursor:pointer;font-size:13px;padding:2px 7px;color:#586069;">Copy</button>
        <button id="prpilot-close" style="background:none;border:none;cursor:pointer;font-size:18px;color:#586069;">✕</button>
      </div>
    </div>
    <p style="font-size:13px;color:#24292e;line-height:1.6;margin:0 0 16px;padding-bottom:16px;border-bottom:1px solid #e1e4e8;">${result.summary}</p>
    <div>${commentsHtml || '<p style="color:#586069;font-size:13px;">No specific issues found.</p>'}</div>
  `;

  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';

  document.getElementById('prpilot-close')?.addEventListener('click', hidePanel);

  const copyBtn = document.getElementById('prpilot-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      // Guard: clipboard API requires a secure context and may be undefined (#2 from review).
      if (!navigator.clipboard) {
        copyBtn.textContent = 'N/A';
        _copyResetTimer = setTimeout(() => { copyBtn.textContent = 'Copy'; _copyResetTimer = null; }, 2000);
        return;
      }
      navigator.clipboard.writeText(formatReviewAsText(result))
        .then(() => {
          if (_copyResetTimer) clearTimeout(_copyResetTimer);
          copyBtn.textContent = 'Copied!';
          // Store timer ID so a rapid second review can cancel this before mutating a stale button (#3).
          _copyResetTimer = setTimeout(() => { copyBtn.textContent = 'Copy'; _copyResetTimer = null; }, 2000);
        })
        .catch((err: unknown) => {
          // Surface failure rather than swallowing it (#1 from review).
          console.error('PRPilot: clipboard write failed', err);
          if (_copyResetTimer) clearTimeout(_copyResetTimer);
          copyBtn.textContent = 'Failed';
          _copyResetTimer = setTimeout(() => { copyBtn.textContent = 'Copy'; _copyResetTimer = null; }, 2000);
        });
    });
  }
}

/**
 * Shows an error message in the panel.
 */
export function showErrorPanel(message: string): void {
  clearLogTimers();
  const panel = getOrCreatePanel();
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <h2 style="margin:0;font-size:16px;font-weight:600;color:#d73a49;">Review Failed</h2>
      <button id="prpilot-close" style="background:none;border:none;cursor:pointer;font-size:18px;color:#586069;">✕</button>
    </div>
    <p style="font-size:13px;color:#586069;line-height:1.5;">${message}</p>
    <p style="font-size:12px;color:#959da5;margin-top:8px;">Check your API key in the PRPilot extension settings.</p>
  `;
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  document.getElementById('prpilot-close')?.addEventListener('click', hidePanel);
}

/**
 * Shows an inline setup form when no API key is configured.
 */
export function showSetupPanel(onSave: (apiKey: string, provider: string) => void, invalidKey = false): void {
  clearLogTimers();
  const panel = getOrCreatePanel();

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h2 style="margin:0;font-size:16px;font-weight:600;color:#24292e;">🤖 Quick Setup</h2>
      <button id="prpilot-close" style="background:none;border:none;cursor:pointer;font-size:18px;color:#586069;line-height:1;">✕</button>
    </div>
    ${invalidKey
      ? `<p style="font-size:12px;color:#d73a49;background:#ffeef0;border-radius:4px;padding:7px 10px;margin:0 0 12px;">API key rejected — please enter a valid key.</p>`
      : `<p style="font-size:13px;color:#586069;margin:0 0 16px;line-height:1.5;">Enter your AI API key once and PRPilot will remember it.</p>`
    }
    <div style="margin-bottom:12px;">
      <label style="display:block;font-size:12px;font-weight:600;color:#24292e;margin-bottom:5px;">AI Provider</label>
      <select id="prpilot-setup-provider" style="width:100%;padding:6px 8px;border:1px solid #d1d5da;border-radius:5px;font-size:13px;color:#24292e;background:#fff;cursor:pointer;">
        <option value="anthropic">Anthropic (Claude)</option>
        <option value="openai">OpenAI (GPT)</option>
      </select>
    </div>
    <div style="margin-bottom:4px;">
      <label style="display:block;font-size:12px;font-weight:600;color:#24292e;margin-bottom:5px;">API Key</label>
      <input type="password" id="prpilot-setup-key" placeholder="sk-ant-…" autocomplete="off"
        style="width:100%;padding:6px 8px;border:1px solid #d1d5da;border-radius:5px;font-size:13px;color:#24292e;background:#fff;box-sizing:border-box;" />
    </div>
    <p id="prpilot-key-hint" style="margin:5px 0 16px;font-size:11px;">
      <a id="prpilot-key-link" href="https://console.anthropic.com/settings/keys" target="_blank"
        style="color:#0366d6;text-decoration:none;">Get your Anthropic key →</a>
    </p>
    <button id="prpilot-setup-save"
      style="width:100%;padding:10px;background:#0366d6;color:#fff;border:none;border-radius:5px;font-size:14px;font-weight:600;cursor:pointer;">
      Save &amp; Review Now
    </button>
    <div id="prpilot-setup-err" style="margin-top:8px;font-size:12px;color:#d73a49;display:none;"></div>
  `;

  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';

  document.getElementById('prpilot-close')?.addEventListener('click', hidePanel);

  const providerEl = document.getElementById('prpilot-setup-provider') as HTMLSelectElement;
  const keyLinkEl  = document.getElementById('prpilot-key-link') as HTMLAnchorElement;
  const keyLinks: Record<string, { href: string; label: string }> = {
    anthropic: { href: 'https://console.anthropic.com/settings/keys', label: 'Get your Anthropic key →' },
    openai:    { href: 'https://platform.openai.com/api-keys',         label: 'Get your OpenAI key →' },
  };

  providerEl?.addEventListener('change', () => {
    const { href, label } = keyLinks[providerEl.value] ?? keyLinks['anthropic'];
    keyLinkEl.href = href;
    keyLinkEl.textContent = label;
    (document.getElementById('prpilot-setup-key') as HTMLInputElement).placeholder =
      providerEl.value === 'anthropic' ? 'sk-ant-…' : 'sk-…';
  });

  document.getElementById('prpilot-setup-save')?.addEventListener('click', () => {
    const key   = (document.getElementById('prpilot-setup-key') as HTMLInputElement)?.value.trim();
    const errEl = document.getElementById('prpilot-setup-err') as HTMLElement;
    if (!key) {
      errEl.textContent = 'Please enter your API key.';
      errEl.style.display = 'block';
      return;
    }
    errEl.style.display = 'none';
    onSave(key, providerEl?.value ?? 'anthropic');
  });
}

function hidePanel(): void {
  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.style.display = 'none';
}

function getOrCreatePanel(): HTMLElement {
  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      width: 380px;
      max-height: calc(100vh - 100px);
      overflow-y: auto;
      background: #fff;
      border: 1px solid #e1e4e8;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(149,157,165,0.3);
      padding: 20px;
      z-index: 9998;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      box-sizing: border-box;
    `;
    document.body.appendChild(panel);
  }
  return panel;
}
