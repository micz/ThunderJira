# Content Script and Popup

## Overview

`message-overlay.js` is injected into every email rendered by Thunderbird. Its job is to:
1. Detect Jira issue URLs in the email DOM.
2. Replace them with interactive badge elements.
3. Mount the `popup` Vue app on demand when a badge is clicked.

---

## Injection Mechanism

The script is registered in `manifest.json` as a `message_display_script`:

```json
"message_display_scripts": [
  {
    "js": ["content-scripts/message-overlay.js"],
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
    mountPopup(issueKey, badge)
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

## Dynamic Popup Mount

When a badge is clicked, the popup Vue app is mounted into a container appended to `document.body`:

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PopupApp from '../popup/App.vue'

let activeApp = null
let activeContainer = null

function mountPopup(issueKey, anchorBadge) {
  // Unmount any previously open popup
  if (activeApp) {
    activeApp.unmount()
    activeContainer.remove()
    activeApp = null
    activeContainer = null
  }

  const container = document.createElement('div')
  container.id = 'jira-popup-root'
  document.body.appendChild(container)

  const app = createApp(PopupApp, {
    issueKey,
    anchorEl: anchorBadge,
    onClose: () => {
      app.unmount()
      container.remove()
      activeApp = null
      activeContainer = null
    }
  })
  app.use(createPinia())
  app.mount(container)

  activeApp = app
  activeContainer = container
}
```

---

## Why Content Script and Popup Are in the Same Bundle

The popup's Vue component is imported directly by `message-overlay.js` (`import PopupApp from '../popup/App.vue'`). For this import to work at runtime, both files must be compiled into the same Vite bundle.

In `vite.config.js`, the content script entry is declared as a format `iife` (Immediately Invoked Function Expression) so it can run in a non-module script context:

```js
// vite.config.js (relevant excerpt)
{
  input: 'src/content-scripts/message-overlay.js',
  output: {
    format: 'iife',
    name: 'JiraBridgeOverlay'
  }
}
```

The `@samrum/vite-plugin-web-extension` handles this bundling automatically when the content script is listed in `manifest.json`.

---

## Popup Lifecycle

| Event | Action |
|-------|--------|
| User clicks a Jira badge | `mountPopup(issueKey, badge)` called; previous popup unmounted if open |
| `PopupApp` mounted | `issuePreview.store.fetch(issueKey)` called; loading spinner shown |
| Fetch completes | Issue data displayed in the floating card |
| User clicks outside `#jira-popup-root` | `onClose` prop called; `app.unmount()` + DOM cleanup |
| User clicks another badge | Previous popup unmounted; new popup mounted |
| Email tab closed | Thunderbird destroys the message frame and all its DOM + JS — no explicit cleanup needed |

The outside-click detection is handled in `PopupApp`'s `onMounted` hook:

```js
onMounted(() => {
  const handler = (e) => {
    if (!container.value?.contains(e.target)) {
      props.onClose()
      document.removeEventListener('click', handler)
    }
  }
  // Defer to avoid catching the originating click
  setTimeout(() => document.addEventListener('click', handler), 0)
})
```

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
