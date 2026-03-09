# Jira Client

## Overview

`src/api/jira-client.js` is the only module that communicates with Jira REST APIs. It is instantiated exclusively in `background.js` and never imported by Vue apps or stores.

## JiraClient Class

### Constructor

```js
class JiraClient {
  constructor({ url, type, credentials, debug = false }) { ... }
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` | Base URL of the Jira instance (e.g. `https://mycompany.atlassian.net`) — no trailing slash |
| `type` | `'cloud' \| 'server'` | Determines API version and auth format |
| `credentials` | `object` | See auth section below |
| `debug` | `boolean` | Initial debug flag for the internal `tjLogger` instance (default: `false`) |

The constructor creates a `tjLogger('JiraClient', debug)` exposed as `this.logger`. The background can call `_client.logger.changeDebug(enabled)` to toggle debug output at runtime without recreating the client.

### API Version Selection

The correct REST API version is selected automatically based on `type`:

| `type` | Base API path | Notes |
|--------|--------------|-------|
| `'cloud'` | `/rest/api/3` | Supports ADF for rich text fields and comments |
| `'server'` | `/rest/api/2` | Uses wiki markup for text fields; Data Center also uses v2 |

The full endpoint URL is constructed as: `${url}${apiBase}/${endpoint}`

Example: `https://mycompany.atlassian.net/rest/api/3/project`

### Lazy Instantiation in Background

The background does not instantiate `JiraClient` at startup. Instead it uses a lazy getter that reads config from `storage.local` on first use and caches the instance:

```js
let _client = null

async function getJiraClient() {
  if (_client) return _client
  const result = await browser.storage.local.get(STORAGE_KEY_JIRA_CONFIG)
  const jiraConfig = result[STORAGE_KEY_JIRA_CONFIG]
  if (!jiraConfig) throw new Error('Jira is not configured. Open Options to set up the connection.')
  const debug = await getDebugMode()
  _client = new JiraClient({ ...jiraConfig, debug })
  return _client
}

// Invalidate cache when Jira settings change; sync logger on debug toggle
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes[STORAGE_KEY_JIRA_CONFIG]) _client = null
    if (changes[STORAGE_KEY_DEBUG]) {
      const enabled = changes[STORAGE_KEY_DEBUG].newValue
      logger.changeDebug(enabled)
      if (_client) _client.logger.changeDebug(enabled)
    }
  }
})
```

---

## Error Handling in `_request`

When the Jira server returns an HTTP error (`!response.ok`), `_request` throws an `Error` with enriched properties for debugging:

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Human-readable message extracted from the response (prefers `errorMessages`, then `message`, falls back to status text) |
| `status` | `number` | HTTP status code (e.g. `401`, `404`, `500`) |
| `method` | `string` | HTTP method used (`GET`, `POST`, etc.) |
| `endpoint` | `string` | API endpoint path (e.g. `project/search?maxResults=200`) |
| `errorData` | `object \| null` | Full parsed JSON error body from Jira, or `null` if the body could not be parsed |

The background `handleMessage` catch block uses these properties to log a detailed `console.error` (see [05-messaging.md](05-messaging.md) rule 6).

---

## Public Methods

### `getProjects()`

Fetches all projects visible to the authenticated user.

```js
async getProjects(): Promise<Array<{ key: string, name: string, id: string }>>
```

- Endpoint: `GET /project/search?maxResults=200&orderBy=name`
- Maps response `values` array to `{ key, name, id }`

---

### `getIssueTypes(projectKey)`

Fetches issue types for a specific project.

```js
async getIssueTypes(projectKey: string): Promise<Array<{ id: string, name: string, subtask: boolean }>>
```

- Endpoint: `GET /project/${projectKey}` (Cloud: includes `issueTypes` in response)
- Alternative for Server: `GET /issuetype` (filtered by project)
- Returns only non-subtask types by default (subtask issues require a parent — not supported in the current create form)

---

### `getFields(projectKey, issueTypeId)`

Fetches the fields available on the create screen for the given project + issue type.

```js
async getFields(
  projectKey: string,
  issueTypeId: string
): Promise<Array<{ id: string, name: string, required: boolean, schema: object, allowedValues: Array|null }>>
```

- Cloud endpoint: `GET /issue/createmeta/${projectKey}/issuetypes/${issueTypeId}`
- Server endpoint: `GET /issue/createmeta?projectKeys=${projectKey}&issuetypeIds=${issueTypeId}&expand=projects.issuetypes.fields`
- The internal `_normalizeFields(raw)` method maps both response shapes to the common format

---

### `createIssue(fields)`

Creates a new issue.

```js
async createIssue(fields: object): Promise<{ id: string, key: string, self: string }>
```

- Endpoint: `POST /issue`
- Body: `{ fields }` — the caller passes the full fields map as-is
- Returns only `id`, `key`, `self` from the Jira response

---

### `addComment(issueKey, body)`

Adds a comment to an existing issue.

```js
async addComment(issueKey: string, body: string): Promise<{ id: string, self: string }>
```

- Endpoint: `POST /issue/${issueKey}/comment`
- The `body` parameter is plain text from the Vue app
- The private method `_formatCommentBody(text)` converts it before sending (see below)
- Returns `id` and `self` from the Jira response

---

### `getIssue(issueKey)`

Fetches a single issue with all default fields.

```js
async getIssue(issueKey: string): Promise<object>
```

- Endpoint: `GET /issue/${issueKey}`
- Returns the full Jira issue object as-is (no normalization)

---

### `searchIssues(jql, fields, startAt, maxResults)`

Executes a JQL search.

```js
async searchIssues(
  jql: string,
  fields: Array<string>,
  startAt: number = 0,
  maxResults: number = 25
): Promise<{ issues: Array<object>, total: number, startAt: number }>
```

- Endpoint: `POST /search`
- Body: `{ jql, fields, startAt, maxResults }`
- Returns `{ issues, total, startAt }` from the Jira response

---

## Comment Body Format — `_formatCommentBody(text)`

Jira Cloud and Jira Server require different formats for comment bodies:

| Type | Format | Structure |
|------|--------|-----------|
| Cloud | ADF (Atlassian Document Format) — JSON | Structured document nodes |
| Server/DC | Wiki markup — plain string | `*bold*`, `{code}`, etc. |

The private method handles this automatically:

```js
_formatCommentBody(text) {
  if (this.type === 'cloud') {
    // Returns ADF JSON object
    return {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text }]
        }
      ]
    }
  } else {
    // Returns plain string for wiki markup
    return text
  }
}
```

The `addComment` method calls `_formatCommentBody` and places the result in the appropriate request body field:
- Cloud: `POST /issue/{key}/comment` body → `{ body: <ADF object> }`
- Server: `POST /issue/{key}/comment` body → `{ body: <string> }`

---

## Authentication — `src/api/auth.js`

The `auth.js` module exports a single function `buildAuthHeaders(config)` used by `JiraClient` to construct the HTTP `Authorization` header.

### Jira Cloud — Basic Auth (API Token + Email)

```
Authorization: Basic base64(email:apiToken)
```

```js
// auth.js
export function buildAuthHeaders({ type, email, apiToken, pat }) {
  if (type === 'cloud') {
    const encoded = btoa(`${email}:${apiToken}`)
    return {
      'Authorization': `Basic ${encoded}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  }
  // ...
}
```

### Jira Server / Data Center — Bearer Token (PAT)

```
Authorization: Bearer <personalAccessToken>
```

```js
  if (type === 'server') {
    return {
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  }
```

The `credentials` object stored in `storage.local` has the shape:
- Cloud: `{ email: string, apiToken: string }`
- Server: `{ pat: string }`

`JiraClient` calls `buildAuthHeaders({ type: this.type, ...this.credentials })` before every request and includes the result in the `fetch` options.
