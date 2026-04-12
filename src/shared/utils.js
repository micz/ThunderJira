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
      }
      // console.log(">>>>>>>>>>>> extractTextParts: part.contentType: " + part.contentType + ", part.decryptionStatus: " + part.decryptionStatus + ", part.body: " + part.body);
      if (part.contentType && part.contentType.startsWith('text/')) {
        textParts.push(part)
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
export async function getMailBody(fullMessage, messageId) {
  const textParts = extractTextParts(fullMessage);
  let text = "";
  let html = "";
  // console.log(">>>>>>>>>>>>>> getMailBody: textParts: " + JSON.stringify(textParts));
  // console.log(">>>>>>>>>>>>>> getMailBody: fullMessage: " + JSON.stringify(fullMessage));
  for (const part of textParts) {
    let body = part.body;
    if ((body === undefined || body === "") && messageId && part.partName) {
      const file = await browser.messages.getAttachmentFile(messageId, part.partName);
      const buf = await file.arrayBuffer();
      //const buf = new TextDecoder('utf-8').decode(buf);
      body = smartDecode(buf);
    }
    if (part.contentType === "text/plain") {
      // console.log(">>>>>>>>>>>>>> getMailBody: part.body (TEXT): " + body);
      text += body ?? "";
    } else if (part.contentType === "text/html") {
      // console.log(">>>>>>>>>>>>>> getMailBody: part.body (HTML): " + (body ? body.substring(0, 80) : body));
      html += body ?? "";
    }
  }
  if(html === "") {
    html = text.replace(/\n/g, "<br>");
  } else {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    removeMozMainHeader(doc.body);
    html = doc.body.innerHTML;
  }
  return {text, html};
}

function smartDecode(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch (e) {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

export function removeMozMainHeader(root) {
  for (const table of root.querySelectorAll('table.moz-main-header')) {
    let sibling = table.previousElementSibling;
    while (sibling && sibling.tagName === 'DIV') {
      const toRemove = sibling;
      sibling = sibling.previousElementSibling;
      toRemove.remove();
    }
    table.remove();
  }
}