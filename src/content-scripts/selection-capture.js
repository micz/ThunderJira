// Listens for GET_SELECTION requests from the background script.
// Returns the current text selection in the message display, as both plain text and HTML.
import { tjLogger } from '../shared/mztj-logger.js'
import { getDebugMode } from '../shared/storage.js'

const logger = new tjLogger('SelectionCapture', false)
getDebugMode().then(enabled => {
  logger.changeDebug(enabled)
  logger.log('script loaded')
})

browser.runtime.onMessage.addListener((msg) => {
  logger.log('message received: type=' + msg?.type)

  if (msg.type !== 'GET_SELECTION') return

  const sel = window.getSelection()
  logger.log('getSelection: rangeCount=' + sel?.rangeCount + ', isCollapsed=' + sel?.isCollapsed + ', text="' + sel?.toString() + '"')

  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    logger.log('no selection, returning empty')
    return Promise.resolve({ text: '', html: '' })
  }

  const text = sel.toString().trim()
  if (!text) {
    logger.log('selection empty after trim, returning empty')
    return Promise.resolve({ text: '', html: '' })
  }

  const range = sel.getRangeAt(0)
  const fragment = range.cloneContents()
  const div = document.createElement('div')
  div.appendChild(fragment)

  logger.log('returning selection: text="' + text + '", html="' + div.innerHTML + '"')
  return Promise.resolve({ text, html: div.innerHTML })
})
