let debounceTimer = null;
let lastText = '';

document.addEventListener('mouseup', onInteraction);
document.addEventListener('keyup', onInteraction);

// Notify the panel when the user deselects text
document.addEventListener('selectionchange', () => {
  const text = window.getSelection()?.toString().trim() ?? '';
  if (!text && lastText) {
    lastText = '';
    try {
      chrome.runtime.sendMessage({ type: 'SELECTION_CLEARED' });
    } catch (_) {}
  }
});

function onInteraction() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(checkSelection, 400);
}

async function checkSelection() {
  const selection = window.getSelection();
  const text = selection?.toString().trim() ?? '';

  if (!text || text === lastText) return;

  try {
    const { minSelectionLength = 20 } = await chrome.storage.sync.get('minSelectionLength');
    if (text.length < minSelectionLength) return;

    lastText = text;

    chrome.runtime.sendMessage({
      type: 'TEXT_SELECTED',
      text,
      url: window.location.href,
      title: document.title,
    });
  } catch (_) {
    // Extension context may have been invalidated (e.g. after update) — silently ignore
  }
}
