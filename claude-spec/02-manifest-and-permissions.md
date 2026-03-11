# Manifest and Permissions

## manifest.json Structure (MV3)

```json
{
  "manifest_version": 3,
  "name": "ThunderJira",
  "version": "1.0.0",
  "description": "Integrate Jira Cloud and Jira Server into Thunderbird",

  "browser_specific_settings": {
    "gecko": {
      "id": "thunderjira@micz.it",
      "strict_min_version": "140.0"
    }
  },

  "background": {
    "scripts": ["background/background.js"],
    "type": "module"
  },

  "options_ui": {
    "page": "options/index.html",
    "open_in_tab": true
  },

  "permissions": [
    "messagesRead",
    "messagesModify",
    "accountsRead",
    "storage",
    "menus",
    "tabs",
    "permissions"
  ],

  "host_permissions": [
    "https://*.atlassian.net/*"
  ],

  "optional_host_permissions": [
    "https://*/*",
    "http://*/*",
    "<all_urls>"
  ],

  "web_accessible_resources": [
    {
      "resources": ["assets/*"],
      "matches": ["<all_urls>"]
    }
  ],

  "message_display_scripts": [
    {
      "js": ["content-scripts/message-overlay.js"],
      "run_at": "document_end"
    }
  ],

  "icons": {
    "16": "icons/icon-16px.png",
    "32": "icons/icon-32px.png",
    "64": "icons/icon.png"
  }
}
```

## Permissions — Field-by-Field Rationale

| Permission | Why it is needed |
|-----------|-----------------|
| `messagesRead` | Read email headers (subject, sender, date) and body to pre-populate issue/comment forms |
| `messagesModify` | Tag or annotate emails after a Jira issue is created (e.g., add a custom tag or header) |
| `accountsRead` | Identify the active mail account to associate with Jira projects |
| `storage` | Persist Jira connection settings (`storage.local`) and pass email context between contexts (`storage.session`) |
| `menus` | Add context menu entries in the email list and message header toolbar |
| `tabs` | Open `create-issue` and `add-comment` as new tabs; retrieve tab IDs for targeted messaging |
| `permissions` | Required to call `browser.permissions.contains()` and `browser.permissions.request()` for runtime host permission grants |

## host_permissions

```json
"host_permissions": [
  "https://*.atlassian.net/*"
]
```

- **`https://*.atlassian.net/*`**: Required for Jira Cloud. Covers all Cloud tenants (e.g., `mycompany.atlassian.net`).
- **Jira Server / Data Center**: The server URL is arbitrary and user-supplied. It is requested at runtime at the moment the user saves the URL in the options page (see "Runtime Permission Request Pattern" below).

## optional_host_permissions

```json
"optional_host_permissions": [
  "https://*/*",
  "http://*/*",
  "<all_urls>"
]
```

- **`https://*/*` and `http://*/*`**: Cover all standard self-hosted Jira instances. Declared in the manifest but **not auto-granted** — only the specific URL entered by the user is ever granted at runtime.
- **`<all_urls>`**: Kept in the list exclusively for `localhost` / `127.0.0.1` cases (see "Runtime Permission Request Pattern" below). It is never requested for remote URLs.

## Runtime Permission Request Pattern

When the user saves a Jira Server URL in the options page, the extension must request network access for that specific origin **before persisting the configuration**. The request must happen inside a user gesture handler (click), because `browser.permissions.request()` requires user interaction.

```js
function isLocalhost(url) {
  try {
    const { hostname } = new URL(url)
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

async function requestSitePermission(url) {
  // localhost/127.0.0.1 do not match https://*/* or http://*/* (no TLD),
  // so they require the broader <all_urls> grant.
  const origin = isLocalhost(url) ? '<all_urls>' : url.replace(/\/?\*?$/, '/*')

  const hasPermission = await browser.permissions.contains({ origins: [origin] })
  if (hasPermission) return true

  return browser.permissions.request({ origins: [origin] })
}
```

Return value contract:
- `true` — permission already granted or just granted by the user; safe to save and use the URL.
- `false` — user explicitly denied; do **not** save the configuration.

This function lives in `src/options/` and is called by `SaveButton.vue` (server connection context only). See [03-vue-apps.md](03-vue-apps.md) for the save flow.

## web_accessible_resources

The `assets/` directory is exposed as a web-accessible resource so that `message-overlay.js` (which runs in the email message DOM context) can load extension assets via `browser.runtime.getURL()`.

Without this declaration, content scripts cannot reference extension assets.

## message_display_scripts

```json
"message_display_scripts": [
  {
    "js": ["content-scripts/message-overlay.js"],
    "run_at": "document_end"
  }
]
```

- This is a **Thunderbird-specific** manifest key (not available in Chrome/Firefox for email).
- The script is injected into every email rendering frame **after the DOM is fully parsed** (`document_end`).
- It runs in the context of the email message pane, not the main Thunderbird chrome.
- Its job: scan the email DOM for Jira issue URLs, enrich them with interactive badge elements, and write the email context to `storage.session`.

## Event Page Behavior in Thunderbird MV3

Unlike Chrome MV3 (which forces service workers), **Thunderbird MV3 uses Event Pages** — background scripts that can access the DOM and maintain state across message handling within a session.

Key differences from Chrome service workers:
- Event pages **persist for the lifetime of a Thunderbird session** (they are not terminated between messages).
- `window`, `document`, and other Web APIs are available (though not needed for our background).
- The `JiraClient` instance can be kept alive in module scope without special keep-alive hacks.
- IndexedDB and other persistent storage APIs are available, though we use `storage.local` exclusively.

Despite this persistence, the background should be coded defensively — never assume in-memory state survives a Thunderbird restart.
