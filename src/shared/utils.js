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
