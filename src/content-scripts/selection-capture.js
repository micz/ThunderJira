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
