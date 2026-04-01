import * as prompts from './prompts/index.js';

// All built-in system prompts — add/remove modes in prompts/index.js
const SYSTEM_PROMPTS = { ...prompts };

const PROVIDER_DEFAULTS = {
  openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
  groq:   { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
};

// Open the side panel when the toolbar icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get('provider');
  if (!existing.provider) {
    await chrome.storage.sync.set({
      provider: 'openai',
      apiKey: '',
      model: 'gpt-4o-mini',
      mode: 'adhd',
      customPrompt: '',
      customEndpoint: '',
      customModel: '',
      minSelectionLength: 20,
      enabled: true,
    });
  }

  // Right-click context menu — works on any page without needing content script injection
  chrome.contextMenus.create({
    id: 'plainly-explain',
    title: 'Explain with Plainly',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'plainly-explain' && info.selectionText) {
    const { enabled = true } = await chrome.storage.sync.get('enabled');
    if (!enabled) return;
    handleTextSelected(
      { text: info.selectionText.trim(), url: tab.url, title: tab.title },
      tab.id
    );
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'TEXT_SELECTED') {
    const tabId = sender.tab?.id;

    // Open panel SYNCHRONOUSLY here — user gesture context is still alive.
    // Moving this inside a .then() would lose the gesture and sidePanel.open
    // would silently fail.
    if (tabId) {
      try { chrome.sidePanel.open({ tabId }); } catch (_) {}
    }

    // Mark selection as active so the panel un-dims the selected card
    chrome.storage.session.set({ selectionActive: true });

    // Check enabled asynchronously — gesture context no longer needed here
    chrome.storage.sync.get('enabled').then(({ enabled = true }) => {
      if (enabled) handleTextSelected(msg, tabId);
    });

    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === 'RE_EXPLAIN') {
    handleReExplain(msg);
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === 'SELECTION_CLEARED') {
    chrome.storage.session.set({ selectionActive: false });
    sendResponse({ ok: true });
    return false;
  }
});

async function handleTextSelected(msg, tabId) {
  // sidePanel.open is called synchronously in the message listener above
  // so it is no longer needed here.

  await chrome.storage.session.set({
    current: {
      status: 'loading',
      text: msg.text,
      url: msg.url,
      title: msg.title,
      timestamp: Date.now(),
    },
  });

  await fetchExplanation(msg.text, msg.url, msg.title);
}

async function handleReExplain(msg) {
  await chrome.storage.session.set({
    current: {
      status: 'loading',
      text: msg.text,
      url: msg.url,
      title: msg.title,
      timestamp: Date.now(),
    },
  });
  await fetchExplanation(msg.text, msg.url, msg.title);
}

async function fetchExplanation(text, url, title) {
  const settings = await chrome.storage.sync.get([
    'provider', 'apiKey', 'model', 'mode',
    'customPrompt', 'customEndpoint', 'customModel',
  ]);

  const hasKey = settings.apiKey && settings.apiKey.trim().length > 0;
  const hasCustomEndpoint = settings.customEndpoint && settings.customEndpoint.trim().length > 0;

  if (!hasKey && !hasCustomEndpoint) {
    await updateCurrent({ status: 'error', errorCode: 'NO_API_KEY' });
    return;
  }

  try {
    const systemPrompt =
      settings.mode === 'custom'
        ? settings.customPrompt || SYSTEM_PROMPTS.adhd
        : SYSTEM_PROMPTS[settings.mode] || SYSTEM_PROMPTS.adhd;

    let apiUrl, model, apiKey;

    if (hasCustomEndpoint) {
      apiUrl  = settings.customEndpoint.trim();
      model   = settings.customModel?.trim() || 'llama3.2';
      apiKey  = settings.apiKey?.trim() || 'none';
    } else {
      const provider = PROVIDER_DEFAULTS[settings.provider] || PROVIDER_DEFAULTS.openai;
      apiUrl  = provider.url;
      model   = settings.model || provider.model;
      apiKey  = settings.apiKey.trim();
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Explain this:\n\n"${text}"` },
        ],
        max_tokens: 400,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const explanation = data.choices?.[0]?.message?.content?.trim();

    if (!explanation) throw new Error('Empty response from API');

    const entry = {
      status: 'done',
      text,
      url,
      title,
      explanation,
      mode: settings.mode || 'adhd',
      model: data.model,
      timestamp: Date.now(),
    };

    await chrome.storage.session.set({ current: entry });
    await addToHistory(entry);
  } catch (err) {
    await updateCurrent({ status: 'error', error: err.message });
  }
}

async function updateCurrent(patch) {
  const { current } = await chrome.storage.session.get('current');
  await chrome.storage.session.set({ current: { ...(current || {}), ...patch } });
}

async function addToHistory(entry) {
  const { history = [], totalExplanations = 0 } =
    await chrome.storage.local.get(['history', 'totalExplanations']);

  history.unshift({
    text: entry.text,
    explanation: entry.explanation,
    mode: entry.mode,
    url: entry.url,
    title: entry.title,
    timestamp: entry.timestamp,
  });

  await chrome.storage.local.set({
    history: history.slice(0, 20),
    totalExplanations: totalExplanations + 1,
  });
}
