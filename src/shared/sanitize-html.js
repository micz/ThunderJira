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

import DOMPurify from 'dompurify'

// Drop <img> elements whose src is a cid: reference — they point to email
// attachments and cannot be resolved once the description reaches Jira.
DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName !== 'img') return
  const src = node.getAttribute?.('src') ?? ''
  if (/^cid:/i.test(src)) node.remove()
})

/**
 * Sanitize email HTML before Turndown converts it to Markdown for a Jira
 * description. Drops <style>, <link>, inline style/class attributes, and
 * embedded cid: images (which are unresolvable outside the mail client).
 */
export function sanitizeForMarkdown(html) {
  if (!html) return ''
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ['style', 'link'],
    FORBID_ATTR: ['style', 'class'],
    ALLOW_DATA_ATTR: false,
    USE_PROFILES: { html: true },
  })
}

/**
 * Sanitize email HTML before rendering it via v-html in the email preview.
 * Uses DOMPurify defaults (which strip scripts, event handlers, javascript:
 * URLs, etc.) and additionally removes <img> tags to match prior behavior.
 */
export function sanitizeForPreview(html) {
  if (!html) return ''
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ['img'],
    ALLOW_DATA_ATTR: false,
    USE_PROFILES: { html: true },
  })
}
