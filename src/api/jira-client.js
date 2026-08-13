/*
 *  ThunderJira [https://micz.it/thunderbird-addon-thunderjira/]
 *  Copyright (C) 2026 Mic (m@micz.it)

 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.

 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.

 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { buildAuthHeaders } from './auth.js'
import { stripTrailingSlash } from '../shared/utils.js'
import { MAX_PROJECTS, DEFAULT_MAX_RESULTS } from '../shared/constants.js'
import { tjLogger } from '../shared/mztj-logger.js'

// Atlassian API gateway base, required for scoped (granular) Cloud API tokens.
// Scoped tokens are rejected by the <site>.atlassian.net host and must go through
// https://api.atlassian.com/ex/jira/<cloudId>/... instead.
const GATEWAY_BASE = 'https://api.atlassian.com/ex/jira'

export class JiraClient {
  constructor({ url, type, credentials, cloudId = null, debug = false }) {
    this.url = stripTrailingSlash(url)
    this.type = type
    this.credentials = credentials
    // When set (Cloud only), API requests are routed through the gateway base
    // instead of this.url. Used to support scoped API tokens.
    this.cloudId = cloudId || null
    this.apiBase = type === 'cloud' ? '/rest/api/3' : '/rest/api/2'
    this.headers = buildAuthHeaders({ type, ...credentials })
    this.logger = new tjLogger('JiraClient', debug)
  }

  // --- Private helpers ---

  // Effective origin for API requests. Cloud falls back to the Atlassian API
  // gateway when a cloudId is known (scoped-token support); everything else
  // uses the configured site URL.
  _apiBaseUrl() {
    if (this.type === 'cloud' && this.cloudId) {
      return GATEWAY_BASE + '/' + this.cloudId
    }
    return this.url
  }

  async _request(method, endpoint, body = null) {
    const url = this._apiBaseUrl() + this.apiBase + '/' + endpoint
    const options = {
      method,
      headers: this.headers,
      mode: 'cors',
      credentials: 'omit',
    }

    if (body !== null) {
      options.body = JSON.stringify(body)
    }

    this.logger.log(method + ' ' + this.apiBase + '/' + endpoint)

    const response = await fetch(url, options)

    if (!response.ok) {
      let message = response.status + ' ' + response.statusText
      let errorData = null
      try {
        const rawText = await response.text()
        try {
          errorData = JSON.parse(rawText)
          const parts = []
          if (errorData.errorMessages?.length) {
            parts.push(...errorData.errorMessages)
          }
          if (errorData.errors && Object.keys(errorData.errors).length) {
            for (const [field, msg] of Object.entries(errorData.errors)) {
              parts.push(field + ': ' + msg)
            }
          }
          if (parts.length) {
            message = parts.join('; ')
          } else if (errorData.message) {
            message = errorData.message
          }
        } catch {
          // Not JSON — include raw text to help diagnose the error
          if (rawText) message += ' — ' + rawText.slice(0, 500)
        }
      } catch {
        // Could not read response body — use status text
      }
      this.logger.warn(method + ' ' + endpoint + ' failed: ' + message)
      const err = new Error(message)
      err.status = response.status
      err.method = method
      err.endpoint = endpoint
      err.errorData = errorData
      throw err
    }

    this.logger.log(method + ' ' + endpoint + ' -> ' + response.status)
    // PUT edit returns 204 No Content — there is no body to parse.
    if (response.status === 204) {
      return null
    }
    const data = await response.json()
    if (this.logger.do_debug) {
      this.logger.log(method + ' ' + endpoint + ' response body: ' + JSON.stringify(data))
    }
    return data
  }

  _formatTextBlock(text) {
    if (this.type === 'cloud') {
      return {
        type: 'doc',
        version: 1,
        content: [this._textToADFParagraph(text)],
      }
    }
    return text
  }

  // Builds a single ADF paragraph from a text block, turning every "\n" into a
  // `hardBreak` node so Jira renders tight line breaks that match the editor's
  // `white-space: pre-wrap` model: one "\n" = a tight new line (no gap), and
  // "\n\n" = exactly one blank line (two consecutive hardBreaks). Wrapping the
  // whole block in one paragraph avoids the paragraph margins that would
  // otherwise turn a single editor blank line into two in Jira.
  _textToADFParagraph(text) {
    const lines = (text ?? '').split('\n')
    const content = []
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) content.push({ type: 'hardBreak' })
      if (lines[i].length) content.push({ type: 'text', text: lines[i] })
    }
    return { type: 'paragraph', content }
  }

  _normalizeFields(raw) {
    let fields
    if (this.type === 'cloud') {
      // Cloud: response is { fields: [{ fieldId, name, required, schema, allowedValues, operations }] }
      fields = (raw.fields ?? raw.values ?? []).map((f) => ({
        id: f.fieldId,
        name: f.name,
        required: f.required,
        schema: f.schema,
        allowedValues: f.allowedValues ?? null,
        operations: f.operations ?? [],
      }))
    } else {
      // Server: response is { projects: [{ issuetypes: [{ fields: { fieldId: { name, required, schema } } }] }] }
      const project = raw.projects?.[0]
      const issueType = project?.issuetypes?.[0]
      const rawFields = issueType?.fields ?? {}

      fields = Object.entries(rawFields).map(([id, f]) => ({
        id,
        name: f.name,
        required: f.required,
        schema: f.schema,
        allowedValues: f.allowedValues ?? null,
        operations: f.operations ?? [],
      }))
    }

    // Only keep fields that can be set during issue creation
    return fields.filter((f) => f.operations.includes('set'))
  }

  // --- Cloud scoped-token (gateway) support ---

  // Resolves the site's cloudId via the (unofficial but stable) tenant_info
  // endpoint, which is served from the configured site URL and does not require
  // auth. Returns the cloudId string, or null on failure.
  async resolveCloudId() {
    const url = this.url + '/_edge/tenant_info'
    this.logger.log('resolveCloudId() -> GET ' + url)
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
        mode: 'cors',
        credentials: 'omit',
      })
      if (!response.ok) {
        this.logger.warn('resolveCloudId failed: ' + response.status + ' ' + response.statusText)
        return null
      }
      const data = await response.json()
      const cloudId = data?.cloudId ?? null
      this.logger.log('resolveCloudId -> ' + (cloudId ?? 'null'))
      return cloudId
    } catch (err) {
      this.logger.warn('resolveCloudId error: ' + (err.message ?? String(err)))
      return null
    }
  }

  // Switches this client to gateway mode by resolving and storing the cloudId.
  // Returns the resolved cloudId (also set on this.cloudId), or null on failure.
  async useGatewayMode() {
    const cloudId = await this.resolveCloudId()
    if (cloudId) {
      this.cloudId = cloudId
      this.logger.log('Gateway mode enabled (cloudId=' + cloudId + ')')
    }
    return cloudId
  }

  // --- Public methods ---

  async getProjects() {
    this.logger.log('getProjects()')
    if (this.type === 'cloud') {
      const data = await this._request('GET', 'project/search?maxResults=' + MAX_PROJECTS + '&orderBy=name')
      const fromSearch = (data.values ?? []).map(({ key, name, id }) => ({ key, name, id }))
      if (fromSearch.length > 0) {
        this.logger.log('getProjects -> ' + fromSearch.length + ' projects')
        return fromSearch
      }
      // Fallback: project/search returned 0 — try the legacy endpoint which
      // is less affected by Browse Projects permission scheme restrictions.
      this.logger.log('getProjects: project/search returned 0, falling back to /project')
      const fallbackData = await this._request('GET', 'project')
      const fromFallback = (Array.isArray(fallbackData) ? fallbackData : [])
        .map(({ key, name, id }) => ({ key, name, id }))
      this.logger.log('getProjects -> ' + fromFallback.length + ' projects (fallback)')
      return fromFallback
    }

    // Server: GET /project returns a direct array
    const data = await this._request('GET', 'project')
    const projects = data.map(({ key, name, id }) => ({ key, name, id }))
    this.logger.log('getProjects -> ' + projects.length + ' projects')
    return projects
  }

  async getIssueTypes(projectKey) {
    this.logger.log('getIssueTypes(' + projectKey + ')')
    const data = await this._request('GET', 'project/' + projectKey)
    const types = (data.issueTypes ?? [])
      .filter((t) => !t.subtask)
      .map(({ id, name, subtask, hierarchyLevel }) => ({ id, name, subtask, hierarchyLevel }))
    this.logger.log('getIssueTypes(' + projectKey + ') -> ' + types.length + ' types')
    return types
  }

  async getFields(projectKey, issueTypeId) {
    this.logger.log('getFields(' + projectKey + ', ' + issueTypeId + ')')
    let data
    if (this.type === 'cloud') {
      data = await this._request('GET', 'issue/createmeta/' + projectKey + '/issuetypes/' + issueTypeId)
    } else {
      data = await this._request(
        'GET',
        'issue/createmeta?projectKeys=' + projectKey + '&issuetypeIds=' + issueTypeId + '&expand=projects.issuetypes.fields'
      )
    }
    this.logger.log('getFields raw response: ' + JSON.stringify(data, null, 2))
    const fields = this._normalizeFields(data)
    this.logger.log('getFields -> ' + fields.length + ' fields')
    return fields
  }

  async createIssue(fields) {
    this.logger.log('createIssue(summary="' + fields.summary + '")')
    let resolvedFields = fields
    if (this.type === 'cloud' && fields.description) {
      resolvedFields = { ...fields, description: this._formatTextBlock(fields.description) }
    }
    const data = await this._request('POST', 'issue', { fields: resolvedFields })
    this.logger.log('createIssue -> ' + data.key)
    return { id: data.id, key: data.key, self: data.self }
  }

  // Edits an existing issue's fields. The caller supplies fields already
  // formatted for the target instance (ADF object for Cloud, wiki markup /
  // plain text for Server/DC) — this method does NOT re-wrap the description,
  // unlike createIssue. Returns null (Jira answers PUT /issue with 204).
  async editIssue(issueKey, fields) {
    this.logger.log('editIssue(' + issueKey + ')')
    await this._request('PUT', 'issue/' + issueKey, { fields })
    this.logger.log('editIssue(' + issueKey + ') -> OK')
    return null
  }

  // Uploads a single file as an attachment. Jira's attachments endpoint requires
  // multipart/form-data with the field named "file" and the X-Atlassian-Token:
  // no-check header (the latter is injected at the network layer by the
  // background's webRequest listener). The Content-Type header must be omitted
  // so the browser can set the multipart boundary. Returns the JSON array of
  // attachment metadata objects Jira responds with (each has .content, the
  // binary download URL, and .filename).
  async addAttachment(issueIdOrKey, blob, filename) {
    const url = this._apiBaseUrl() + this.apiBase + '/issue/' + issueIdOrKey + '/attachments'
    const formData = new FormData()
    formData.append('file', new File([blob], filename, { type: blob.type }))

    // Drop Content-Type so fetch sets the multipart boundary automatically.
    const headers = {}
    for (const [k, v] of Object.entries(this.headers)) {
      if (k.toLowerCase() !== 'content-type') headers[k] = v
    }

    this.logger.log('addAttachment -> POST /issue/' + issueIdOrKey + '/attachments [' + filename + ']')
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      mode: 'cors',
      credentials: 'omit',
    })

    if (!response.ok) {
      let message = response.status + ' ' + response.statusText
      try {
        const rawText = await response.text()
        try {
          const errorData = JSON.parse(rawText)
          if (errorData.errorMessages?.length) message = errorData.errorMessages.join('; ')
          else if (errorData.message) message = errorData.message
        } catch {
          if (rawText) message += ' — ' + rawText.slice(0, 500)
        }
      } catch {
        // Could not read response body — use status text
      }
      this.logger.warn('addAttachment failed: ' + message)
      const err = new Error(message)
      err.status = response.status
      err.filename = filename
      throw err
    }

    const data = await response.json()
    this.logger.log('addAttachment -> ' + (Array.isArray(data) ? data.length : 1) + ' attachment(s)')
    return Array.isArray(data) ? data : [data]
  }

  // Builds an Atlassian Document Format (ADF) doc from the ordered block model
  // produced by the create-issue editor. Each text block becomes ONE paragraph
  // whose internal "\n" line breaks are rendered as `hardBreak` nodes (via
  // `_textToADFParagraph`), so Jira shows tight line breaks and exactly one
  // blank line per "\n\n" — matching the editor's `pre-wrap` rendering instead
  // of the doubled blank lines that separate ADF paragraphs would produce.
  // Image blocks become a mediaSingle wrapping a media node of type "external"
  // whose URL is the uploaded attachment's content URL. imageUrlByFilename
  // maps each image filename to its attachment content URL.
  blocksToADF(blocks, imageUrlByFilename) {
    const content = []
    for (const block of blocks) {
      if (block.type === 'image') {
        content.push({
          type: 'mediaSingle',
          attrs: { layout: 'center' },
          content: [
            {
              type: 'media',
              attrs: {
                type: 'external',
                url: imageUrlByFilename[block.filename] ?? '',
                alt: block.filename,
              },
            },
          ],
        })
      } else {
        const text = block.text ?? ''
        if (text) content.push(this._textToADFParagraph(text))
      }
    }
    // An ADF doc must contain at least one block; fall back to an empty paragraph.
    if (content.length === 0) {
      content.push({ type: 'paragraph', content: [] })
    }
    return { type: 'doc', version: 1, content }
  }

  // Builds Jira Server/DC wiki markup from the ordered block model. Images are
  // referenced by attachment filename with the !filename! macro.
  blocksToWiki(blocks) {
    const parts = []
    for (const block of blocks) {
      if (block.type === 'image') {
        parts.push('!' + block.filename + '!')
      } else {
        parts.push(block.text ?? '')
      }
    }
    return parts.join('\n')
  }

  async searchAssignableUsers(projectKey, query) {
    this.logger.log('searchAssignableUsers(' + projectKey + ', "' + query + '")')
    const encodedQuery = encodeURIComponent(query)
    let data
    if (this.type === 'cloud') {
      data = await this._request(
        'GET',
        'user/assignable/search?project=' + projectKey + '&query=' + encodedQuery + '&maxResults=10'
      )
    } else {
      data = await this._request(
        'GET',
        'user/assignable/search?project=' + projectKey + '&username=' + encodedQuery + '&maxResults=10'
      )
    }
    const users = (data ?? []).map((u) => ({
      id: this.type === 'cloud' ? u.accountId : u.name,
      displayName: u.displayName,
      avatarUrl: u.avatarUrls?.['24x24'] ?? null,
    }))
    this.logger.log('searchAssignableUsers -> ' + users.length + ' users')
    return users
  }

  async searchLabels(query) {
    this.logger.log('searchLabels("' + query + '")')
    const encodedQuery = encodeURIComponent(query)
    // Use JQL autocomplete endpoint — works on both Cloud (api/3) and Server (api/2)
    const data = await this._request(
      'GET',
      'jql/autocompletedata/suggestions?fieldName=labels&fieldValue=' + encodedQuery
    )
    const labels = (data.results ?? []).map((s) => s.value ?? s.displayName ?? s)
    this.logger.log('searchLabels -> ' + labels.length + ' labels')
    return labels
  }

  async getIssue(issueKey) {
    this.logger.log('getIssue(' + issueKey + ')')
    // Request only the fields used by the overlay panel.
    // flagged is the Cloud built-in; customfield_10021 is the Server impediment field.
    const fields = 'summary,status,assignee,priority,description,flagged,customfield_10021'
    const data = await this._request('GET', 'issue/' + issueKey + '?fields=' + fields)
    this.logger.log('getIssue(' + issueKey + ') raw response: ' + JSON.stringify(data, null, 2))
    return data
  }

  async searchIssues(jql, fields, startAt = 0, maxResults = DEFAULT_MAX_RESULTS) {
    this.logger.log('searchIssues(jql="' + jql + '", startAt=' + startAt + ')')
    let data
    if (this.type === 'cloud') {
      // Cloud: use GET /search/jql (POST /search was removed)
      const params = 'jql=' + encodeURIComponent(jql)
        + '&fields=' + encodeURIComponent((fields ?? []).join(','))
        + '&startAt=' + startAt
        + '&maxResults=' + maxResults
      data = await this._request('GET', 'search/jql?' + params)
    } else {
      // Server: POST /search is still supported
      data = await this._request('POST', 'search', { jql, fields, startAt, maxResults })
    }
    this.logger.log('searchIssues -> total=' + data.total + ', returned=' + data.issues?.length)
    return { issues: data.issues, total: data.total, startAt: data.startAt }
  }
}
