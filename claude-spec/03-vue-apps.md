# Vue Apps

## Overview

ThunderJira has 4 independent Vue 3 applications. Each is a self-contained browsing context with its own Pinia instance. They share no runtime state — communication happens only via `runtime.sendMessage` and `browser.storage`.

---

## 1. `onboarding` — Welcome Page

**Purpose**: Show a welcome page with feature overview on first install. Purely presentational — no Jira API calls, no Pinia stores.

**Entry files**:
- `src/onboarding/index.html`
- `src/onboarding/main.js` — creates the Vue app, registers Pinia, mounts to `#app`

**Initial context**: None. The page is opened by the `onInstalled` listener in the background script.

**Pinia stores used**: None.

**Components**:

| Component | Responsibility |
|-----------|---------------|
| `AppOnboarding.vue` | Root — welcome header, feature sections (create issue, link enrichment, cloud/server support), getting started button, footer with GitHub and donation links |

**Key behavior**:
- "Configure Now" button calls `browser.runtime.openOptionsPage()`
- External links (GitHub, donation) open via `browser.windows.openDefaultBrowser()`
- Image placeholders in `src/onboarding/images/` for feature screenshots

---

## 2. `options` — Connection Settings

**Purpose**: Let the user configure the Jira connection (URL, type, credentials), test the connection, toggle debug logging, and configure UI preferences.

**Entry files**:
- `src/options/index.html`
- `src/options/main.js` — creates the Vue app, registers Pinia, mounts to `#app`

**Initial context**: None required. On mount, reads `storage.local` to pre-populate saved settings.

**Pinia stores used**:
- `connectionSettings.store.js` (id: `connectionSettings`) — manages the form state and persists to `storage.local`

**Components**:

| Component | Responsibility |
|-----------|---------------|
| `App.vue` | Root layout — tab bar (Cloud / Server) + UI preferences section + debug toggle section |
| `CloudConnectionForm.vue` | Fields for Jira Cloud: instance URL + email + API token |
| `ServerConnectionForm.vue` | Fields for Jira Server: base URL + PAT |
| `ConnectionTestButton.vue` | Sends `JIRA_GET_PROJECTS` message; shows success/failure feedback |
| `SaveButton.vue` | **Cloud**: writes form state to `storage.local` directly (host permission is statically declared). **Server**: calls `requestSitePermission(url)` first; only writes to `storage.local` if permission is granted; shows an error if the user denies the permission prompt. |

**"Always show optional fields" toggle** (in `App.vue`, Interface section, below the save/test actions):
- Checkbox bound to `store.showOptionalFields`; calls `store.saveShowOptionalFields()` on change
- Saves to `storage.local` under key `showOptionalFields` immediately
- `DynamicFields.vue` reads this setting on mount via `getShowOptionalFields()` and sets the initial `showOptional` state accordingly; the user can still toggle it manually during the session

**"Default project" section** (in `App.vue`, Interface section, below the "Always show optional fields" toggle):
- "Use last used project" checkbox bound to `store.useLastProject`; on change calls a handler that persists it (`saveUseLastProject()`) and, when being enabled, also clears `defaultProject` to `''` and persists that (`saveDefaultProject()`). Saves to `storage.local` under key `useLastProject` immediately
- A `<select>` bound to `store.defaultProject`, populated from `store.projects` (`KEY — Name`, option value = project key) with a leading "None" option (empty value). Calls `store.saveDefaultProject()` on change; saves to `storage.local` under key `defaultProject` immediately. The select and the "Reload projects" button are disabled while `useLastProject` is enabled (the default is irrelevant in that mode); turning the option back off re-enables them without repopulating the field
- A "Reload projects" button calls `store.loadProjects()` (sends `JIRA_GET_PROJECTS`). `store.load()` also calls `loadProjects()` on mount when a saved config exists, so the picker is populated automatically. A stored default that no longer exists among visible projects is cleared
- `ProjectSelector.vue` in the create-issue app reads `getUseLastProject()`, `getLastUsedProject()`, and `getDefaultProject()` on mount and uses them to preselect a project once `jiraMeta.projects` arrives (see create-issue section)

**Debug toggle** (in `App.vue`, Developer section, below the Interface section):
- Checkbox bound to `store.debugMode`; calls `store.saveDebugMode()` on change
- Saves to `storage.local` under key `debugMode` immediately, independently of Jira config save
- The background script picks up the change via `storage.onChanged` without requiring a reload

**Privacy notice** (in `App.vue`, at the bottom of the page, below the Release Notes link):
- Static informational section that lists which user data is transmitted to the configured Jira instance (credentials, email content used for issues/comments, form field values, User-Agent) and clarifies that no telemetry or third-party servers are involved
- Strings come from i18n keys `privacyNoticeTitle` and `privacyNoticeText`
- Reuses the `.debug-section` / `.debug-title` / `.debug-desc` classes for styling consistency

**Save flow for Server connections:**

`browser.permissions.request()` requires a user gesture. The `SaveButton` click handler is the correct place to call `requestSitePermission`. The sequence is:

1. User clicks Save.
2. `requestSitePermission(jiraUrl)` is called (inside the click handler).
3. If `false` is returned, display an error and abort — do not persist the config.
4. If `true`, call the store's `save()` action to write to `storage.local`.

`requestSitePermission` is defined in `src/options/permissions.js` (shared only within the options app). See [02-manifest-and-permissions.md](02-manifest-and-permissions.md) for its implementation.

---

## 3. `tabs/create-issue` — Create Issue from Email

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
| `ProjectSelector.vue` | Dropdown populated from `jiraMeta.projects`; shows selected project as `KEY — Name`. Reads `getUseLastProject()`/`getLastUsedProject()`/`getDefaultProject()` on mount and, once projects arrive, preselects one (in order: last used when enabled and visible → configured default → single-project fallback) |
| `IssueTypeSelector.vue` | Dropdown populated from `jiraMeta.issueTypes` (filtered by selected project); auto-loads issue types and fields on mount when selections are already present |
| `SummaryField.vue` | Text input for issue summary, pre-filled from email subject. Renders a 🚩 flag toggle button inline with the input when the issue type has a Flagged field (detected via `isFlaggedField()`). Toggling sets `createIssue.flagged` (boolean). |
| `DescriptionField.vue` | Editable textarea for the issue description, pre-filled with `bodyDescription` (markdown or plain text) |
| `DynamicFields.vue` | Renders additional fields from `jiraMeta.fields` dynamically. Delegates to `UserPicker` for user-type fields and `IssuePicker` for parent/link fields. Uses `isSupported(field)` to filter fields before rendering — skips anything in `SKIP_FIELDS` (`summary`, `project`, `issuetype`, `description`, `reporter`, `issuelinks`, `attachment`), fields whose `schema.type` is in `UNSUPPORTED_SCHEMA_TYPES` (`team`), fields whose `schema.system` is in `UNSUPPORTED_SYSTEMS` (`issuerestriction`, `rankBeforeIssue`, `rankAfterIssue`), and Flagged fields (detected via `isFlaggedField()` — handled separately by `SummaryField.vue`). Deeper filtering (including `UNSUPPORTED_SCHEMA_CUSTOM`) is already applied by `jiraMetaStore.loadFields()` before fields reach this component. |
| `UserPicker.vue` | Debounced search (300ms, min 2 chars) for assignable users via `JIRA_SEARCH_USERS`. Displays avatar + display name; emits selected `{ id, displayName }` |
| `IssuePicker.vue` | Debounced search (300ms, min 2 chars) for project issues via `JIRA_SEARCH_ISSUES` (JQL). Displays issue key + summary; emits selected `{ key, summary }` |
| `LabelsPicker.vue` | Debounced search (300ms, min 1 char) for Jira labels via `JIRA_SEARCH_LABELS` (`/rest/api/1.0/labels/suggest`). Multi-value: selected labels shown as removable chips; emits `Array<string>` |
| `EmailPreview.vue` | Read-only display of the source email (From, To, CC, Date, Subject, body). Shows HTML body if available, otherwise plain text — no toggle |
| `IssueSummary.vue` | Read-only recap of the submitted issue data after creation. Displays the issue key with a 🚩 flag indicator to its right when `submittedData.flagged` is true |
| `SubmitBar.vue` | Submit button row, triggers `createIssue.submitIssue()` |
| `SuccessBanner.vue` | Shows issue key link on success; opens in system default browser via `browser.windows.openDefaultBrowser()` |

---

## 4. `tabs/add-comment` — Add Email as Jira Comment

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

