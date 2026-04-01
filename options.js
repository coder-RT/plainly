const MODELS = {
  openai: [
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini — fast & cheap (recommended)' },
    { value: 'gpt-4o',      label: 'gpt-4o — more capable' },
    { value: 'gpt-4-turbo', label: 'gpt-4-turbo' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B — best quality' },
    { value: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B — fastest' },
    { value: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B' },
  ],
};

const KEY_HINTS = {
  openai: 'Get your <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI API key →</a>',
  groq:   'Get a free <a href="https://console.groq.com/keys" target="_blank">Groq API key →</a> — no credit card needed.',
  custom: 'If your endpoint requires auth, paste the bearer token here. Leave blank for local Ollama.',
};

let selectedProvider = 'openai';

// ── Load ──────────────────────────────────────────────────────────────────────
async function load() {
  const s = await chrome.storage.sync.get([
    'provider', 'apiKey', 'model', 'mode',
    'customPrompt', 'customEndpoint', 'customModel',
    'minSelectionLength',
  ]);

  selectedProvider = s.provider || 'openai';
  setProvider(selectedProvider);

  document.getElementById('apiKey').value = s.apiKey || '';

  updateModelOptions(selectedProvider);
  const modelEl = document.getElementById('model');
  if (s.model && modelEl.querySelector(`option[value="${s.model}"]`)) {
    modelEl.value = s.model;
  }

  const modeInput = document.querySelector(`input[name="mode"][value="${s.mode || 'adhd'}"]`);
  if (modeInput) modeInput.checked = true;
  toggleCustomPrompt(s.mode);

  document.getElementById('customEndpoint').value  = s.customEndpoint || '';
  document.getElementById('customModel').value     = s.customModel || '';
  document.getElementById('customPrompt').value    = s.customPrompt || '';
  document.getElementById('minSelectionLength').value = s.minSelectionLength ?? 20;
}

// ── Provider selection ────────────────────────────────────────────────────────
function setProvider(provider) {
  selectedProvider = provider;

  // Highlight cards
  document.querySelectorAll('.provider-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.provider === provider);
  });

  // Sync radio
  const radio = document.querySelector(`input[name="provider"][value="${provider}"]`);
  if (radio) radio.checked = true;

  // Show/hide sections
  const isCustom = provider === 'custom';
  document.getElementById('customSection').style.display  = isCustom ? 'block' : 'none';
  document.getElementById('modelSection').style.display   = isCustom ? 'none'  : 'block';

  // Key hint
  document.getElementById('keyHint').innerHTML = KEY_HINTS[provider] || '';

  updateModelOptions(provider);
}

function updateModelOptions(provider) {
  const models = MODELS[provider];
  if (!models) return;
  const select = document.getElementById('model');
  select.innerHTML = models.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
}

// Provider card clicks
document.querySelectorAll('.provider-card').forEach(card => {
  card.addEventListener('click', () => setProvider(card.dataset.provider));
});

// Radio fallback (keyboard)
document.querySelectorAll('input[name="provider"]').forEach(radio => {
  radio.addEventListener('change', () => setProvider(radio.value));
});

// ── Mode selection ────────────────────────────────────────────────────────────
function toggleCustomPrompt(mode) {
  document.getElementById('customPromptSection').style.display =
    mode === 'custom' ? 'block' : 'none';
}

document.querySelectorAll('input[name="mode"]').forEach(radio => {
  radio.addEventListener('change', () => toggleCustomPrompt(radio.value));
});

// ── API key visibility toggle ─────────────────────────────────────────────────
let keyVisible = false;
document.getElementById('toggleKey').addEventListener('click', () => {
  keyVisible = !keyVisible;
  document.getElementById('apiKey').type = keyVisible ? 'text' : 'password';
  document.getElementById('eyeIcon').innerHTML = keyVisible
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
});

// ── Save ──────────────────────────────────────────────────────────────────────
document.getElementById('saveBtn').addEventListener('click', async () => {
  const mode = document.querySelector('input[name="mode"]:checked')?.value || 'adhd';

  await chrome.storage.sync.set({
    provider:           selectedProvider,
    apiKey:             document.getElementById('apiKey').value.trim(),
    model:              document.getElementById('model').value,
    mode,
    customPrompt:       document.getElementById('customPrompt').value.trim(),
    customEndpoint:     document.getElementById('customEndpoint').value.trim(),
    customModel:        document.getElementById('customModel').value.trim(),
    minSelectionLength: parseInt(document.getElementById('minSelectionLength').value, 10) || 20,
  });

  const alert = document.getElementById('saveAlert');
  alert.style.display = 'block';
  setTimeout(() => { alert.style.display = 'none'; }, 3000);
});

load();
