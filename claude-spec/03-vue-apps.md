# Vue Apps

## Overview

ThunderJira has 4 independent Vue 3 applications. Each is a self-contained browsing context with its own Pinia instance. They share no runtime state — communication happens only via `runtime.sendMessage` and `browser.storage`.

---

## 1. `options` — Connection Settings

**Purpose**: Let the user configure the Jira connection (URL, type, credentials) and test the connection.

**Entry files**:
- `src/options/index.html`
- `src/options/main.js` — creates the Vue app, registers Pinia, mounts to `#app`

**Initial context**: None required. On mount, reads `storage.local` to pre-populate saved settings.

**Pinia stores used**:
- `connectionSettings.store.js` (id: `connectionSettings`) — manages the form state and persists to `storage.local`

**Components**:

| Component | Responsibility |
|-----------|---------------|
| `App.vue` | Root layout — tab bar (Cloud / Server) |
| `CloudConnectionForm.vue` | Fields for Jira Cloud: instance URL + email + API token |
| `ServerConnectionForm.vue` | Fields for Jira Server: base URL + PAT |
| `ConnectionTestButton.vue` | Sends `JIRA_GET_PROJECTS` message; shows success/failure feedback |
| `SaveButton.vue` | Writes form state to `storage.local` via store action |

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

---

## 4. `popup` — Inline Issue Preview

**Purpose**: Show a floating card with issue details when the user hovers or clicks a Jira link badge injected by `message-overlay.js` into the email body.

**Entry**: No standalone HTML page. The popup is mounted programmatically by `message-overlay.js`:

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PopupApp from './popup/App.vue'

const container = document.createElement('div')
document.body.appendChild(container)
const app = createApp(PopupApp, { issueKey })
app.use(createPinia())
app.mount(container)
```

**Initial context**: The `issueKey` prop is passed directly from `message-overlay.js` when mounting. The popup's store fetches issue details via `JIRA_GET_ISSUE` message on mount.

**Pinia stores used**:
- `issuePreview.store.js` (id: `issuePreview`) — loading state, issue data, error

**Components**:

| Component | Responsibility |
|-----------|---------------|
| `App.vue` | Floating card container with close-on-outside-click logic |
| `IssueHeader.vue` | Issue key, type icon, summary |
| `IssueMetaGrid.vue` | Status, assignee, priority, reporter in a 2-column grid |
| `IssueDescription.vue` | Truncated description with "open in browser" link |
| `StatusBadge.vue` | Colored pill for Jira status category |
