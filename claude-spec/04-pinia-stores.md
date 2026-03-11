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
5. **Every store must use `tjLogger`** from `src/shared/mztj-logger.js`. Create the logger at module level and init it asynchronously (the `getDebugMode()` promise resolves before the user triggers any action):

```js
import { tjLogger } from '../../../shared/mztj-logger.js'
import { getDebugMode } from '../../../shared/storage.js'

const logger = new tjLogger('MyStore', false)
getDebugMode().then(enabled => logger.changeDebug(enabled))
```

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
| `bodyText` | `ref<string>` | Plain text email body |
| `bodyHtml` | `ref<string>` | HTML email body (may be empty for plain-text-only emails) |
| `bodyDescription` | `ref<string>` | Email body converted for Jira description: markdown (if HTML was available) or plain text. Fallback: `bodyText` |
| `sender` | `ref<string>` | Sender address (From) |
| `recipients` | `ref<Array<string>>` | To recipients |
| `ccList` | `ref<Array<string>>` | CC recipients |
| `date` | `ref<string>` | Email date (ISO string) |
| `messageId` | `ref<string>` | Email Message-ID header |
| `loaded` | `ref<boolean>` | True after `load()` completes |
| `load()` | action | Reads `emailContext` from `browser.storage.session` |

---

### `options` app

#### `connectionSettings.store.js` — id: `connectionSettings`

| Member | Type | Description |
|--------|------|-------------|
| `jiraType` | `ref<'cloud'\|'server'>` | Selected Jira type |
| `jiraUrl` | `ref<string>` | Base URL of the Jira instance |
| `email` | `ref<string>` | User email (Cloud only) |
| `apiToken` | `ref<string>` | API token (Cloud) or PAT (Server) |
| `debugMode` | `ref<boolean>` | Debug logging enabled flag (stored separately under `debugMode` key) |
| `loading` | `ref<boolean>` | True during save or test |
| `error` | `ref<string\|null>` | Last error |
| `testResult` | `ref<'success'\|'failure'\|null>` | Result of connection test |
| `load()` | action | Reads Jira settings + `debugMode` from `storage.local` |
| `save()` | action | Writes Jira settings to `storage.local` (does NOT save `debugMode`) |
| `saveDebugMode()` | action | Writes `debugMode` to `storage.local` under key `debugMode`; updates the store's own logger immediately |
| `testConnection()` | action | Sends `JIRA_GET_PROJECTS`; checks for error |

---

### `create-issue` app

#### `jiraMeta.store.js` — id: `jiraMeta`

| Member | Type | Description |
|--------|------|-------------|
| `projects` | `ref<Array>` | `[{ key, name, id }]` |
| `issueTypes` | `ref<Array>` | `[{ id, name, subtask }]` |
| `fields` | `ref<Array>` | `[{ id, name, required, schema, allowedValues, operations }]` — pre-filtered by `loadFields()` |
| `loadingProjects` | `ref<boolean>` | True while `loadProjects()` is in flight |
| `loadingIssueTypes` | `ref<boolean>` | True while `loadIssueTypes()` is in flight |
| `loadingFields` | `ref<boolean>` | True while `loadFields()` is in flight |
| `error` | `ref<string\|null>` | |
| `requiredFields` | `computed<Array>` | `fields` filtered to `f.required === true` |
| `optionalFields` | `computed<Array>` | `fields` filtered to `f.required === false` |
| `loadProjects()` | action | Sends `JIRA_GET_PROJECTS` |
| `loadIssueTypes(projectKey)` | action | Sends `JIRA_GET_ISSUE_TYPES`; clears `issueTypes` and `fields` on start |
| `loadFields(projectKey, issueTypeId)` | action | Sends `JIRA_GET_FIELDS`; applies field filters (see below) before storing |

**Field filtering in `loadFields()`** — three constant sets are defined at module level and applied immediately after the API response is received:

| Constant | Values | Matches against |
|----------|--------|-----------------|
| `UNSUPPORTED_SCHEMA_TYPES` | `team`, `issuerestriction` | `field.schema.type` |
| `UNSUPPORTED_SCHEMA_CUSTOM` | `com.atlassian.jira.plugins.jira-development-integration-plugin:designcf`, `com.pyxis.greenhopper.jira:gh-lexo-rank`, `com.atlassian.jira.plugins.jira-development-integration-plugin:devsummarycf`, `com.atlassian.jira.plugins.jira-development-integration-plugin:vulnerabilitycf` | `field.schema.custom` |
| `UNSUPPORTED_SYSTEMS` | `issuerestriction`, `rankBeforeIssue`, `rankAfterIssue` | `field.schema.system` |

A field matching any of these is excluded from `fields.value` before the store updates.

**Flagged field detection** — Jira Cloud exposes the Flagged field as a custom field (no `schema.system`), so it cannot be detected by the store filters above. The `isFlaggedField(field)` helper (duplicated in `DynamicFields.vue` and `SummaryField.vue`) identifies it by checking: `schema.system === 'flagged'` (Server/DC) **or** `schema.items === 'option' && allowedValues.length === 1 && allowedValues[0].value === 'Impediment'` (Cloud custom field).

#### `createIssue.store.js` — id: `createIssue`

| Member | Type | Description |
|--------|------|-------------|
| `selectedProject` | `ref<object\|null>` | Selected project `{ key, name, id }` |
| `selectedIssueType` | `ref<object\|null>` | Selected issue type `{ id, name }` |
| `summary` | `ref<string>` | Issue summary (pre-filled from email subject) |
| `description` | `ref<string>` | Issue description — single editable field (pre-filled from `emailContext.bodyDescription`: markdown or plain text) |
| `flagged` | `ref<boolean>` | Whether the Flagged field toggle is active. Injected into the API payload on submit if the issue type has a Flagged field. |
| `dynamicFieldValues` | `ref<object>` | Key-value map of dynamic field id → value |
| `submitting` | `ref<boolean>` | True during submission |
| `submitError` | `ref<string\|null>` | Last submission error |
| `createdIssue` | `ref<object\|null>` | `{ key, id, url }` on success |
| `submittedData` | `ref<object\|null>` | Snapshot of submitted values for the summary view |
| `isReadyToSubmit` | computed | True when all required fields are filled. Validates user fields (checks `id` property) and issue fields (checks `key` property) |
| `setSummaryFromEmail(emailContext)` | action | Pre-fills summary from email subject |
| `setDescriptionFromEmail(emailContext)` | action | Pre-fills description from `emailContext.bodyDescription` |
| `submitIssue()` | action | Sends `JIRA_CREATE_ISSUE` with assembled fields. If `flagged` is true, looks up the Flagged field in `jiraMeta.fields` (via `isFlaggedField()` logic) and injects `[{ id: optionId }]` into the payload. Formats display values for user fields (`displayName`) and issue fields (`key — summary`) in `submittedData` |
| `formatDynamicFields(rawValues, fieldsMeta, jiraType)` | internal | Formats dynamic field values for the Jira API. `jiraType` (`'cloud'\|'server'`) drives Cloud/Server divergence. Fields in `NON_CREATABLE_FIELDS` (`issuelinks`, `issuerestriction`, `rankBeforeIssue`, `rankAfterIssue`, `attachment`) are skipped. Empty values are skipped. Field transformations: user fields → Cloud `{ accountId }` / Server `{ name }`; issue/parent fields → `{ key }`; fields in `OBJECT_ID_TYPES` (`priority`, `option`, `resolution`, `securitylevel`) → `{ id: value }`; multi-select (array with `allowedValues`) → `[{ id }]`; dates, numbers, free-text passed as-is. |
| `reset()` | action | Resets all form state |

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
