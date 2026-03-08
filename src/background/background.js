import { JiraClient } from '../api/jira-client.js'
import { STORAGE_KEY_JIRA_CONFIG } from '../shared/constants.js'
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
import { getMailBody } from '../shared/utils.js'
import { setEmailContext } from '../shared/storage.js'

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
  await browser.menus.removeAll()

  // Register context menu items
  browser.menus.create({
    id: 'create-jira-issue',
    title: browser.i18n.getMessage('menuCreateIssue'),
    contexts: ['message_list'],
  })

  browser.menus.create({
    id: 'create-jira-issue-display',
    title: browser.i18n.getMessage('menuCreateIssue'),
    contexts: ['message_display_action_menu'],
  })
}

// Register a NOOP listener on onStartup to activate the background at startup
browser.runtime.onStartup.addListener(() => {})

init()

// --- XSRF bypass via network-level header injection ---
// Browsers (including Thunderbird/Gecko) strip custom headers from cross-origin
// POST requests before sending them, so X-Atlassian-Token set in JS-level headers
// never reaches Jira Cloud. webRequest.onBeforeSendHeaders injects it AFTER the
// CORS stripping, directly at the network layer.
browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    // Only intercept background extension requests (tabId -1), not tab navigation
    if (details.tabId !== -1) return
    const headers = (details.requestHeaders ?? [])
      .filter(h => {
        const name = h.name.toLowerCase()
        // Remove headers that reveal the browser nature of the request and trigger
        // Jira Cloud's XSRF check even when using API token Basic auth
        return name !== 'x-atlassian-token' && name !== 'origin' && name !== 'referer' && name !== 'user-agent'
      })
    headers.push({ name: 'X-Atlassian-Token', value: 'no-check' })
    headers.push({ name: 'User-Agent', value: `ThunderJira/${browser.runtime.getManifest().version}` })
    return { requestHeaders: headers }
  },
  { urls: ['https://*.atlassian.net/*'] },
  ['blocking', 'requestHeaders']
)

// --- Context menu handler ---

browser.menus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== 'create-jira-issue' && info.menuItemId !== 'create-jira-issue-display') {
    return
  }

  try {
    // Get selected message
    let messageHeader = null
    if (info.selectedMessages && info.selectedMessages.messages.length > 0) {
      messageHeader = info.selectedMessages.messages[0]
    } else {
      // Fallback: get from the active tab
      const tabs = await browser.tabs.query({ active: true, currentWindow: true })
      if (tabs.length > 0) {
        const tab = tabs[0]
        if (tab.mailTab) {
          const list = await browser.mailTabs.getSelectedMessages(tab.id)
          if (list && list.messages.length > 0) {
            messageHeader = list.messages[0]
          }
        } else {
          const msg = await browser.messageDisplay.getDisplayedMessage(tab.id)
          if (msg) messageHeader = msg
        }
      }
    }

    if (!messageHeader) return

    const fullMessage = await browser.messages.getFull(messageHeader.id)
    const body = getMailBody(fullMessage)

    const sender = messageHeader.author ||
      (fullMessage.headers?.from ? fullMessage.headers.from[0] : '')
    const emailMsgId = fullMessage.headers?.['message-id']
      ? fullMessage.headers['message-id'][0]
      : ''

    await setEmailContext({
      subject: messageHeader.subject || '',
      bodyText: body.text,
      bodyHtml: body.html,
      sender,
      date: messageHeader.date ? new Date(messageHeader.date).toISOString() : '',
      messageId: emailMsgId,
    })

    browser.tabs.create({
      url: browser.runtime.getURL('tabs/create-issue/index.html'),
    })
  } catch (err) {
    console.error('ThunderJira: failed to open create-issue tab', err)
  }
})

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
