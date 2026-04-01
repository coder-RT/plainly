# Privacy Policy — Plainly

**Last updated: April 2026**

## Overview

Plainly ("the extension") is a Chrome browser extension that explains highlighted text using an AI provider of your choice. This policy explains what data is handled, how it is used, and your rights.

---

## Data We Collect

**Plainly collects no personal data.**

We do not operate any backend server. We do not have analytics, telemetry, or tracking of any kind. There is nothing to collect because there is nowhere to send it.

---

## Data Stored Locally in Your Browser

The following information is stored **locally in your browser only**, using the Chrome `storage` API. It never leaves your device except as described in the "AI Provider" section below.

| Data | Where stored | Purpose |
|---|---|---|
| Your API key | `chrome.storage.sync` | Authenticate requests to your chosen AI provider |
| AI provider & model choice | `chrome.storage.sync` | Remember your settings |
| Explanation mode preference | `chrome.storage.sync` | Remember your preferred mode (ADHD, ELI5, etc.) |
| Custom prompt text | `chrome.storage.sync` | Remember your custom system prompt |
| Min. selection length | `chrome.storage.sync` | Remember your preference |
| Explanation history (last 20) | `chrome.storage.local` | Show recent explanations in the panel |
| Current explanation | `chrome.storage.session` | Display the active explanation |

You can clear all stored data at any time by removing the extension from Chrome, or by clearing extension storage via `chrome://settings/content/all`.

---

## Data Sent to AI Providers

When you highlight text and trigger an explanation, the selected text is sent **directly from your browser** to the AI provider you have configured (e.g. OpenAI, Groq, or a local Ollama instance). This request:

- Uses **your own API key** — Plainly has no API keys of its own
- Goes **directly to the provider's API** — it does not pass through any Plainly server
- Contains only the selected text and a system prompt — no page URL, no personal information, no browser history

You are subject to the privacy policy of whichever AI provider you choose:
- OpenAI: https://openai.com/policies/privacy-policy
- Groq: https://groq.com/privacy-policy/

---

## Data We Do Not Collect

- We do not collect your name, email address, or any personally identifiable information
- We do not collect your browsing history or the URLs of pages you visit
- We do not collect usage statistics or analytics
- We do not use cookies
- We do not use any third-party tracking or advertising services
- We do not sell, share, or transfer any data to any third party

---

## Children's Privacy

Plainly is not directed at children under 13. We do not knowingly collect any information from children.

---

## Changes to This Policy

If this policy changes, the updated version will be committed to this repository with a revised "Last updated" date.

---

## Contact

Questions or concerns? Email us at **getplainly@gmail.com** or open an issue on [GitHub](https://github.com/coder-RT/plainly/issues).
