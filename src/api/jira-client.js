import { buildAuthHeaders } from './auth.js'
import { stripTrailingSlash } from '../shared/utils.js'
import { MAX_PROJECTS, DEFAULT_MAX_RESULTS } from '../shared/constants.js'
import { tjLogger } from '../shared/mztj-logger.js'

export class JiraClient {
  constructor({ url, type, credentials, debug = false }) {
    this.url = stripTrailingSlash(url)
    this.type = type
    this.credentials = credentials
    this.apiBase = type === 'cloud' ? '/rest/api/3' : '/rest/api/2'
    this.headers = buildAuthHeaders({ type, ...credentials })
    this.logger = new tjLogger('JiraClient', debug)
  }

  // --- Private helpers ---

  async _request(method, endpoint, body = null) {
    const url = this.url + this.apiBase + '/' + endpoint
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
    return response.json()
  }

  _formatTextBlock(text) {
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

  // --- Public methods ---

  async getProjects() {
    this.logger.log('getProjects()')
    if (this.type === 'cloud') {
      const data = await this._request('GET', 'project/search?maxResults=' + MAX_PROJECTS + '&orderBy=name')
      const projects = (data.values ?? []).map(({ key, name, id }) => ({ key, name, id }))
      this.logger.log('getProjects -> ' + projects.length + ' projects')
      return projects
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
      .map(({ id, name, subtask }) => ({ id, name, subtask }))
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

  async addComment(issueKey, body) {
    this.logger.log('addComment(' + issueKey + ')')
    const data = await this._request(
      'POST',
      'issue/' + issueKey + '/comment',
      { body: this._formatTextBlock(body) }
    )
    this.logger.log('addComment(' + issueKey + ') -> commentId=' + data.id)
    return { id: data.id, self: data.self }
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

  async getIssue(issueKey) {
    this.logger.log('getIssue(' + issueKey + ')')
    return this._request('GET', 'issue/' + issueKey)
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
