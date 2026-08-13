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

import { JiraClient } from '../api/jira-client.js'
import { STORAGE_KEY_JIRA_CONFIG, STORAGE_KEY_DEBUG } from '../shared/constants.js'
import {
  JIRA_GET_PROJECTS,
  JIRA_GET_ISSUE_TYPES,
  JIRA_GET_FIELDS,
  JIRA_CREATE_ISSUE,
  JIRA_GET_ISSUE,
  JIRA_SEARCH_ISSUES,
  JIRA_SEARCH_USERS,
  JIRA_SEARCH_LABELS,
  GET_EMAIL_CONTEXT,
  GET_SELECTION,
  OPEN_URL,
} from '../shared/messaging.js'
import { getMailBody, toOriginPattern, dataUrlToBlob, removeMozMainHeader } from '../shared/utils.js'
import { htmlToMarkdown } from '../shared/html-to-markdown.js'
import {
  setEmailContext,
  getDebugMode,
  getJiraConfig,
  setJiraConfig
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

// Persists the resolved cloudId into jiraConfig so future sessions start in
// gateway mode and skip the probe. Updating jiraConfig also invalidates the
// cached client and re-runs refreshXsrfListener via the storage.onChanged
// listeners below.
async function persistCloudId(cloudId) {
  const config = await getJiraConfig()
  if (!config) return
  await setJiraConfig({ ...config, cloudId })
  logger.log('Persisted cloudId into jiraConfig')
}

// Fetches projects, falling back to the Atlassian API gateway when a Cloud
// scoped (granular) token is in use. The direct <site>.atlassian.net path is
// considered to have "failed" when it either throws a 401/403 OR returns zero
// projects (the symptom of a scoped token hitting the wrong host). On a
// successful gateway retry the resolved cloudId is persisted.
async function getProjectsWithGatewayFallback(client) {
  let directProjects = null
  let directError = null
  try {
    directProjects = await client.getProjects()
    if (directProjects.length > 0) return directProjects
    logger.log('getProjects returned 0 projects')
  } catch (err) {
    directError = err
    const status = err.status
    if (status !== 401 && status !== 403) throw err
    logger.log('getProjects failed with ' + status + ' - attempting gateway fallback')
  }

  // Only Cloud supports the gateway, and only if not already routed through it.
  if (client.type !== 'cloud' || client.cloudId) {
    if (directError) throw directError
    return directProjects
  }

  logger.log('Attempting Cloud gateway fallback (scoped-token support)')
  const cloudId = await client.useGatewayMode()
  if (!cloudId) {
    logger.warn('Gateway fallback aborted: could not resolve cloudId')
    if (directError) throw directError
    return directProjects
  }

  const gatewayProjects = await client.getProjects()
  if (gatewayProjects.length > 0) {
    await persistCloudId(cloudId)
    return gatewayProjects
  }

  // Gateway resolved but still empty: surface the direct result/error so the
  // existing "no projects" hint is shown. Reset cloudId so we don't persist it.
  client.cloudId = null
  logger.log('Gateway fallback returned 0 projects - keeping direct result')
  if (directError) throw directError
  return directProjects
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
  
  browser.menus.create({
    id: 'create-jira-issue-selection',
    title: browser.i18n.getMessage('menuCreateIssue'),
    contexts: ['selection'],
  })

  logger.log('Background init complete - context menus registered')
}

// Register a NOOP listener on onStartup to activate the background at startup
browser.runtime.onStartup.addListener(() => {})

// Open onboarding page on first install
browser.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    browser.tabs.create({ url: browser.runtime.getURL('onboarding/index.html') })
  }
})

init()

// --- XSRF bypass via network-level header injection ---
// Strip Origin/Referer/User-Agent (which trigger Jira's browser-detection XSRF
// check on POST/PUT/DELETE) and inject X-Atlassian-Token: no-check. These rewrites
// must happen at the network level because CORS strips JS-set custom headers
// before the request leaves the browser.
function xsrfHeaderRewrite(details) {
  // Only intercept background extension requests (tabId -1), not tab navigation
  if (details.tabId !== -1) return
  const headers = (details.requestHeaders ?? [])
    .filter(h => {
      const name = h.name.toLowerCase()
      return name !== 'x-atlassian-token'
        && name !== 'origin'
        && name !== 'referer'
        && name !== 'user-agent'
    })
  headers.push({ name: 'X-Atlassian-Token', value: 'no-check' })
  headers.push({ name: 'User-Agent', value: 'ThunderJira/' + browser.runtime.getManifest().version })
  return { requestHeaders: headers }
}

// Cloud is always covered; Server/DC origin is added dynamically based on
// the saved jiraConfig and re-registered whenever the user updates it.
function registerXsrfListener(urlPatterns) {
  if (browser.webRequest.onBeforeSendHeaders.hasListener(xsrfHeaderRewrite)) {
    browser.webRequest.onBeforeSendHeaders.removeListener(xsrfHeaderRewrite)
  }
  browser.webRequest.onBeforeSendHeaders.addListener(
    xsrfHeaderRewrite,
    { urls: urlPatterns },
    ['blocking', 'requestHeaders']
  )
}

async function refreshXsrfListener() {
  // Cloud sites and the Atlassian API gateway (used for scoped Cloud tokens)
  // are always covered; Server/DC origin is added dynamically.
  const patterns = ['https://*.atlassian.net/*', 'https://api.atlassian.com/*']
  try {
    const config = await getJiraConfig()
    if (config?.type === 'server' && config?.url) {
      const serverPattern = toOriginPattern(config.url)
      if (serverPattern && !patterns.includes(serverPattern)) {
        patterns.push(serverPattern)
      }
    }
  } catch (err) {
    logger.warn('refreshXsrfListener: failed to read jiraConfig: ' + (err.message ?? String(err)))
  }
  try {
    registerXsrfListener(patterns)
    logger.log('XSRF listener registered for: ' + patterns.join(', '))
  } catch (err) {
    logger.warn('refreshXsrfListener: registerXsrfListener failed: ' + (err.message ?? String(err)))
  }
}

refreshXsrfListener()

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && Object.prototype.hasOwnProperty.call(changes, STORAGE_KEY_JIRA_CONFIG)) {
    refreshXsrfListener()
  }
})

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

// --- Inline email image extraction ---
//
// Email inline images are <img src="cid:..."> pointing at related MIME parts.
// They cannot be resolved once the description reaches Jira, so they are
// dropped by the sanitize step in the plain-text path. Here we instead extract
// their bytes, keep their position with a placeholder that survives the
// HTML -> markdown conversion, and rebuild an ordered block model (text +
// image) identical to what the description editor produces for pasted images.
// The downstream create -> upload-attachment -> edit flow then embeds them.
//
// This is best-effort and never throws: any failure falls back to a plain
// text-only description so the user still gets their issue.

// Private-Use-Area delimiters that never appear in real email text and are
// not touched by DOMPurify or Turndown. Each resolvable cid: image is replaced
// in the HTML by a text node "<index>" before conversion.
const IMG_PLACEHOLDER_START = ''
const IMG_PLACEHOLDER_END = ''
const IMG_PLACEHOLDER_RE = /(\d+)/g

function extFromMime(mime) {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/gif') return 'gif'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/bmp') return 'bmp'
  if (mime === 'image/svg+xml') return 'svg'
  return 'png'
}

// Recursively collects inline image parts (image/* MIME parts carrying a
// Content-ID header) from a messages.getFull() result. Returns a Map of
// cid -> { partName, filename, mimeType }.
function collectInlineImages(fullMessage) {
  const map = new Map()
  function walkParts(parts) {
    for (const part of parts) {
      if (part.parts?.length) walkParts(part.parts)
      const ct = part.contentType ?? ''
      if (!ct.startsWith('image/')) continue
      const cidRaw = part.headers?.['content-id']?.[0]
      if (!cidRaw) continue
      const cid = cidRaw.replace(/^<|>$/g, '')
      if (!cid) continue
      const filename = (part.name || part.filename || 'inline-image').replace(/[/\\:*?"<>|]/g, '_')
      map.set(cid, { partName: part.partName, filename, mimeType: ct })
    }
  }
  if (fullMessage.parts?.length) walkParts(fullMessage.parts)
  return map
}

// Reads a File/Blob as a base64 data URL string.
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsDataURL(file)
  })
}

// True when `img` is the only non-whitespace child of its parent element.
function isSoleImage(parent, img) {
  for (const child of parent.childNodes) {
    if (child === img) continue
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.data.trim().length) return false
    } else {
      return false
    }
  }
  return true
}

// Normalizes the ordered block list so inline images are not surrounded by
// runs of empty lines. The HTML -> Markdown conversion inserts "\n\n"
// between block elements and leaves <br>/<p> empty paragraphs around each
// image; without trimming, each of those blank lines becomes an empty
// paragraph in the Jira ADF (or a blank line in wiki markup). Rules:
//   - collapse runs of 3+ newlines to a single blank line ("\n\n") inside a
//     text block;
//   - strip every newline on the side of a text block that faces an image
//     (or the start/end of the whole list), so no blank line sits directly
//     against an image;
//   - drop text blocks that become empty/whitespace-only (a blank line
//     between two text paragraphs is encoded as "\n\n" inside one text block,
//     never as a separate empty block, so dropping these loses nothing).
function normalizeBlocks(blocks) {
  const out = []
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.type === 'image') {
      out.push(b)
      continue
    }
    let text = (b.text ?? '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    const prevIsImage = out.length > 0 && out[out.length - 1].type === 'image'
    const nextIsImage = i < blocks.length - 1 && blocks[i + 1].type === 'image'
    if (prevIsImage || out.length === 0) text = text.replace(/^\n+/, '')
    if (nextIsImage || i === blocks.length - 1) text = text.replace(/\n+$/, '')
    if (!text.trim()) continue
    out.push({ type: 'text', text })
  }
  return out
}

// Builds { blocks, images } for an email HTML body, or { blocks: null } when
// there are no resolvable inline images. `images` is an array of
// { id, filename, mimeType, dataUrl } parallel to the image blocks.
async function buildDescriptionBlocks(fullMessage, messageId, html) {
  const inline = collectInlineImages(fullMessage)
  if (inline.size === 0) return { blocks: null, images: [] }

  // Fetch each inline image's bytes; drop any that fail so a single bad
  // image never aborts the rest.
  const entries = []
  let idx = 0
  for (const [cid, info] of inline) {
    idx += 1
    try {
      const file = await browser.messages.getAttachmentFile(messageId, info.partName)
      const dataUrl = await fileToDataUrl(file)
      entries.push({
        index: idx,
        cid,
        filename: 'email-img-' + idx + '.' + extFromMime(info.mimeType),
        mimeType: info.mimeType,
        dataUrl,
      })
    } catch (err) {
      logger.warn('buildDescriptionBlocks: failed to load inline image cid=' + cid + ': ' + (err.message ?? String(err)))
    }
  }
  if (!entries.length) return { blocks: null, images: [] }

  // Mark up the HTML: replace each resolvable cid: <img> with a placeholder
  // text node carrying its index. When the image is the sole content of a
  // block element, replace the whole element so the image stays block-level
  // (the common case for inline email images).
  const doc = new DOMParser().parseFromString(html, 'text/html')
  removeMozMainHeader(doc.body)
  const entryByCid = new Map(entries.map((e) => [e.cid, e]))
  for (const img of Array.from(doc.body.querySelectorAll('img'))) {
    const src = img.getAttribute('src') ?? ''
    const m = /^cid:(.+)$/i.exec(src)
    if (!m) continue
    const cid = m[1].replace(/^<|>$/g, '')
    const entry = entryByCid.get(cid)
    if (!entry) continue
    const placeholder = doc.createTextNode(IMG_PLACEHOLDER_START + entry.index + IMG_PLACEHOLDER_END)
    const parent = img.parentElement
    if (parent && (parent.tagName === 'P' || parent.tagName === 'DIV') && isSoleImage(parent, img)) {
      parent.replaceWith(placeholder)
    } else {
      img.replaceWith(placeholder)
    }
  }
  const markedHtml = doc.body.innerHTML

  // Convert to markdown; the placeholders survive as plain text.
  const markdown = htmlToMarkdown(markedHtml)

  // Split the markdown into ordered blocks on the placeholders.
  const blocks = []
  const images = []
  const entryByIndex = new Map(entries.map((e) => [e.index, e]))
  let last = 0
  let m
  IMG_PLACEHOLDER_RE.lastIndex = 0
  while ((m = IMG_PLACEHOLDER_RE.exec(markdown)) !== null) {
    const text = markdown.slice(last, m.index)
    if (text.length) blocks.push({ type: 'text', text })
    const entry = entryByIndex.get(Number(m[1]))
    if (entry) {
      const id = 'emailimg_' + entry.index
      blocks.push({ type: 'image', id, filename: entry.filename })
      images.push({ id, filename: entry.filename, mimeType: entry.mimeType, dataUrl: entry.dataUrl })
    }
    last = m.index + m[0].length
  }
  const tail = markdown.slice(last)
  if (tail.length) blocks.push({ type: 'text', text: tail })

  const normalized = normalizeBlocks(blocks)
  if (!normalized.length) return { blocks: null, images: [] }

  return { blocks: normalized, images }
}

// --- Common logic to process message and open create-issue tab ---

async function openCreateIssueTab(messageHeader, displayTabId) {
  if (!messageHeader) {
    logger.warn('No message header found, aborting action')
    return
  }

  logger.log('Processing message: subject="' + messageHeader.subject + '", author="' + messageHeader.author + '"')
  const fullMessage = await browser.messages.getFull(messageHeader.id)
  // logger.log('fullMessage: ' + JSON.stringify(fullMessage))
  const body = await getMailBody(fullMessage, messageHeader.id)
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

  logger.log('Selection result: hasSelection=' + hasSelection + ', selText="' + sel.text.substring(0, 80) + '", hasRealHtml=' + hasRealHtml)

  // Extract inline cid: images as image blocks, but only for the full-body path:
  // when there is a selection, the live display DOM has already rewritten the
  // cid: references to internal URLs, so extraction is unreliable there.
  let descriptionBlocks = null
  let descriptionImages = []
  if (hasRealHtml && !hasSelection) {
    try {
      const built = await buildDescriptionBlocks(fullMessage, messageHeader.id, finalBodyHtml)
      descriptionBlocks = built.blocks
      descriptionImages = built.images
    } catch (err) {
      logger.warn('buildDescriptionBlocks failed: ' + (err.message ?? String(err)))
    }
  }

  const ctx = {
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
  }
  if (descriptionBlocks && descriptionBlocks.length) {
    ctx.descriptionBlocks = descriptionBlocks
    ctx.descriptionImages = descriptionImages
  }

  // Storing large inline images as base64 in session storage can exceed the
  // quota; on failure, retry without the image data so the tab still opens
  // with a plain text description.
  try {
    await setEmailContext(ctx)
  } catch (err) {
    logger.warn('setEmailContext failed (likely session storage quota from inline images), retrying without image data: ' + (err.message ?? String(err)))
    const ctxTextOnly = { ...ctx }
    delete ctxTextOnly.descriptionBlocks
    delete ctxTextOnly.descriptionImages
    await setEmailContext(ctxTextOnly)
  }

  logger.log('Email context stored, opening create-issue tab')
  browser.tabs.create({
    url: browser.runtime.getURL('tabs/create-issue/index.html'),
  })
}

// --- Context menu handler ---

browser.menus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== 'create-jira-issue' && info.menuItemId !== 'create-jira-issue-display' && info.menuItemId !== 'create-jira-issue-selection') {
    return
  }

  logger.log('Context menu clicked info: ' + JSON.stringify(info))
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
          const msg = await browser.messageDisplay.getDisplayedMessages(tab.id)
          if (msg && msg.messages && msg.messages.length > 0) messageHeader = msg.messages[0]
        }
      }
    }
    logger.log('Context menu: resolved displayTabId=' + displayTabId)

    await openCreateIssueTab(messageHeader, displayTabId)
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

    await openCreateIssueTab(messageHeader, tab.id)
  } catch (err) {
    console.error('ThunderJira: action button failed', err)
  }
})

// --- Create issue with embedded images ---

// Creates an issue, then — when the description contains pasted/dropped images —
// uploads them as attachments and edits the description to embed them. The
// initial create always uses a text-only description; images are referenced
// only after their attachments exist (Jira cannot embed an image that has not
// been uploaded yet). If the attachment upload or the description edit fails,
// the already-created issue is returned together with an `attachmentsWarning`
// instead of throwing, so the user still gets their issue.
async function createIssueWithImages(client, payload) {
  const blocks = payload.descriptionBlocks ?? []
  const images = payload.images ?? []

  const textOnly = blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n')

  const createFields = { ...payload.fields, description: textOnly }
  const issue = await client.createIssue(createFields)

  if (!images.length) return issue

  const warnings = []
  const urlByFilename = {}
  try {
    for (const img of images) {
      const blob = dataUrlToBlob(img.dataUrl)
      const attachments = await client.addAttachment(issue.id, blob, img.filename)
      const att = Array.isArray(attachments) ? attachments[0] : attachments
      if (att?.content) urlByFilename[img.filename] = att.content
    }

    const finalDescription = client.type === 'cloud'
      ? client.blocksToADF(blocks, urlByFilename)
      : client.blocksToWiki(blocks)

    await client.editIssue(issue.key, { description: finalDescription })
  } catch (err) {
    logger.warn('createIssueWithImages: attachment/edit step failed: ' + (err.message ?? String(err)))
    warnings.push(err.message ?? String(err))
  }

  if (warnings.length) {
    issue.attachmentsWarning = warnings.join('; ')
  }
  return issue
}

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
        const data = await getProjectsWithGatewayFallback(client)
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
        const data = await createIssueWithImages(client, payload)
        const warning = data.attachmentsWarning
        logger.log(type + ' -> created issue ' + data.key + (warning ? ' (with attachment warning)' : ''))
        const result = { data }
        if (warning) result.attachmentsWarning = warning
        return result
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
        await browser.windows.openDefaultBrowser(payload.url)
        return { data: null }

      default:
        logger.warn('Unknown message type: ' + type)
        return { error: 'Unknown message type: ' + type }
    }
  } catch (err) {
    logger.warn(type + ' failed: ' + (err.message ?? String(err)))
    const isNotConfigured = err.message === 'Jira is not configured. Open Options to set up the connection.'
    return {
      error: err.message ?? String(err),
      ...(isNotConfigured ? { errorCode: 'NOT_CONFIGURED' } : {})
    }
  }
}
