# Architecture Overview

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Vue App (options / create-issue / add-comment )│
│                                                                   │
│  Component → store.action()                                       │
│                  │                                                │
│                  ▼                                                │
│  browser.runtime.sendMessage({ type: MSG_TYPE, payload: {...} }) │
└──────────────────────────┬────────────────────────────────────────┘
                           │  WebExtension message bus
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  background.js  (Event Page)                                     │
│                                                                   │
│  browser.runtime.onMessage.addListener(handler)                  │
│  switch (message.type) { ... }                                    │
│                  │                                                │
│                  ▼                                                │
│  jiraClient.methodName(payload)                                   │
│                  │                                                │
│                  ▼                                                │
│  fetch(jiraApiUrl, { headers: authHeaders })                     │
└──────────────────────────┬────────────────────────────────────────┘
                           │  HTTPS REST
                           ▼
                  ┌─────────────────┐
                  │  Jira REST API  │
                  │  (Cloud/Server) │
                  └────────┬────────┘
                           │  JSON response
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  background.js                                                   │
│  Returns: { data: ... }  or  { error: "message" }               │
└──────────────────────────┬────────────────────────────────────────┘
                           │  sendMessage response
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Vue App                                                         │
│  store.action() checks response.error → updates state            │
└─────────────────────────────────────────────────────────────────┘
```

## The 3 Independent Vue Apps

ThunderJira consists of **3 separate Vue application instances**, each compiled as an independent bundle:

| App | Entry HTML | Purpose |
|-----|-----------|---------|
| `options` | `options/index.html` | Configure Jira connection (URL, credentials, type) |
| `tabs/create-issue` | `tabs/create-issue/index.html` | Form to create a Jira issue from the current email |
| `tabs/add-comment` | `tabs/add-comment/index.html` | Form to add the current email as a comment on an issue |

### Why 3 separate apps instead of one?

In WebExtensions, each UI surface runs in a **fully isolated browser context** with its own JavaScript heap, DOM, and module registry. There is no shared memory between:
- A tab page and the options page
- Any page and a content script

Attempting to share a single Vue/Pinia instance across these contexts is architecturally impossible. Each app must be self-contained and communicate exclusively via `runtime.sendMessage` and `storage` APIs.

## The Background as the Sole HTTP Hub

The background event page is the **only context** allowed to:
- Instantiate `JiraClient`
- Call `fetch()` against Jira APIs
- Read credentials from `storage.local`

Reasons:
1. **Security**: Credentials never touch Vue app contexts or the DOM.
2. **Consistency**: A single place handles auth token refresh, error normalization, and API version selection.
3. **Testability**: The message-handling logic in background.js can be tested independently of Vue components.

## Storage Strategy

### `browser.storage.local` — Persistent Configuration
- Jira connection settings: URL, type (`cloud` | `server`), credentials — key: `jiraConfig`
- Debug mode flag (`true` | `false`) — key: `debugMode`
- Survives Thunderbird restarts
- **Never** store email body or volatile UI state here

### `browser.storage.session` — Transient Email Context
- The current email's subject, sender, recipients (To), ccList (CC), body (text, HTML, and markdown-converted description), message ID
- Written by `background.js` when the user triggers the create-issue action
- Read by `create-issue` and `add-comment` tab apps on mount
- Cleared automatically when Thunderbird closes
- **Never** store credentials or persistent config here

## Debug Logging

Debug output is controlled by a persistent flag (`debugMode`) stored in `browser.storage.local` and toggled from the Options page.

Each JS context (background, options app, create-issue app) creates its own `tjLogger` instance from `src/shared/mztj-logger.js` with `do_debug = false`. On startup, each context reads `debugMode` from storage and calls `logger.changeDebug(enabled)`.

The background script additionally listens for `storage.onChanged` on `STORAGE_KEY_DEBUG` and updates its own logger and the cached `JiraClient`'s logger at runtime — no extension reload required.

Log entries are prefixed: `[ThunderJira Logger | <Context>]`

### Why not use a shared Pinia store for cross-app state?

Pinia stores exist in the JavaScript heap of a single browsing context. They cannot be shared across the isolated contexts of different extension pages. `storage.session` is the correct mechanism for passing state between contexts because it is accessible from any extension page via the WebExtension API.
