import { JiraClient } from '../api/jira-client.js'
import { STORAGE_KEY_JIRA_CONFIG, STORAGE_KEY_DEBUG } from '../shared/constants.js'
import {
  JIRA_GET_PROJECTS,
  JIRA_GET_ISSUE_TYPES,
  JIRA_GET_FIELDS,
  JIRA_CREATE_ISSUE,
  JIRA_ADD_COMMENT,
  JIRA_GET_ISSUE,
  JIRA_SEARCH_ISSUES,
  JIRA_SEARCH_USERS,
  JIRA_SEARCH_LABELS,
  GET_EMAIL_CONTEXT,
  GET_SELECTION,
  OPEN_URL,
} from '../shared/messaging.js'
import { getMailBody } from '../shared/utils.js'
import { htmlToMarkdown } from '../shared/html-to-markdown.js'
import {
  setEmailContext,
  getDebugMode
} from '../shared/storage.js'
import { tjLogger } from '../shared/mztj-logger.js'

// --- Logger ---

const logger = new tjLogger('Background', false)

// --- Lazy JiraClient instantiation ---

let _client = null

async function getJiraClient() {
  if (_client) return _client
  const result = await browser.storage.local.get(STORAGE_KEY_JIRA_CONFIG)
  const jiraConfig = result[STORAGE_KEY_JIRA_CONFIG]
  if (!jiraConfig) {
    throw new Error('Jira is not configured. Open Options to set up the connection.')
  }
  const debug = await getDebugMode()
  _client = new JiraClient({ ...jiraConfig, debug })
  logger.log('JiraClient created: type=' + jiraConfig.type + ', url=' + jiraConfig.url)
  return _client
}

// Invalidate cache when settings change
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes[STORAGE_KEY_JIRA_CONFIG]) {
      logger.log('Jira config changed - invalidating client cache')
      _client = null
    }
    if (changes[STORAGE_KEY_DEBUG]) {
      const enabled = changes[STORAGE_KEY_DEBUG].newValue
      logger.changeDebug(enabled)
      if (_client) _client.logger.changeDebug(enabled)
      logger.log('Debug mode updated: ' + enabled)
    }
  }
})

// A restarting background will try to re-register the message display scripts,
// and fail. Catch the error.
browser.scripting.messageDisplay.registerScripts([
  {
    id: "message-overlay",
    js: ["/content-scripts/message-overlay.js"],
  },
  {
    id: "selection-capture",
    js: ["/content-scripts/selection-capture.js"],
  }
]).catch(console.info);

// --- Safe background init (runs once per session) ---

async function init() {
  const debugEnabled = await getDebugMode()
  logger.changeDebug(debugEnabled)
  logger.log('Background init started')

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

  logger.log('Background init complete - context menus registered')
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
    headers.push({ name: 'User-Agent', value: 'ThunderJira/' + browser.runtime.getManifest().version })
    return { requestHeaders: headers }
  },
  { urls: ['https://*.atlassian.net/*'] },
  ['blocking', 'requestHeaders']
)

// --- Selection capture helper ---

// Queries the active message display tab for the current text selection.
// Returns { text, html } — both empty strings if nothing is selected.
async function getSelectionFromTab(tabId) {
  logger.log('getSelectionFromTab: querying tabId=' + tabId)
  try {
    const result = await browser.tabs.sendMessage(tabId, { type: GET_SELECTION })
    logger.log('getSelectionFromTab: result=' + JSON.stringify(result))
    return (result && result.text) ? result : { text: '', html: '' }
  } catch (err) {
    logger.warn('getSelectionFromTab: sendMessage failed (tabId=' + tabId + '): ' + (err.message ?? String(err)))
    return { text: '', html: '' }
  }
}

// --- Context menu handler ---

browser.menus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== 'create-jira-issue' && info.menuItemId !== 'create-jira-issue-display') {
    return
  }

  logger.log('Context menu clicked: ' + info.menuItemId + ', hasSelectedMessages=' + !!(info.selectedMessages?.messages?.length) + ', info.tab=' + JSON.stringify(info.tab ?? null))

  try {
    // Get selected message and the tab id for selection capture
    let messageHeader = null
    let displayTabId = null

    if (info.selectedMessages && info.selectedMessages.messages.length > 0) {
      messageHeader = info.selectedMessages.messages[0]
      // Resolve the active tab so we can query the selection
      const tabs = await browser.tabs.query({ active: true, currentWindow: true })
      logger.log('Context menu (selectedMessages path): active tabs=' + JSON.stringify(tabs.map(t => ({ id: t.id, mailTab: t.mailTab, url: t.url }))))
      if (tabs.length > 0) displayTabId = tabs[0].id
    } else {
      // Fallback: get from the active tab
      const tabs = await browser.tabs.query({ active: true, currentWindow: true })
      logger.log('Context menu (fallback path): active tabs=' + JSON.stringify(tabs.map(t => ({ id: t.id, mailTab: t.mailTab, url: t.url }))))
      if (tabs.length > 0) {
        const tab = tabs[0]
        displayTabId = tab.id
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
    logger.log('Context menu: resolved displayTabId=' + displayTabId)

    if (!messageHeader) {
      logger.warn('No message header found, aborting context menu action')
      return
    }

    logger.log('Processing message: subject="' + messageHeader.subject + '", author="' + messageHeader.author + '"')
    const fullMessage = await browser.messages.getFull(messageHeader.id)
    // logger.log('fullMessage: ' + JSON.stringify(fullMessage))
    const body = getMailBody(fullMessage)
    logger.log('body: ' + JSON.stringify(body))

    const sender = messageHeader.author ||
      (fullMessage.headers?.from ? fullMessage.headers.from[0] : '')
    const recipients = messageHeader.recipients ?? []
    const ccList = messageHeader.ccList ?? []
    const emailMsgId = fullMessage.headers?.['message-id']
      ? fullMessage.headers['message-id'][0]
      : ''

    // Use selected text if available, otherwise fall back to full email body
    const sel = displayTabId ? await getSelectionFromTab(displayTabId) : { text: '', html: '' }
    const hasSelection = sel.text.length > 0

    const finalBodyText = hasSelection ? sel.text : body.text
    const finalBodyHtml = hasSelection ? sel.html : body.html
    const hasRealHtml = finalBodyHtml && finalBodyHtml !== body.text.replace(/\n/g, '<br>')
    const bodyDescription = hasRealHtml ? htmlToMarkdown(finalBodyHtml) : finalBodyText

    logger.log('Context menu: selection result: hasSelection=' + hasSelection + ', selText="' + sel.text.substring(0, 80) + '", hasRealHtml=' + hasRealHtml)

    await setEmailContext({
      subject: messageHeader.subject || '',
      bodyText: finalBodyText,
      bodyHtml: finalBodyHtml,
      bodyDescription,
      selectedText: hasSelection ? sel.text : '',
      sender,
      recipients,
      ccList,
      date: messageHeader.date ? new Date(messageHeader.date).toISOString() : '',
      messageId: emailMsgId,
    })

    logger.log('Email context stored, opening create-issue tab')
    browser.tabs.create({
      url: browser.runtime.getURL('tabs/create-issue/index.html'),
    })
  } catch (err) {
    console.error('ThunderJira: failed to open create-issue tab', err)
  }
})

// --- Action button handler (same action as context menu) ---

browser.messageDisplayAction.onClicked.addListener(async (tab) => {
  logger.log('Action button clicked, tabId=' + tab.id)
  try {
    const result = await browser.messageDisplay.getDisplayedMessages(tab.id)
    const messageHeader = result?.messages?.[0]
    if (!messageHeader) {
      logger.warn('No messageHeader found, aborting action button handler')
      return
    }

    logger.log('Processing message: subject="' + messageHeader.subject + '", author="' + messageHeader.author + '"')
    const fullMessage = await browser.messages.getFull(messageHeader.id)
    const body = getMailBody(fullMessage)
    logger.log('body: ' + JSON.stringify(body))
    const sender = messageHeader.author ||
      (fullMessage.headers?.from ? fullMessage.headers.from[0] : '')
    const recipients = messageHeader.recipients ?? []
    const ccList = messageHeader.ccList ?? []
    const emailMsgId = fullMessage.headers?.['message-id']
      ? fullMessage.headers['message-id'][0]
      : ''

    // Use selected text if available, otherwise fall back to full email body
    const sel = await getSelectionFromTab(tab.id)
    const hasSelection = sel.text.length > 0

    const finalBodyText = hasSelection ? sel.text : body.text
    const finalBodyHtml = hasSelection ? sel.html : body.html
    const hasRealHtml = finalBodyHtml && finalBodyHtml !== body.text.replace(/\n/g, '<br>')
    const bodyDescription = hasRealHtml ? htmlToMarkdown(finalBodyHtml) : finalBodyText

    logger.log('Action button: selection result: hasSelection=' + hasSelection + ', selText="' + sel.text.substring(0, 80) + '", hasRealHtml=' + hasRealHtml)

    logger.log('Selection capture: hasSelection=' + hasSelection)

    await setEmailContext({
      subject: messageHeader.subject || '',
      bodyText: finalBodyText,
      bodyHtml: finalBodyHtml,
      bodyDescription,
      selectedText: hasSelection ? sel.text : '',
      sender,
      recipients,
      ccList,
      date: messageHeader.date ? new Date(messageHeader.date).toISOString() : '',
      messageId: emailMsgId,
    })

    logger.log('Email context stored, opening create-issue tab')
    browser.tabs.create({
      url: browser.runtime.getURL('tabs/create-issue/index.html'),
    })
  } catch (err) {
    console.error('ThunderJira: action button failed', err)
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

  logger.log('Message received: ' + type)

  try {
    switch (type) {
      case JIRA_GET_PROJECTS: {
        const client = await getJiraClient()
        const data = await client.getProjects()
        logger.log(type + ' -> ' + data.length + ' projects')
        return { data }
      }

      case JIRA_GET_ISSUE_TYPES: {
        const client = await getJiraClient()
        const data = await client.getIssueTypes(payload.projectKey)
        logger.log(type + ' [' + payload.projectKey + '] -> ' + data.length + ' issue types')
        return { data }
      }

      case JIRA_GET_FIELDS: {
        const client = await getJiraClient()
        const data = await client.getFields(payload.projectKey, payload.issueTypeId)
        logger.log(type + ' [' + payload.projectKey + '/' + payload.issueTypeId + '] -> ' + data.length + ' fields')
        return { data }
      }

      case JIRA_CREATE_ISSUE: {
        const client = await getJiraClient()
        const data = await client.createIssue(payload.fields)
        logger.log(type + ' -> created issue ' + data.key)
        return { data }
      }

      case JIRA_ADD_COMMENT: {
        const client = await getJiraClient()
        const data = await client.addComment(payload.issueKey, payload.body)
        logger.log(type + ' -> comment added to ' + payload.issueKey)
        return { data }
      }

      case JIRA_GET_ISSUE: {
        const client = await getJiraClient()
        const data = await client.getIssue(payload.issueKey)
        logger.log(type + ' [' + payload.issueKey + '] -> OK')
        return { data }
      }

      case JIRA_SEARCH_ISSUES: {
        const client = await getJiraClient()
        const data = await client.searchIssues(payload.jql, payload.fields, payload.startAt, payload.maxResults)
        logger.log(type + ' -> total=' + data.total + ', returned=' + data.issues?.length)
        return { data }
      }

      case JIRA_SEARCH_USERS: {
        const client = await getJiraClient()
        const data = await client.searchAssignableUsers(payload.projectKey, payload.query)
        logger.log(type + ' [' + payload.projectKey + '] -> ' + data.length + ' users')
        return { data }
      }

      case JIRA_SEARCH_LABELS: {
        const client = await getJiraClient()
        const data = await client.searchLabels(payload.query)
        logger.log(type + ' -> ' + data.length + ' labels')
        return { data }
      }

      case GET_EMAIL_CONTEXT: {
        const result = await browser.storage.session.get('emailContext')
        logger.log(type + ' -> context ' + (result.emailContext ? 'found' : 'not found'))
        return { data: result.emailContext ?? null }
      }

      case OPEN_URL:
        await browser.tabs.create({ url: payload.url })
        return { data: null }

      default:
        logger.warn('Unknown message type: ' + type)
        return { error: 'Unknown message type: ' + type }
    }
  } catch (err) {
    logger.warn(type + ' failed: ' + (err.message ?? String(err)))
    return { error: err.message ?? String(err) }
  }
}
