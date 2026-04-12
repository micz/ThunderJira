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

import TurndownService from 'turndown'

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  hr: '---',
})

/**
 * Strip CSS styles and presentational attributes from an HTML string.
 * Uses DOMParser to safely remove <style> elements, <link rel="stylesheet">
 * elements, and inline style/class attributes before markdown conversion.
 */
function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('style').forEach(el => el.remove())
  doc.querySelectorAll('link[rel="stylesheet"]').forEach(el => el.remove())
  doc.querySelectorAll('img[src^="cid:"]').forEach(el => el.remove())
  doc.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'))
  doc.querySelectorAll('[class]').forEach(el => el.removeAttribute('class'))
  return doc.body.innerHTML
}

/**
 * Convert an HTML string to Markdown.
 * Returns an empty string if the input is empty or falsy.
 */
export function htmlToMarkdown(html) {
  if (!html) return ''
  return turndown.turndown(sanitizeHtml(html))
}
