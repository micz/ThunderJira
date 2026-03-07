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
    "tabs"
  ],

  "host_permissions": [
    "https://*.atlassian.net/*"
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
    "48": "assets/icons/icon-48.png",
    "96": "assets/icons/icon-96.png"
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

## host_permissions

```json
"host_permissions": [
  "https://*.atlassian.net/*"
]
```

- **`https://*.atlassian.net/*`**: Required for Jira Cloud. Covers all Cloud tenants (e.g., `mycompany.atlassian.net`).
- **Jira Server / Data Center**: The server URL is arbitrary and user-supplied. Because it cannot be known at install time, users with a self-hosted Jira must grant the optional permission `<all_urls>` after installation, or the addon must declare it as an optional host permission:

```json
"optional_host_permissions": [
  "<all_urls>"
]
```

The background script requests this permission at runtime if `storage.local` contains a Server-type connection.

## web_accessible_resources

The `popup/index.html` entry and `assets/` directory are exposed as web-accessible resources so that `message-overlay.js` (which runs in the email message DOM context) can load them via `browser.runtime.getURL()`.

Without this declaration, content scripts cannot reference extension pages or assets.

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
- Its job: scan the email DOM for Jira issue URLs, enrich them with interactive badge elements, and optionally mount the `popup` Vue app on demand.

## Event Page Behavior in Thunderbird MV3

Unlike Chrome MV3 (which forces service workers), **Thunderbird MV3 uses Event Pages** — background scripts that can access the DOM and maintain state across message handling within a session.

Key differences from Chrome service workers:
- Event pages **persist for the lifetime of a Thunderbird session** (they are not terminated between messages).
- `window`, `document`, and other Web APIs are available (though not needed for our background).
- The `JiraClient` instance can be kept alive in module scope without special keep-alive hacks.
- IndexedDB and other persistent storage APIs are available, though we use `storage.local` exclusively.

Despite this persistence, the background should be coded defensively — never assume in-memory state survives a Thunderbird restart.
