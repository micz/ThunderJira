// Listens for GET_SELECTION requests from the background script.
// Returns the current text selection in the message display, as both plain text and HTML.
console.log('[ThunderJira | selection-capture] script loaded')

browser.runtime.onMessage.addListener((msg) => {
  console.log('[ThunderJira | selection-capture] message received: type=' + msg?.type)

  if (msg.type !== 'GET_SELECTION') return

  const sel = window.getSelection()
  console.log('[ThunderJira | selection-capture] getSelection: rangeCount=' + sel?.rangeCount + ', isCollapsed=' + sel?.isCollapsed + ', text="' + sel?.toString() + '"')

  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    console.log('[ThunderJira | selection-capture] no selection, returning empty')
    return Promise.resolve({ text: '', html: '' })
  }

  const text = sel.toString().trim()
  if (!text) {
    console.log('[ThunderJira | selection-capture] selection empty after trim, returning empty')
    return Promise.resolve({ text: '', html: '' })
  }

  const range = sel.getRangeAt(0)
  const fragment = range.cloneContents()
  const div = document.createElement('div')
  div.appendChild(fragment)

  console.log('[ThunderJira | selection-capture] returning selection: text="' + text + '", html="' + div.innerHTML + '"')
  return Promise.resolve({ text, html: div.innerHTML })
})
