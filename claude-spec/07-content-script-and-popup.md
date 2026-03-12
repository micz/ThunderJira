# Content Script

## Overview

`message-overlay.js` is injected into every email rendered by Thunderbird. Its job is to:
1. Detect Jira issue URLs in the email DOM.
2. Replace them with interactive badge elements that open the issue in the browser.
3. Write the current email context to `storage.session` for use by tab apps.

---

## Injection Mechanism

Both content scripts are registered in `manifest.json` as `message_display_scripts`:

```json
"message_display_scripts": [
  {
    "js": ["content-scripts/message-overlay.js"],
    "run_at": "document_end"
  },
  {
    "js": ["content-scripts/selection-capture.js"],
    "run_at": "document_end"
  }
]
```

`document_end` guarantees the email DOM is fully parsed before the script runs. The script does not run in every arbitrary web page — it runs only in Thunderbird's message display frame, which renders the email body HTML.

---

## Jira Link Detection

The script walks all text nodes in the email DOM and matches Jira issue URLs using the following regex:

```js
const JIRA_LINK_REGEX = /(https?:\/\/[^\s"<>]+\/browse\/([A-Z]+-\d+))/g
```

Capture groups:
- Group 1: Full URL (e.g. `https://mycompany.atlassian.net/browse/PROJ-123`)
- Group 2: Issue key (e.g. `PROJ-123`)

The regex matches:
- Both HTTP and HTTPS
- Any subdomain or self-hosted host
- Standard Jira URL pattern `/browse/ISSUEKEY`
- Issue keys of the form: one or more uppercase letters, a hyphen, one or more digits

---

## Link Enrichment — Badge Replacement

For each matched URL, the script replaces the plain `<a>` element with a styled badge `<span>`:

```js
function enrichLink(anchorElement, issueKey) {
  const badge = document.createElement('span')
  badge.className = 'jira-badge'
  badge.dataset.issueKey = issueKey
  badge.textContent = issueKey
  badge.setAttribute('role', 'button')
  badge.setAttribute('tabindex', '0')
  anchorElement.replaceWith(badge)

  badge.addEventListener('click', (e) => {
    e.stopPropagation()
    window.open(anchorElement.href, '_blank')
  })
}
```

The badge is styled via a `<style>` tag injected once into the document head:

```css
.jira-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
  background-color: var(--jira-blue, #0052cc);
  color: #fff;
  cursor: pointer;
  user-select: none;
}
```

Note: CSS custom properties from `tokens.css` are not available in the email DOM context. The badge falls back to literal values via `var(--jira-blue, #0052cc)`.

---

---

## `selection-capture.js` — On-Demand Selection Capture

`src/content-scripts/selection-capture.js` listens for a `GET_SELECTION` message sent by the background script (via `browser.tabs.sendMessage`) and replies with the current text selection, as both plain text and HTML.

```js
browser.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'GET_SELECTION') return

  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    return Promise.resolve({ text: '', html: '' })
  }

  const text = sel.toString().trim()
  if (!text) return Promise.resolve({ text: '', html: '' })

  const range = sel.getRangeAt(0)
  const fragment = range.cloneContents()
  const div = document.createElement('div')
  div.appendChild(fragment)

  return Promise.resolve({ text, html: div.innerHTML })
})
```

The background calls this before storing the email context. If `text` is non-empty, it overrides `bodyText`, `bodyHtml`, and `bodyDescription` in the stored context. If the call fails (e.g. no content script available yet), the background falls back silently to the full email body.

---

## Email Context Writing

In addition to link enrichment, `message-overlay.js` writes the current email's context to `storage.session` so that tab apps can read it:

```js
async function writeEmailContext() {
  const messageId = new URLSearchParams(window.location.search).get('messageId')
  // Use the mailTabs / messages APIs via sendMessage to the background
  const response = await browser.runtime.sendMessage({
    type: GET_EMAIL_CONTEXT,
    payload: { messageId }
  })
  if (response.data) {
    await browser.storage.session.set({ emailContext: response.data })
  }
}

document.addEventListener('DOMContentLoaded', writeEmailContext)
```
