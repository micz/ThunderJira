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

export function stripTrailingSlash(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

export function isValidUrl(str) {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}

// --- Email body extraction ---

function extractTextParts(fullMessage) {
  const textParts = []
  function walkParts(parts) {
    for (const part of parts) {
      if (part.parts && part.parts.length > 0) {
        walkParts(part.parts)
      } else {
        if (part.contentType && part.contentType.startsWith('text/')) {
          textParts.push(part)
        }
      }
    }
  }
  if (fullMessage.parts && fullMessage.parts.length > 0) {
    walkParts(fullMessage.parts)
  }
  return textParts
}

/**
 * Returns { text, html } from a full message returned by
 * messenger.messages.getFull(). If no HTML part exists,
 * generates HTML from plain text by converting newlines to <br>.
 */
export function getMailBody(fullMessage) {
  const textParts = extractTextParts(fullMessage)
  let text = ''
  let html = ''
  for (const part of textParts) {
    if (part.contentType === 'text/plain') {
      text += part.body
    } else if (part.contentType === 'text/html') {
      html += part.body
    }
  }
  if (html === '') {
    html = text.replace(/\n/g, '<br>')
  }
  return { text, html }
}
