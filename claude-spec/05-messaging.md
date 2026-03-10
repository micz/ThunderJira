# Messaging

## Overview

All communication between Vue apps and the background script uses `browser.runtime.sendMessage`. Message types are defined as string constants in `src/shared/messaging.js` and must never be duplicated as raw string literals in components or stores.

## `src/shared/messaging.js` — Structure

```js
// Message type constants
export const JIRA_GET_PROJECTS    = 'JIRA_GET_PROJECTS'
export const JIRA_GET_ISSUE_TYPES = 'JIRA_GET_ISSUE_TYPES'
export const JIRA_GET_FIELDS      = 'JIRA_GET_FIELDS'
export const JIRA_CREATE_ISSUE    = 'JIRA_CREATE_ISSUE'
export const JIRA_ADD_COMMENT     = 'JIRA_ADD_COMMENT'
export const JIRA_GET_ISSUE       = 'JIRA_GET_ISSUE'
export const JIRA_SEARCH_ISSUES   = 'JIRA_SEARCH_ISSUES'
export const GET_EMAIL_CONTEXT    = 'GET_EMAIL_CONTEXT'

// Convenience wrapper — always use this, never call browser.runtime.sendMessage directly
export async function sendMessage(type, payload = {}) {
  return browser.runtime.sendMessage({ type, payload })
}
```

## Message Catalog

### `JIRA_GET_PROJECTS`

Fetches the list of all Jira projects the authenticated user can see.

| Field | Value |
|-------|-------|
| Payload | `{}` (none required) |
| Success response | `{ data: Array<{ key: string, name: string, id: string }> }` |
| Error response | `{ error: string }` |

---

### `JIRA_GET_ISSUE_TYPES`

Fetches issue types available for a specific project.

| Field | Value |
|-------|-------|
| Payload | `{ projectKey: string }` |
| Success response | `{ data: Array<{ id: string, name: string, subtask: boolean }> }` |
| Error response | `{ error: string }` |

---

### `JIRA_GET_FIELDS`

Fetches the create-screen fields for a given project + issue type combination.

| Field | Value |
|-------|-------|
| Payload | `{ projectKey: string, issueTypeId: string }` |
| Success response | `{ data: Array<{ id: string, name: string, required: boolean, schema: object }> }` |
| Error response | `{ error: string }` |

---

### `JIRA_CREATE_ISSUE`

Creates a new Jira issue.

| Field | Value |
|-------|-------|
| Payload | `{ fields: object }` — key-value map matching Jira field IDs (e.g. `{ summary: "...", project: { key: "PROJ" }, issuetype: { id: "10001" } }`) |
| Success response | `{ data: { id: string, key: string, self: string } }` |
| Error response | `{ error: string }` |

---

### `JIRA_ADD_COMMENT`

Adds a comment to an existing issue.

| Field | Value |
|-------|-------|
| Payload | `{ issueKey: string, body: string }` — `body` is plain text; the background converts it to the appropriate format (ADF or wiki markup) |
| Success response | `{ data: { id: string, self: string } }` |
| Error response | `{ error: string }` |

---

### `JIRA_GET_ISSUE`

Fetches a single issue by key.

| Field | Value |
|-------|-------|
| Payload | `{ issueKey: string }` |
| Success response | `{ data: object }` — full Jira issue object |
| Error response | `{ error: string }` |

---

### `JIRA_SEARCH_ISSUES`

Executes a JQL search.

| Field | Value |
|-------|-------|
| Payload | `{ jql: string, fields: Array<string>, startAt?: number, maxResults?: number }` |
| Success response | `{ data: { issues: Array<object>, total: number, startAt: number } }` |
| Error response | `{ error: string }` |

---

### `GET_EMAIL_CONTEXT`

Retrieves the current email context from `storage.session`. Used when the content script or a tab app needs to re-read the context without direct storage access.

| Field | Value |
|-------|-------|
| Payload | `{}` (none required) |
| Success response | `{ data: { subject: string, bodyText: string, bodyHtml: string, bodyDescription: string, sender: string, recipients: string[], ccList: string[], date: string, messageId: string } }` |
| Error response | `{ error: string }` |

---

## Background Message Router

The background handles all messages in a single `onMessage` listener with a `switch` over `message.type`:

```js
// src/background/background.js (router excerpt)

// IMPORTANT: the listener MUST NOT be async.
// An async listener implicitly returns a Promise that Thunderbird does not recognize
// as a valid response to the message, causing undefined behavior.
// The Promise is explicitly returned by the synchronous listener.
// See: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage
browser.runtime.onMessage.addListener((message) => {
  return handleMessage(message)
})

async function handleMessage(message) {
  const { type, payload } = message

  try {
    const client = await getJiraClient() // lazy-init from storage.local

    switch (type) {
      case JIRA_GET_PROJECTS:
        return { data: await client.getProjects() }

      case JIRA_GET_ISSUE_TYPES:
        return { data: await client.getIssueTypes(payload.projectKey) }

      case JIRA_GET_FIELDS:
        return { data: await client.getFields(payload.projectKey, payload.issueTypeId) }

      case JIRA_CREATE_ISSUE:
        return { data: await client.createIssue(payload.fields) }

      case JIRA_ADD_COMMENT:
        return { data: await client.addComment(payload.issueKey, payload.body) }

      case JIRA_GET_ISSUE:
        return { data: await client.getIssue(payload.issueKey) }

      case JIRA_SEARCH_ISSUES:
        return { data: await client.searchIssues(payload.jql, payload.fields, payload.startAt, payload.maxResults) }

      case GET_EMAIL_CONTEXT: {
        const result = await browser.storage.session.get('emailContext')
        return { data: result.emailContext ?? null }
      }

      default:
        return { error: `Unknown message type: ${type}` }
    }
  } catch (err) {
    const detail = err.method
      ? `${err.method} ${err.endpoint} → ${err.status}`
      : null
    console.error(
      `ThunderJira [${type}]:`,
      detail ?? '',
      err.message,
      ...(err.errorData ? ['\nServer response:', err.errorData] : [])
    )
    return { error: err.message ?? String(err) }
  }
}
```

## Message Protocol Rules

1. **Every message must have a `type`** — a string constant imported from `messaging.js`.
2. **Payload is always an object** (`{}` if no parameters are needed) — never pass a primitive directly.
3. **Success responses always use `{ data: ... }`** to wrap the result.
4. **Error responses always use `{ error: string }`** — a human-readable message.
5. **Callers always check `response.error` before using `response.data`**:
   ```js
   const response = await sendMessage(JIRA_GET_PROJECTS)
   if (response.error) {
     error.value = response.error
     return
   }
   projects.value = response.data
   ```
6. **The background wraps the entire handler in `try/catch`**, logs the error with `console.error`, and returns `{ error: err.message }` for any unhandled exception. The log includes:
   - The message type that failed (e.g. `ThunderJira [JIRA_GET_PROJECTS]:`)
   - HTTP request detail if available (`GET project/search → 401`)
   - The error message
   - The full Jira server response body (if parsed), printed as a separate `Server response:` line
