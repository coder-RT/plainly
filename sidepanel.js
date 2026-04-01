// ── Links — update both before publishing ─────────────────────────────────────
const STORE_URL    = 'https://chromewebstore.google.com/detail/plainly/ekkeccmiolilkkaeehehoicddecmcanp/reviews';
const FEEDBACK_URL = 'https://github.com/coder-RT/plainly/issues/new?labels=feature-request&title=Feature+request:+';

// Show review banner after this many total explanations
const REVIEW_TRIGGER = 10;

// ── Constants (mirrored from options.js) ─────────────────────────────────────
const MODELS = {
  openai: [
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini (fast, recommended)' },
    { value: 'gpt-4o',      label: 'gpt-4o (more capable)' },
    { value: 'gpt-4-turbo', label: 'gpt-4-turbo' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (best)' },
    { value: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B (fastest)' },
    { value: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B' },
  ],
};

const KEY_HINTS = {
  openai:  'Get your <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI API key →</a>',
  groq:    'Get a free <a href="https://console.groq.com/keys" target="_blank">Groq API key →</a> (no credit card)',
  custom:  'Bearer token for auth. Leave blank for local Ollama.',
};

// ── Markdown renderer ─────────────────────────────────────────────────────────
function renderMarkdown(raw) {
  if (!raw) return '';

  let text = raw
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');

  const lines = text.split('\n');
  const out = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{2,3}\s+/.test(trimmed)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h3>${trimmed.replace(/^#{2,3}\s+/, '')}</h3>`);
      continue;
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)/);
    if (bullet) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li><span>${bullet[1]}</span></li>`);
      continue;
    }
    if (inList) { out.push('</ul>'); inList = false; }
    if (trimmed) out.push(`<p>${trimmed}</p>`);
  }
  if (inList) out.push('</ul>');
  return out.join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// ── View management ───────────────────────────────────────────────────────────
function showMain() {
  document.getElementById('mainView').style.display = 'flex';
  document.getElementById('settingsView').style.display = 'none';
}

function showSettings() {
  document.getElementById('mainView').style.display = 'none';
  document.getElementById('settingsView').style.display = 'flex';
  loadSettingsForm();
}

// ── State ─────────────────────────────────────────────────────────────────────
let currentMode = 'adhd';
let currentEntry = null;
let sSelectedProvider = 'openai';
let isEnabled = true;

// ── Toggle (enable / disable) ─────────────────────────────────────────────────
function syncToggleUI(enabled) {
  const btn = document.getElementById('toggleBtn');
  const label = document.getElementById('toggleLabel');
  if (!btn) return;
  btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  btn.title = enabled ? 'Plainly is ON — click to pause' : 'Plainly is OFF — click to resume';
  if (label) label.textContent = enabled ? 'ON' : 'OFF';
}

document.getElementById('toggleBtn')?.addEventListener('click', async () => {
  isEnabled = !isEnabled;
  await chrome.storage.sync.set({ enabled: isEnabled });
  syncToggleUI(isEnabled);

  // Re-render main area to show/hide the paused card
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  const { current } = await chrome.storage.session.get('current');
  if (!isEnabled) {
    renderPaused();
  } else if (current) {
    renderEntry(current, apiKey);
  } else {
    renderEmpty(apiKey);
  }
});

// ── Footer & review banner ────────────────────────────────────────────────────
function initFooter() {
  document.getElementById('footerReviewLink')?.setAttribute('href', STORE_URL);
  document.getElementById('footerFeedbackLink')?.setAttribute('href', FEEDBACK_URL);
  document.getElementById('reviewLink')?.setAttribute('href', STORE_URL);
}

async function checkReviewPrompt() {
  const { totalExplanations = 0, reviewDismissed = false } =
    await chrome.storage.local.get(['totalExplanations', 'reviewDismissed']);
  const banner = document.getElementById('reviewBanner');
  if (banner) {
    banner.style.display =
      !reviewDismissed && totalExplanations >= REVIEW_TRIGGER ? 'flex' : 'none';
  }
}

document.getElementById('dismissReviewBtn')?.addEventListener('click', async () => {
  await chrome.storage.local.set({ reviewDismissed: true });
  document.getElementById('reviewBanner').style.display = 'none';
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const settings = await chrome.storage.sync.get(['mode', 'apiKey', 'customPrompt', 'enabled']);
  currentMode = settings.mode || 'adhd';
  isEnabled = settings.enabled !== false; // default ON
  syncModeButtons();
  syncCustomPromptBar(settings.customPrompt || '');
  syncToggleUI(isEnabled);

  if (!isEnabled) {
    renderPaused();
  } else {
    const { current } = await chrome.storage.session.get('current');
    if (current) {
      renderEntry(current, settings.apiKey);
    } else {
      renderEmpty(settings.apiKey);
    }
  }

  await renderHistory();
  initFooter();
  await checkReviewPrompt();
}

// ── Mode UI ───────────────────────────────────────────────────────────────────
function syncModeButtons() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === currentMode);
  });
}

function syncCustomPromptBar(savedPrompt = '') {
  const bar = document.getElementById('customPromptBar');
  const isCustom = currentMode === 'custom';
  bar.style.display = isCustom ? 'flex' : 'none';
  if (isCustom) {
    const textarea = document.getElementById('inlineCustomPrompt');
    // Only set if empty so user doesn't lose mid-edit text on re-render
    if (!textarea.value && savedPrompt) textarea.value = savedPrompt;
  }
}

// ── Render: empty state ───────────────────────────────────────────────────────
function renderEmpty(apiKey) {
  const main = document.getElementById('main');

  if (!apiKey) {
    main.innerHTML = `
      <div class="setup-card">
        <h3>Welcome to Plainly 👋</h3>
        <p>Add an API key in Settings to start getting explanations for any text you highlight.</p>
        <button class="btn btn-primary" id="openSettingsBtn">Open Settings →</button>
      </div>
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 6h16M4 12h16M4 18h7"/>
          </svg>
        </div>
        <h3>Highlight to understand</h3>
        <p>Select text on any webpage, or right-click selected text and choose <strong>Explain with Plainly</strong>.</p>
      </div>`;
    document.getElementById('openSettingsBtn')?.addEventListener('click', showSettings);
  } else {
    main.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 6h16M4 12h16M4 18h7"/>
          </svg>
        </div>
        <h3>Highlight anything</h3>
        <p>Select text on any webpage — or right-click and choose <strong>Explain with Plainly</strong>.</p>
      </div>
      <div class="tip-card">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>Keep this panel open while browsing for instant explanations.</span>
      </div>`;
  }
}

// ── Render: paused state ──────────────────────────────────────────────────────
function renderPaused() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="paused-card">
      <div class="paused-card-icon">⏸️</div>
      <div class="paused-card-title">Plainly is paused</div>
      <div class="paused-card-sub">Highlighting text won't trigger any explanations.<br>Toggle <strong>ON</strong> to resume.</div>
    </div>`;
}

// ── Render: entry ─────────────────────────────────────────────────────────────
function renderEntry(entry, apiKey) {
  const main = document.getElementById('main');
  currentEntry = entry;

  if (!apiKey && entry.status !== 'done') {
    renderEmpty(null);
    return;
  }

  let html = '';

  if (entry.status === 'loading') {
    html = `
      <div class="loading-card">
        <div class="spinner"></div>
        <div class="loading-text">Thinking…</div>
      </div>`;

  } else if (entry.status === 'error') {
    if (entry.errorCode === 'NO_API_KEY') {
      html = `
        <div class="setup-card">
          <h3>API key needed</h3>
          <p>Add your OpenAI or Groq key in Settings, or point Plainly at a local Ollama server.</p>
          <button class="btn btn-primary" id="openSettingsBtn">Open Settings →</button>
        </div>`;
    } else {
      html = `
        <div class="error-card">
          <div class="error-title">Something went wrong</div>
          <div class="error-message">${escapeHtml(entry.error || 'Check your API key in settings.')}</div>
        </div>`;
    }

  } else if (entry.status === 'done') {
    html = `
      <div class="selected-card">
        <div class="card-label">You selected</div>
        <div class="selected-text">${escapeHtml(entry.text)}</div>
      </div>
      <div class="explanation-card">
        <div class="explanation-header">
          <span class="card-label" style="margin:0">Explanation</span>
          <button class="copy-btn" id="copyBtn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy
          </button>
        </div>
        <div class="explanation-body">${renderMarkdown(entry.explanation)}</div>
      </div>`;
  }

  main.innerHTML = html;
  document.getElementById('openSettingsBtn')?.addEventListener('click', showSettings);
  document.getElementById('copyBtn')?.addEventListener('click', () => copyText(entry.explanation));
}

async function copyText(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('copyBtn');
    if (!btn) return;
    btn.classList.add('copied');
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
    }, 2000);
  } catch (_) {}
}

// ── History ───────────────────────────────────────────────────────────────────
async function renderHistory() {
  const { history = [] } = await chrome.storage.local.get('history');
  const section = document.getElementById('historySection');
  const list = document.getElementById('historyList');

  if (history.length === 0) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  list.innerHTML = history.map((item, i) => `
    <div class="history-item" data-index="${i}">
      <div class="history-item-text">${escapeHtml(item.text.slice(0, 65))}${item.text.length > 65 ? '…' : ''}</div>
      <div class="history-item-meta">${timeAgo(item.timestamp)}</div>
    </div>`).join('');

  list.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      const item = history[parseInt(el.dataset.index)];
      // Restore the mode that was active when this explanation was made
      if (item.mode) {
        currentMode = item.mode;
        syncModeButtons();
      }
      renderEntry({ ...item, status: 'done' }, true);
    });
  });
}

// ── Inline Settings ───────────────────────────────────────────────────────────
async function loadSettingsForm() {
  const s = await chrome.storage.sync.get([
    'provider', 'apiKey', 'model', 'mode',
    'customPrompt', 'customEndpoint', 'customModel', 'minSelectionLength',
  ]);

  sSelectedProvider = s.provider || 'openai';
  setSettingsProvider(sSelectedProvider, false);

  document.getElementById('sApiKey').value          = s.apiKey || '';
  document.getElementById('sCustomEndpoint').value  = s.customEndpoint || '';
  document.getElementById('sCustomModel').value     = s.customModel || '';
  document.getElementById('sCustomPrompt').value    = s.customPrompt || '';
  document.getElementById('sMinLength').value       = s.minSelectionLength ?? 20;

  updateSettingsModelOptions(sSelectedProvider);
  const modelEl = document.getElementById('sModel');
  if (s.model && modelEl.querySelector(`option[value="${s.model}"]`)) {
    modelEl.value = s.model;
  }

  const modeInput = document.querySelector(`input[name="sMode"][value="${s.mode || 'adhd'}"]`);
  if (modeInput) modeInput.checked = true;
  toggleSettingsCustomPrompt(s.mode);
}

function setSettingsProvider(provider, updateRadio = true) {
  sSelectedProvider = provider;

  document.querySelectorAll('.s-provider-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.provider === provider);
  });

  if (updateRadio) {
    const radio = document.querySelector(`input[name="sProvider"][value="${provider}"]`);
    if (radio) radio.checked = true;
  }

  const isCustom = provider === 'custom';
  document.getElementById('sCustomSection').style.display  = isCustom ? 'flex' : 'none';
  document.getElementById('sModelSection').style.display   = isCustom ? 'none' : 'block';
  document.getElementById('sKeyHint').innerHTML = KEY_HINTS[provider] || '';

  updateSettingsModelOptions(provider);
}

function updateSettingsModelOptions(provider) {
  const models = MODELS[provider];
  if (!models) return;
  document.getElementById('sModel').innerHTML =
    models.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
}

function toggleSettingsCustomPrompt(mode) {
  document.getElementById('sCustomPromptSection').style.display =
    mode === 'custom' ? 'flex' : 'none';
}

// Provider card clicks in settings
document.querySelectorAll('.s-provider-card').forEach(card => {
  card.addEventListener('click', () => setSettingsProvider(card.dataset.provider));
});

document.querySelectorAll('input[name="sProvider"]').forEach(radio => {
  radio.addEventListener('change', () => setSettingsProvider(radio.value));
});

// Mode radio in settings
document.querySelectorAll('input[name="sMode"]').forEach(radio => {
  radio.addEventListener('change', () => toggleSettingsCustomPrompt(radio.value));
});

// API key visibility toggle
let sKeyVisible = false;
document.getElementById('sToggleKey').addEventListener('click', () => {
  sKeyVisible = !sKeyVisible;
  document.getElementById('sApiKey').type = sKeyVisible ? 'text' : 'password';
  document.getElementById('sEyeIcon').innerHTML = sKeyVisible
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
});

// Save settings
document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const mode = document.querySelector('input[name="sMode"]:checked')?.value || 'adhd';

  await chrome.storage.sync.set({
    provider:           sSelectedProvider,
    apiKey:             document.getElementById('sApiKey').value.trim(),
    model:              document.getElementById('sModel').value,
    mode,
    customPrompt:       document.getElementById('sCustomPrompt').value.trim(),
    customEndpoint:     document.getElementById('sCustomEndpoint').value.trim(),
    customModel:        document.getElementById('sCustomModel').value.trim(),
    minSelectionLength: parseInt(document.getElementById('sMinLength').value, 10) || 20,
  });

  // Update current mode in main view and sync the custom prompt bar
  currentMode = mode;
  syncModeButtons();
  syncCustomPromptBar(document.getElementById('sCustomPrompt').value);

  // Navigate back to main view and re-render so the "Open Settings" welcome
  // card is replaced with the ready state now that a key exists.
  showMain();
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  const { current } = await chrome.storage.session.get('current');
  if (current) {
    renderEntry(current, apiKey);
  } else {
    renderEmpty(apiKey);
  }
});

// ── Main view event bindings ──────────────────────────────────────────────────
document.getElementById('settingsBtn').addEventListener('click', showSettings);
document.getElementById('backBtn').addEventListener('click', showMain);

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    currentMode = btn.dataset.mode;
    await chrome.storage.sync.set({ mode: currentMode });
    syncModeButtons();

    const { customPrompt } = await chrome.storage.sync.get('customPrompt');
    syncCustomPromptBar(customPrompt || '');

    // Don't auto-re-explain when switching to Custom — wait for Apply
    if (currentMode !== 'custom' && currentEntry?.text) {
      chrome.runtime.sendMessage({
        type: 'RE_EXPLAIN',
        text: currentEntry.text,
        url: currentEntry.url,
        title: currentEntry.title,
      });
    }
  });
});

// Auto-save the inline custom prompt as the user types (debounced)
let customPromptSaveTimer = null;
document.getElementById('inlineCustomPrompt').addEventListener('input', () => {
  clearTimeout(customPromptSaveTimer);
  customPromptSaveTimer = setTimeout(async () => {
    const value = document.getElementById('inlineCustomPrompt').value.trim();
    await chrome.storage.sync.set({ customPrompt: value });
  }, 600);
});

// Apply button: save + re-explain with the current inline prompt
document.getElementById('applyCustomPromptBtn').addEventListener('click', async () => {
  const value = document.getElementById('inlineCustomPrompt').value.trim();
  await chrome.storage.sync.set({ customPrompt: value });

  if (currentEntry?.text) {
    chrome.runtime.sendMessage({
      type: 'RE_EXPLAIN',
      text: currentEntry.text,
      url: currentEntry.url,
      title: currentEntry.title,
    });
  }
});

document.getElementById('clearHistoryBtn').addEventListener('click', async () => {
  await chrome.storage.local.set({ history: [] });
  await renderHistory();
});

// ── Storage listener ──────────────────────────────────────────────────────────
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'session') return;

  if (changes.current) {
    const entry = changes.current.newValue;
    const { apiKey } = await chrome.storage.sync.get('apiKey');

    // If in settings view, switch back to main to show the result
    showMain();
    renderEntry(entry, apiKey);
    if (entry?.status === 'done') {
      await renderHistory();
      await checkReviewPrompt();
    }
  }

  if (changes.selectionActive) {
    const active = changes.selectionActive.newValue;
    const card = document.querySelector('.selected-card');
    if (card) card.classList.toggle('dimmed', !active);
  }
});

init();
