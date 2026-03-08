import { JiraClient } from '../api/jira-client.js'
import { STORAGE_KEY_JIRA_CONFIG, STORAGE_KEY_INITIALIZED } from '../shared/constants.js'
import {
  JIRA_GET_PROJECTS,
  JIRA_GET_ISSUE_TYPES,
  JIRA_GET_FIELDS,
  JIRA_CREATE_ISSUE,
  JIRA_ADD_COMMENT,
  JIRA_GET_ISSUE,
  JIRA_SEARCH_ISSUES,
  GET_EMAIL_CONTEXT,
} from '../shared/messaging.js'

// --- Lazy JiraClient instantiation ---

let _client = null

async function getJiraClient() {
  if (_client) return _client
  const result = await browser.storage.local.get(STORAGE_KEY_JIRA_CONFIG)
  const jiraConfig = result[STORAGE_KEY_JIRA_CONFIG]
  if (!jiraConfig) {
    throw new Error('Jira is not configured. Open Options to set up the connection.')
  }
  _client = new JiraClient(jiraConfig)
  return _client
}

// Invalidate cache when settings change
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY_JIRA_CONFIG]) {
    _client = null
  }
})

// --- Safe background init (runs once per session) ---

async function init() {
  const { [STORAGE_KEY_INITIALIZED]: initialized } =
    await browser.storage.session.get({ [STORAGE_KEY_INITIALIZED]: false })
  if (initialized) return
  await browser.storage.session.set({ [STORAGE_KEY_INITIALIZED]: true })
}

// Register a NOOP listener on onStartup to activate the background at startup
browser.runtime.onStartup.addListener(() => {})

init()

// --- Message router ---
// IMPORTANT: the listener MUST NOT be async.
// An async listener implicitly returns a Promise that Thunderbird does not recognize
// as a valid response to the message.

browser.runtime.onMessage.addListener((message) => {
  return handleMessage(message)
})

async function handleMessage(message) {
  const { type, payload } = message

  try {
    switch (type) {
      case JIRA_GET_PROJECTS: {
        const client = await getJiraClient()
        return { data: await client.getProjects() }
      }

      case JIRA_GET_ISSUE_TYPES: {
        const client = await getJiraClient()
        return { data: await client.getIssueTypes(payload.projectKey) }
      }

      case JIRA_GET_FIELDS: {
        const client = await getJiraClient()
        return { data: await client.getFields(payload.projectKey, payload.issueTypeId) }
      }

      case JIRA_CREATE_ISSUE: {
        const client = await getJiraClient()
        return { data: await client.createIssue(payload.fields) }
      }

      case JIRA_ADD_COMMENT: {
        const client = await getJiraClient()
        return { data: await client.addComment(payload.issueKey, payload.body) }
      }

      case JIRA_GET_ISSUE: {
        const client = await getJiraClient()
        return { data: await client.getIssue(payload.issueKey) }
      }

      case JIRA_SEARCH_ISSUES: {
        const client = await getJiraClient()
        return { data: await client.searchIssues(payload.jql, payload.fields, payload.startAt, payload.maxResults) }
      }

      case GET_EMAIL_CONTEXT: {
        const result = await browser.storage.session.get('emailContext')
        return { data: result.emailContext ?? null }
      }

      default:
        return { error: `Unknown message type: ${type}` }
    }
  } catch (err) {
    return { error: err.message ?? String(err) }
  }
}
