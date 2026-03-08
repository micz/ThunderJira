import { buildAuthHeaders } from './auth.js'
import { stripTrailingSlash } from '../shared/utils.js'
import { MAX_PROJECTS, DEFAULT_MAX_RESULTS } from '../shared/constants.js'

export class JiraClient {
  constructor({ url, type, credentials }) {
    this.url = stripTrailingSlash(url)
    this.type = type
    this.credentials = credentials
    this.apiBase = type === 'cloud' ? '/rest/api/3' : '/rest/api/2'
    this.headers = buildAuthHeaders({ type, ...credentials })
  }

  // --- Private helpers ---

  async _request(method, endpoint, body = null) {
    const url = `${this.url}${this.apiBase}/${endpoint}`
    const options = {
      method,
      headers: this.headers,
    }

    if (body !== null) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)

    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`
      let errorData = null
      try {
        errorData = await response.json()
        if (errorData.errorMessages?.length) {
          message = errorData.errorMessages.join('; ')
        } else if (errorData.message) {
          message = errorData.message
        }
      } catch {
        // Could not parse error body — use status text
      }
      const err = new Error(message)
      err.status = response.status
      err.method = method
      err.endpoint = endpoint
      err.errorData = errorData
      throw err
    }

    return response.json()
  }

  _formatCommentBody(text) {
    if (this.type === 'cloud') {
      return {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text }],
          },
        ],
      }
    }
    return text
  }

  _normalizeFields(raw) {
    if (this.type === 'cloud') {
      // Cloud: response is { values: [{ fieldId, name, required, schema }] }
      return (raw.values ?? []).map((f) => ({
        id: f.fieldId,
        name: f.name,
        required: f.required,
        schema: f.schema,
      }))
    }

    // Server: response is { projects: [{ issuetypes: [{ fields: { fieldId: { name, required, schema } } }] }] }
    const project = raw.projects?.[0]
    const issueType = project?.issuetypes?.[0]
    const fields = issueType?.fields ?? {}

    return Object.entries(fields).map(([id, f]) => ({
      id,
      name: f.name,
      required: f.required,
      schema: f.schema,
    }))
  }

  // --- Public methods ---

  async getProjects() {
    if (this.type === 'cloud') {
      const data = await this._request('GET', `project/search?maxResults=${MAX_PROJECTS}&orderBy=name`)
      return (data.values ?? []).map(({ key, name, id }) => ({ key, name, id }))
    }

    // Server: GET /project returns a direct array
    const data = await this._request('GET', 'project')
    return data.map(({ key, name, id }) => ({ key, name, id }))
  }

  async getIssueTypes(projectKey) {
    const data = await this._request('GET', `project/${projectKey}`)
    return (data.issueTypes ?? [])
      .filter((t) => !t.subtask)
      .map(({ id, name, subtask }) => ({ id, name, subtask }))
  }

  async getFields(projectKey, issueTypeId) {
    if (this.type === 'cloud') {
      const data = await this._request('GET', `issue/createmeta/${projectKey}/issuetypes/${issueTypeId}`)
      return this._normalizeFields(data)
    }

    const data = await this._request(
      'GET',
      `issue/createmeta?projectKeys=${projectKey}&issuetypeIds=${issueTypeId}&expand=projects.issuetypes.fields`
    )
    return this._normalizeFields(data)
  }

  async createIssue(fields) {
    const data = await this._request('POST', 'issue', { fields })
    return { id: data.id, key: data.key, self: data.self }
  }

  async addComment(issueKey, body) {
    const data = await this._request(
      'POST',
      `issue/${issueKey}/comment`,
      { body: this._formatCommentBody(body) }
    )
    return { id: data.id, self: data.self }
  }

  async getIssue(issueKey) {
    return this._request('GET', `issue/${issueKey}`)
  }

  async searchIssues(jql, fields, startAt = 0, maxResults = DEFAULT_MAX_RESULTS) {
    const data = await this._request('POST', 'search', { jql, fields, startAt, maxResults })
    return { issues: data.issues, total: data.total, startAt: data.startAt }
  }
}
