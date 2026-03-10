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

**Initial context**: On mount, reads `browser.storage.session` key `emailContext` (set by `background.js`) to obtain:
```js
{ subject, sender, recipients, ccList, bodyText, bodyHtml, bodyDescription, date, messageId }
```
- `bodyDescription` contains the email body ready for use as Jira description: if the email had HTML, it is converted to Markdown (via `turndown`); otherwise it is the plain text body.

**Pinia stores used**:
- `emailContext.store.js` (id: `emailContext`) — holds the email data read from session storage
- `jiraMeta.store.js` (id: `jiraMeta`) — projects, issue types, fields fetched from Jira
- `createIssue.store.js` (id: `createIssue`) — form field values, submission state

**Components**:

| Component | Responsibility |
|-----------|---------------|
| `App.vue` | Root layout; scroll-to-top after creation uses `scrollIntoView({ behavior: 'smooth' })` via template ref |
| `ProjectSelector.vue` | Dropdown populated from `jiraMeta.projects`; shows selected project as `KEY — Name` |
| `IssueTypeSelector.vue` | Dropdown populated from `jiraMeta.issueTypes` (filtered by selected project); auto-loads issue types and fields on mount when selections are already present |
| `SummaryField.vue` | Text input for issue summary, pre-filled from email subject |
| `DescriptionField.vue` | Editable textarea for the issue description, pre-filled with `bodyDescription` (markdown or plain text) |
| `DynamicFields.vue` | Renders additional fields from `jiraMeta.fields` dynamically. Delegates to `UserPicker` for user-type fields and `IssuePicker` for parent/link fields. Uses `isSupported(field)` to filter fields before rendering — skips anything in `SKIP_FIELDS` (`summary`, `project`, `issuetype`, `description`, `reporter`, `issuelinks`, `attachment`), fields whose `schema.type` is in `UNSUPPORTED_SCHEMA_TYPES` (`team`), and fields whose `schema.system` is in `UNSUPPORTED_SYSTEMS` (`issuerestriction`, `rankBeforeIssue`, `rankAfterIssue`). Deeper filtering (including `UNSUPPORTED_SCHEMA_CUSTOM`) is already applied by `jiraMetaStore.loadFields()` before fields reach this component. |
| `UserPicker.vue` | Debounced search (300ms, min 2 chars) for assignable users via `JIRA_SEARCH_USERS`. Displays avatar + display name; emits selected `{ id, displayName }` |
| `IssuePicker.vue` | Debounced search (300ms, min 2 chars) for project issues via `JIRA_SEARCH_ISSUES` (JQL). Displays issue key + summary; emits selected `{ key, summary }` |
| `EmailPreview.vue` | Read-only display of the source email (From, To, CC, Date, Subject, body). Shows HTML body if available, otherwise plain text — no toggle |
| `IssueSummary.vue` | Read-only recap of the submitted issue data after creation |
| `SubmitBar.vue` | Submit button row, triggers `createIssue.submitIssue()` |
| `SuccessBanner.vue` | Shows issue key link on success; opens in system default browser via `browser.windows.openDefaultBrowser()` |

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

