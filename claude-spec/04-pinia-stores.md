# Pinia Stores

## Mandatory Pattern: Setup Store

All stores in ThunderJira **must** use the **Setup Store** pattern (function-based). The Options Store (object-based) is not permitted.

### Canonical Setup Store Example

```js
// src/tabs/create-issue/stores/create-issue.store.js
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { sendMessage } from '../../../shared/messaging.js'
import { JIRA_CREATE_ISSUE } from '../../../shared/messaging.js'

export const useCreateIssueStore = defineStore('createIssue', () => {
  // --- state ---
  const fields = ref({})
  const loading = ref(false)
  const error = ref(null)
  const createdIssue = ref(null)

  // --- getters ---
  const isReady = computed(() => Object.keys(fields.value).length > 0)

  // --- actions ---
  async function submit() {
    loading.value = true
    error.value = null
    createdIssue.value = null

    const response = await sendMessage(JIRA_CREATE_ISSUE, { fields: fields.value })

    if (response.error) {
      error.value = response.error
    } else {
      createdIssue.value = response.data
    }

    loading.value = false
  }

  return { fields, loading, error, createdIssue, isReady, submit }
})
```

## Core Rules

1. **No direct `fetch()` calls in stores.** Always use `sendMessage()` from `src/shared/messaging.js`.
2. **Every async action must declare `loading` and `error` refs** and manage them across the async lifecycle.
3. **Reset `error` to `null` at the start of each action** before the async call.
4. **Set `loading = false` in all code paths** (success and error) — use `finally` if needed.

## Naming Conventions

| Convention | Rule |
|-----------|------|
| File name | `kebab-case.store.js` (e.g., `jira-meta.store.js`) |
| Store `id` | camelCase string matching the composable name (e.g., `jiraMeta`) |
| Composable export | `use` + PascalCase id (e.g., `useJiraMetaStore`) |

## Complete Store Catalog

### Shared across multiple apps (each app has its own instance — no shared runtime)

---

#### `emailContext.store.js` — id: `emailContext`

Used in: `create-issue`, `add-comment`

| Member | Type | Description |
|--------|------|-------------|
| `subject` | `ref<string>` | Email subject line |
| `sender` | `ref<string>` | Sender address |
| `body` | `ref<string>` | Plain text email body |
| `messageId` | `ref<string>` | Thunderbird message ID |
| `accountId` | `ref<string>` | Active account ID |
| `loading` | `ref<boolean>` | True while reading from session storage |
| `error` | `ref<string\|null>` | Error message if read fails |
| `load()` | action | Reads `emailContext` from `browser.storage.session` |
| `isLoaded` | computed | True when `messageId` is set |

---

### `options` app

#### `connectionSettings.store.js` — id: `connectionSettings`

| Member | Type | Description |
|--------|------|-------------|
| `jiraType` | `ref<'cloud'\|'server'>` | Selected Jira type |
| `jiraUrl` | `ref<string>` | Base URL of the Jira instance |
| `email` | `ref<string>` | User email (Cloud only) |
| `apiToken` | `ref<string>` | API token (Cloud) or PAT (Server) |
| `loading` | `ref<boolean>` | True during save or test |
| `error` | `ref<string\|null>` | Last error |
| `testResult` | `ref<'success'\|'failure'\|null>` | Result of connection test |
| `load()` | action | Reads settings from `storage.local` |
| `save()` | action | Writes settings to `storage.local` |
| `testConnection()` | action | Sends `JIRA_GET_PROJECTS`; checks for error |

---

### `create-issue` app

#### `jiraMeta.store.js` — id: `jiraMeta`

| Member | Type | Description |
|--------|------|-------------|
| `projects` | `ref<Array>` | `[{ key, name, id }]` |
| `issueTypes` | `ref<Array>` | `[{ id, name, subtask }]` |
| `fields` | `ref<Array>` | `[{ id, name, required, schema }]` |
| `loading` | `ref<boolean>` | |
| `error` | `ref<string\|null>` | |
| `fetchProjects()` | action | Sends `JIRA_GET_PROJECTS` |
| `fetchIssueTypes(projectKey)` | action | Sends `JIRA_GET_ISSUE_TYPES` |
| `fetchFields(projectKey, issueTypeId)` | action | Sends `JIRA_GET_FIELDS` |

#### `createIssue.store.js` — id: `createIssue`

| Member | Type | Description |
|--------|------|-------------|
| `fields` | `ref<object>` | Key-value map of field id → value |
| `loading` | `ref<boolean>` | |
| `error` | `ref<string\|null>` | |
| `createdIssue` | `ref<object\|null>` | `{ id, key, self }` on success |
| `submit()` | action | Sends `JIRA_CREATE_ISSUE` with `fields` |

---

### `add-comment` app

#### `addComment.store.js` — id: `addComment`

| Member | Type | Description |
|--------|------|-------------|
| `issueKey` | `ref<string>` | Target issue key (user input) |
| `commentBody` | `ref<string>` | Editable comment text |
| `targetIssue` | `ref<object\|null>` | Issue summary fetched for preview |
| `loading` | `ref<boolean>` | |
| `error` | `ref<string\|null>` | |
| `result` | `ref<object\|null>` | `{ id, self }` on success |
| `fetchIssuePreview()` | action | Sends `JIRA_GET_ISSUE` for `issueKey` |
| `submit()` | action | Sends `JIRA_ADD_COMMENT` |

## Error Handling Pattern

Every async action follows this structure:

```js
async function myAction(payload) {
  loading.value = true
  error.value = null          // always reset before the call

  try {
    const response = await sendMessage(MSG_TYPE, payload)
    if (response.error) {
      error.value = response.error
      return
    }
    // update state with response.data
  } finally {
    loading.value = false     // always runs, even on unexpected throw
  }
}
```
