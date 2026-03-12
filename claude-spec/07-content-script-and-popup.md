# Content Script

## Overview

`message-overlay.js` is injected into every email rendered by Thunderbird. Its job is to:
1. Detect Jira issue URLs in the email DOM.
2. Replace them with interactive badge elements.
3. Show a lightweight **tooltip** on hover with the issue key, status, and summary.
4. Show a full **details panel** on click with all issue metadata.

---

## Injection Mechanism

Both content scripts are registered dynamically via `browser.scripting.messageDisplay.registerScripts()` in `background.js` (not in manifest.json directly):

```js
browser.scripting.messageDisplay.registerScripts([
  { id: "message-overlay", js: ["/content-scripts/message-overlay.js"] },
  { id: "selection-capture", js: ["/content-scripts/selection-capture.js"] }
])
```

The script runs at `document_end`, guaranteeing the email DOM is fully parsed. It runs only in Thunderbird's message display frame, not in arbitrary web pages.

---

## Jira Link Detection

The script scans all `<a>` elements in the DOM and matches Jira issue URLs using:

```js
const JIRA_LINK_REGEX = /(https?:\/\/[^\s"<>]+\/browse\/([A-Z]+-\d+))/g
```

Capture groups:
- Group 1: Full URL (e.g. `https://mycompany.atlassian.net/browse/PROJ-123`)
- Group 2: Issue key (e.g. `PROJ-123`)

Each matched anchor is replaced with a badge element. Already-processed badges are skipped via the `data-jira-enriched` attribute.

---

## Badge Replacement

For each matched URL, the `<a>` element is replaced with a styled `<span>`:

```js
function enrichLink(anchor, issueKey, fullUrl) {
  const badge = document.createElement('span')
  badge.className = 'jira-badge'
  badge.dataset.issueKey = issueKey
  badge.dataset.jiraUrl = fullUrl
  badge.dataset.jiraEnriched = 'true'
  badge.textContent = issueKey
  badge.setAttribute('role', 'button')
  badge.setAttribute('tabindex', '0')
  anchor.replaceWith(badge)
  // ...hover and click listeners registered
}
```

Styles are injected once into `<head>` via `<style id="jira-overlay-styles">`. On re-injection, the existing style tag is detected and skipped. CSS custom properties from `tokens.css` are not available in the email DOM — all values are literal hex codes.

---

## Two-Level Interaction

### Tooltip (hover)

A lightweight tooltip appears after a short delay when hovering over a badge.

**Timer constants:**
- `TOOLTIP_SHOW_DELAY_MS = 300` — ms before the tooltip appears after mouseenter
- `TOOLTIP_HIDE_DELAY_MS = 200` — grace period after mouseleave before hiding (allows re-entering without flicker)

**Content:**
- Loading state: `browser.i18n.getMessage('tooltipLoading')`
- Error state: `browser.i18n.getMessage('tooltipErrorLoad')`
- Data state: issue key (blue) + colored status badge on one line, truncated summary (max 80 chars) on the next

The tooltip has `pointer-events: none` — it never interferes with mouse movement.

### Panel (click)

Clicking a badge opens a full details panel. Clicking the same badge again closes it (toggle).

**Panel content:**
- Header: issue key + summary + close (✕) button
- Body rows: Status (colored badge), Assignee, Priority, Description (truncated to 200 chars)
- Footer: "Open in Jira ↗" button

A transparent `jira-panel-overlay` div covers the full viewport behind the panel; clicking it closes the panel. Pressing `Escape` also closes the panel. The keydown listener is registered when the panel opens and removed when it closes.

---

## Viewport-Aware Positioning

Both the tooltip and panel are positioned with the same strategy:

1. Temporarily append the element (invisible) to measure its rendered dimensions.
2. Default position: below the badge (`badgeRect.bottom + margin`).
3. If it would overflow the bottom of the viewport, flip it above the badge.
4. Horizontally: align to the badge's left edge, clamped to stay within the viewport.

---

## Data Loading

Issue data is loaded fresh on every interaction (no cache). The content script sends a `JIRA_GET_ISSUE` message to the background:

```js
browser.runtime.sendMessage({ type: 'JIRA_GET_ISSUE', payload: { issueKey } })
```

The background returns `{ data: issueObject }` on success or `{ error: '...' }` on failure. If the tooltip or panel was closed before the response arrives, the response is silently discarded.

---

## Description Extraction (`extractDescriptionText`)

The Jira API returns descriptions in different formats depending on server type:

- **Jira Server (API v2)**: description is a plain string.
- **Jira Cloud (API v3)**: description is an Atlassian Document Format (ADF) object.

```js
function extractDescriptionText(description) {
  if (!description) return ''
  if (typeof description === 'string') return description          // Server
  if (description.type === 'doc' && description.content) {
    return extractAdfText(description.content)                     // Cloud ADF
  }
  return ''
}

function extractAdfText(nodes) {
  // Recursively extracts text from ADF nodes
  // Handles: text nodes, hardBreak nodes, container nodes
}
```

---

## `OPEN_URL` Message Type

Content scripts registered via `scripting.messageDisplay` cannot call `browser.tabs.create()` directly. To open the Jira issue URL in a new tab, the content script delegates to the background via a dedicated message type:

```js
browser.runtime.sendMessage({ type: 'OPEN_URL', payload: { url: jiraUrl } })
```

The background handler:

```js
case OPEN_URL:
  await browser.tabs.create({ url: payload.url })
  return { data: null }
```

This pattern is also used by the "Open in Jira ↗" button in the panel footer.

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
