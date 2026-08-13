# Jira Client

## Overview

`src/api/jira-client.js` is the only module that communicates with Jira REST APIs. It is instantiated exclusively in `background.js` and never imported by Vue apps or stores.

## JiraClient Class

### Constructor

```js
class JiraClient {
  constructor({ url, type, credentials, cloudId = null, debug = false }) { ... }
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` | Base URL of the Jira instance (e.g. `https://mycompany.atlassian.net`) — no trailing slash |
| `type` | `'cloud' \| 'server'` | Determines API version and auth format |
| `credentials` | `object` | See auth section below |
| `cloudId` | `string \| null` | Cloud only. When set, API requests are routed through the Atlassian API gateway instead of `url` (scoped-token support — see below). Default `null` |
| `debug` | `boolean` | Initial debug flag for the internal `tjLogger` instance (default: `false`) |

The constructor creates a `tjLogger('JiraClient', debug)` exposed as `this.logger`. The background can call `_client.logger.changeDebug(enabled)` to toggle debug output at runtime without recreating the client.

### API Version Selection

The correct REST API version is selected automatically based on `type`:

| `type` | Base API path | Notes |
|--------|--------------|-------|
| `'cloud'` | `/rest/api/3` | Supports ADF for rich text fields and comments |
| `'server'` | `/rest/api/2` | Uses wiki markup for text fields; Data Center also uses v2 |

The full endpoint URL is constructed as: `${apiBaseUrl}${apiBase}/${endpoint}`, where `apiBaseUrl` is resolved by the private `_apiBaseUrl()` helper.

Example: `https://mycompany.atlassian.net/rest/api/3/project`

### Cloud Base URL — Scoped-Token (Gateway) Support

Jira Cloud offers two kinds of API tokens:

- **Unscoped** ("classic") tokens — work against `https://<site>.atlassian.net/...` (the default).
- **Scoped / granular** tokens (the only kind a **service account** can create) — are rejected by the `<site>.atlassian.net` host and **must** go through the Atlassian API gateway: `https://api.atlassian.com/ex/jira/<cloudId>/...`.

`_apiBaseUrl()` selects the origin:

| Condition | Effective origin |
|-----------|-----------------|
| `type === 'cloud'` and `cloudId` is set | `https://api.atlassian.com/ex/jira/<cloudId>` |
| otherwise | `this.url` (the configured site URL) |

The `apiBase` (`/rest/api/3`), endpoint paths, and auth headers are **identical** in both modes — only the origin changes.

**cloudId resolution.** `resolveCloudId()` performs `GET <this.url>/_edge/tenant_info` (unofficial but stable; no auth required) and returns the `cloudId` from the JSON response, or `null` on failure. `useGatewayMode()` resolves the id, stores it on `this.cloudId`, and returns it.

**Fallback strategy (orchestrated in `background.js`).** The default path uses the site URL. The background switches to gateway mode **only when the direct path fails**, where "fails" means the `getProjects()` call either throws a **401/403** *or* returns **zero projects** (the symptom of a scoped token hitting the wrong host). On a successful gateway retry the resolved `cloudId` is persisted into `jiraConfig`, so future sessions start in gateway mode and skip the probe. See [05-messaging.md](05-messaging.md) / `getProjectsWithGatewayFallback()` in `background.js`. Requires the `https://api.atlassian.com/*` host permission — see [02-manifest-and-permissions.md](02-manifest-and-permissions.md).

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

When the Jira server returns an HTTP error (`!response.ok`), `_request` throws an `Error` with enriched properties for debugging. A `204 No Content` response (returned by `PUT /issue`) is handled specially: `_request` returns `null` without calling `response.json()`, since there is no body to parse.

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

**Cloud:**
- Primary endpoint: `GET /project/search?maxResults=200&orderBy=name`
- Maps response `values` array to `{ key, name, id }`
- If `project/search` returns 0 results (HTTP 200 but empty `values`), falls back to `GET /project` — the legacy endpoint which is less affected by restrictive Browse Projects permission schemes or project-level privacy settings on some Jira Cloud instances.

**Server:**
- Endpoint: `GET /project` (returns plain array)
- Maps response array to `{ key, name, id }`

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
): Promise<Array<{ id: string, name: string, required: boolean, schema: object, allowedValues: Array|null, operations: Array<string> }>>
```

- Cloud endpoint: `GET /issue/createmeta/${projectKey}/issuetypes/${issueTypeId}`
- Server endpoint: `GET /issue/createmeta?projectKeys=${projectKey}&issuetypeIds=${issueTypeId}&expand=projects.issuetypes.fields`
- The internal `_normalizeFields(raw)` method maps both response shapes to the common format
- Each field includes an `operations` array (e.g. `["set"]`) from the Jira API indicating allowed operations during creation
- **Fields without `"set"` in their `operations` array are excluded during normalization and never returned.** This automatically filters out non-settable fields like `attachment` (which requires a separate multipart upload endpoint)

---

### `createIssue(fields)`

Creates a new issue.

```js
async createIssue(fields: object): Promise<{ id: string, key: string, self: string }>
```

- Endpoint: `POST /issue`
- Body: `{ fields }` — the caller passes the full fields map as-is
- For Cloud: if `fields.description` is present, it is wrapped in ADF via `_formatTextBlock(text)` before sending
- The description value is markdown or plain text (converted from email HTML by `background.js` using `html-to-markdown.js`)
- Returns only `id`, `key`, `self` from the Jira response

---

### `editIssue(issueKey, fields)`

Edits an existing issue's fields. Used after `createIssue` to replace the
text-only description with one that embeds uploaded images.

```js
async editIssue(issueKey: string, fields: object): Promise<null>
```

- Endpoint: `PUT /issue/${issueKey}`
- Body: `{ fields }` — the caller supplies fields **already formatted** for the
  target instance (an ADF object for Cloud, wiki markup / plain text for
  Server/DC). Unlike `createIssue`, this method does **not** re-wrap the
  description via `_formatTextBlock`.
- Jira answers `204 No Content`; `_request` returns `null` for that status.
- Returns `null`

---

### `addAttachment(issueIdOrKey, blob, filename)`

Uploads a single binary as an attachment to an issue. Used to upload pasted/
dropped images so they can be referenced from the description.

```js
async addAttachment(issueIdOrKey: string, blob: Blob, filename: string): Promise<Array<object>>
```

- Endpoint: `POST /issue/${issueIdOrKey}/attachments`
- Body: `multipart/form-data` with a single field named `file`
- The `Content-Type` header is omitted so the browser sets the multipart
  boundary; `X-Atlassian-Token: no-check` is injected at the network layer by
  the background's `webRequest` listener (see XSRF section below)
- Returns the JSON **array** of attachment metadata objects Jira responds with;
  each entry includes `filename` and `content` (the binary download URL used to
  embed the image in an ADF `media` node)

---

### `blocksToADF(blocks, imageUrlByFilename)`

Builds an Atlassian Document Format (ADF) doc from the ordered block model
produced by the create-issue description editor (see [03-vue-apps.md](03-vue-apps.md)).

```js
blocksToADF(blocks: Array, imageUrlByFilename: object): object
```

- Text blocks → ONE `paragraph` whose internal `\n` line breaks are rendered as
  `hardBreak` nodes (via the shared `_textToADFParagraph` helper). This makes
  Jira render tight line breaks that match the editor's `white-space: pre-wrap`
  model: one `\n` = a tight new line (no gap), and `\n\n` = exactly one blank
  line. Splitting into separate ADF paragraphs instead would add paragraph
  margins and turn a single editor blank line into two in Jira.
- Image blocks → a `mediaSingle` block wrapping a `media` node of
  `attrs.type: "external"` whose `url` is the uploaded attachment's `content`
  URL (looked up by filename in `imageUrlByFilename`); `alt` is the filename
- Returns a full ADF doc: `{ type: 'doc', version: 1, content: [...] }`
- The `media` external node is the community-recommended way to embed an
  attachment by URL; the internal `media` `type: "file"` path needs an
  unresolvable Media Services UUID and is not used

### `blocksToWiki(blocks)`

Builds Jira Server/DC wiki markup from the same ordered block model.

```js
blocksToWiki(blocks: Array): string
```

- Text blocks → text as-is
- Image blocks → `!filename!` (the wiki markup image macro referencing an
  attachment by filename)
- Blocks are joined with `\n`

---

### `addComment(issueKey, body)` (planned — not yet implemented)

> This method was removed with the `add-comment` tab and will be re-added when the
> "add email as comment" feature is implemented. The contract below is the design target.

Adds a comment to an existing issue.

```js
async addComment(issueKey: string, body: string): Promise<{ id: string, self: string }>
```

- Endpoint: `POST /issue/${issueKey}/comment`
- The `body` parameter is plain text from the Vue app
- The private method `_formatTextBlock(text)` converts it before sending (see below)
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

- **Cloud**: `GET /search/jql?jql=<encoded>&fields=<comma-separated>&startAt=N&maxResults=N` (URL-encoded parameters)
- **Server**: `POST /search` with body `{ jql, fields, startAt, maxResults }`
- Returns `{ issues, total, startAt }` from the Jira response

---

### `searchAssignableUsers(projectKey, query)`

Searches for users assignable to a project.

```js
async searchAssignableUsers(
  projectKey: string,
  query: string
): Promise<Array<{ id: string, displayName: string, avatarUrl: string }>>
```

- **Cloud**: `GET /user/assignable/search?project=${projectKey}&query=${query}&maxResults=10`
- **Server**: `GET /user/assignable/search?project=${projectKey}&username=${query}&maxResults=10`
- Returns normalized objects: `id` is `accountId` (Cloud) or `name` (Server), `displayName`, and `avatarUrl` (from `avatarUrls['48x48']`)

---

## Text Block Format — `_formatTextBlock(text)`

Used by `createIssue` (for the description field), and — once implemented — by the planned `addComment` (for the comment body). Converts plain text or markdown into the format required by the target Jira instance:

| Type | Format | Structure |
|------|--------|-----------|
| Cloud | ADF (Atlassian Document Format) — JSON | Structured document nodes |
| Server/DC | Plain text — string as-is | Passed through unchanged |

The private method handles this automatically:

```js
_formatTextBlock(text) {
  if (this.type === 'cloud') {
    return {
      type: 'doc',
      version: 1,
      content: [this._textToADFParagraph(text)]
    }
  }
  return text
}
```

For Cloud the whole text block becomes a single ADF paragraph built by
`_textToADFParagraph(text)`, which splits the text on `\n` and inserts a
`hardBreak` node between each line. This is the same helper `blocksToADF` uses
for text blocks, so the no-image create path and the image edit path render
line breaks identically: one `\n` = a tight new line (a `hardBreak`, no
paragraph gap), `\n\n` = exactly one blank line (two consecutive
`hardBreak`s). Wrapping the whole block in one paragraph avoids the paragraph
margins that would otherwise turn a single editor blank line into two in Jira.
Server/DC text is passed through unchanged (wiki markup renders `\n` as a line
break and `\n\n` as a blank line natively, so the model already matches).

Usage:
- `createIssue`: wraps `fields.description` in ADF for Cloud before sending
- `addComment` (planned): will wrap comment `body` in ADF for Cloud before sending
- Server/DC: text is sent as-is in both cases

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

## XSRF Bypass — `webRequest.onBeforeSendHeaders`

Jira (both Cloud and Server/DC) rejects state-changing requests (POST/PUT/DELETE) that look like they originate from a browser context. Since Thunderbird/Gecko *is* a browser, every `fetch()` from the background includes `Origin`, `Referer`, and a Gecko `User-Agent` — which triggers Jira's XSRF check and returns `403 — XSRF check failed`.

`X-Atlassian-Token: no-check` set at the JS Fetch API level is **not sufficient**: CORS strips custom headers that aren't whitelisted by the preflight response. The fix lives in `src/background/background.js` and uses `browser.webRequest.onBeforeSendHeaders` to rewrite headers at the network layer, after CORS stripping:

- strips `X-Atlassian-Token`, `Origin`, `Referer`, `User-Agent`
- injects `X-Atlassian-Token: no-check` (with hyphen — required by Atlassian)
- injects `User-Agent: ThunderJira/<version>`
- filters with `tabId === -1` so only background extension requests are touched

The listener URL filter is built dynamically. It always includes `https://*.atlassian.net/*` (Cloud) and `https://api.atlassian.com/*` (the Cloud scoped-token gateway). When the saved config is Server/DC, the user's configured origin (derived via `toOriginPattern()` from `src/shared/utils.js`) is appended. The listener is re-registered on startup and again whenever `STORAGE_KEY_JIRA_CONFIG` changes in `storage.local`, so switching URL or type takes effect without an extension reload.

The `webRequest` listener only fires for URLs the extension has host permission for. Cloud is covered by `host_permissions`; Server/DC is granted at runtime via `requestSitePermission()` — see [02-manifest-and-permissions.md](02-manifest-and-permissions.md).
