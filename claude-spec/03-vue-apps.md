# Vue Apps

## Overview

ThunderJira has 3 independent Vue 3 applications. Each is a self-contained browsing context with its own Pinia instance. They share no runtime state — communication happens only via `runtime.sendMessage` and `browser.storage`.

---

## 1. `options` — Connection Settings

**Purpose**: Let the user configure the Jira connection (URL, type, credentials), test the connection, and toggle debug logging.

**Entry files**:
- `src/options/index.html`
- `src/options/main.js` — creates the Vue app, registers Pinia, mounts to `#app`

**Initial context**: None required. On mount, reads `storage.local` to pre-populate saved settings.

**Pinia stores used**:
- `connectionSettings.store.js` (id: `connectionSettings`) — manages the form state and persists to `storage.local`

**Components**:

| Component | Responsibility |
|-----------|---------------|
| `App.vue` | Root layout — tab bar (Cloud / Server) + debug toggle section |
| `CloudConnectionForm.vue` | Fields for Jira Cloud: instance URL + email + API token |
| `ServerConnectionForm.vue` | Fields for Jira Server: base URL + PAT |
| `ConnectionTestButton.vue` | Sends `JIRA_GET_PROJECTS` message; shows success/failure feedback |
| `SaveButton.vue` | **Cloud**: writes form state to `storage.local` directly (host permission is statically declared). **Server**: calls `requestSitePermission(url)` first; only writes to `storage.local` if permission is granted; shows an error if the user denies the permission prompt. |

**Debug toggle** (in `App.vue`, below the save/test actions):
- Checkbox bound to `store.debugMode`; calls `store.saveDebugMode()` on change
- Saves to `storage.local` under key `debugMode` immediately, independently of Jira config save
- The background script picks up the change via `storage.onChanged` without requiring a reload

**Save flow for Server connections:**

`browser.permissions.request()` requires a user gesture. The `SaveButton` click handler is the correct place to call `requestSitePermission`. The sequence is:

1. User clicks Save.
2. `requestSitePermission(jiraUrl)` is called (inside the click handler).
3. If `false` is returned, display an error and abort — do not persist the config.
4. If `true`, call the store's `save()` action to write to `storage.local`.

`requestSitePermission` is defined in `src/options/permissions.js` (shared only within the options app). See [02-manifest-and-permissions.md](02-manifest-and-permissions.md) for its implementation.

---

## 2. `tabs/create-issue` — Create Issue from Email

**Purpose**: Present a form pre-populated with email data that allows the user to create a new Jira issue.

**Entry files**:
- `src/tabs/create-issue/index.html`
- `src/tabs/create-issue/main.js`

**Initial context**: On mount, reads `browser.storage.session` key `emailContext` (set by `message-overlay.js`) to obtain:
```js
{ subject, sender, body, messageId, accountId }
```

**Pinia stores used**:
- `emailContext.store.js` (id: `emailContext`) — holds the email data read from session storage
- `jiraMeta.store.js` (id: `jiraMeta`) — projects, issue types, fields fetched from Jira
- `createIssue.store.js` (id: `createIssue`) — form field values, submission state

**Components**:

| Component | Responsibility |
|-----------|---------------|
| `App.vue` | Root layout — step indicator (Select Project → Configure Fields → Confirm) |
| `ProjectSelector.vue` | Dropdown populated from `jiraMeta.projects` |
| `IssueTypeSelector.vue` | Dropdown populated from `jiraMeta.issueTypes` (filtered by selected project) |
| `DynamicFieldList.vue` | Renders required fields from `jiraMeta.fields` dynamically |
| `FieldInput.vue` | Generic input that adapts to field schema type (text, select, date, etc.) |
| `EmailPreview.vue` | Read-only display of the source email (subject, sender, snippet) |
| `SubmitButton.vue` | Triggers `createIssue.store.submit()` |
| `ResultBanner.vue` | Shows issue key link on success, error message on failure |

---

## 3. `tabs/add-comment` — Add Email as Jira Comment

**Purpose**: Let the user attach the current email as a comment to an existing Jira issue.

**Entry files**:
- `src/tabs/add-comment/index.html`
- `src/tabs/add-comment/main.js`

**Initial context**: Same as `create-issue` — reads `emailContext` from `storage.session` on mount.

**Pinia stores used**:
- `emailContext.store.js` (id: `emailContext`)
- `addComment.store.js` (id: `addComment`) — issue key input, body preview, submission state

**Components**:

| Component | Responsibility |
|-----------|---------------|
| `App.vue` | Root layout |
| `IssueKeyInput.vue` | Text input for the target issue key (e.g. `PROJ-123`) with inline validation |
| `IssueSummaryPreview.vue` | Shows issue summary after user finishes typing (calls `JIRA_GET_ISSUE`) |
| `CommentBodyEditor.vue` | Editable textarea pre-populated with formatted email body |
| `EmailPreview.vue` | Read-only display of source email |
| `SubmitButton.vue` | Triggers `addComment.store.submit()` |
| `ResultBanner.vue` | Confirmation or error |

