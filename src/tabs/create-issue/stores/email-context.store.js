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

import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getEmailContext, getDebugMode } from '../../../shared/storage.js'
import { tjLogger } from '../../../shared/mztj-logger.js'

const logger = new tjLogger('EmailContextStore', false)
getDebugMode().then(enabled => logger.changeDebug(enabled))

export const useEmailContextStore = defineStore('emailContext', () => {
  const subject = ref('')
  const bodyText = ref('')
  const bodyHtml = ref('')
  const bodyDescription = ref('')
  // Ordered description block model extracted from the email body by the
  // background (text + inline-image blocks). Present only on the full-body
  // path when the email had resolvable inline cid: images; empty otherwise.
  const descriptionBlocks = ref([])
  // Inline-image binary data parallel to descriptionBlocks' image blocks:
  // [{ id, filename, mimeType, dataUrl }].
  const descriptionImages = ref([])
  const sender = ref('')
  const recipients = ref([])
  const ccList = ref([])
  const date = ref('')
  const messageId = ref('')
  const selectedText = ref('')
  const loaded = ref(false)

  async function load() {
    logger.log('Loading email context from session storage')
    const ctx = await getEmailContext()
    if (ctx) {
      subject.value = ctx.subject ?? ''
      bodyText.value = ctx.bodyText ?? ''
      bodyHtml.value = ctx.bodyHtml ?? ''
      bodyDescription.value = ctx.bodyDescription ?? ctx.bodyText ?? ''
      descriptionBlocks.value = ctx.descriptionBlocks ?? []
      descriptionImages.value = ctx.descriptionImages ?? []
      sender.value = ctx.sender ?? ''
      recipients.value = ctx.recipients ?? []
      ccList.value = ctx.ccList ?? []
      date.value = ctx.date ?? ''
      messageId.value = ctx.messageId ?? ''
      selectedText.value = ctx.selectedText ?? ''
      logger.log('Email context loaded: subject="' + subject.value + '", sender="' + sender.value + '", date=' + date.value + ', hasSelection=' + (selectedText.value.length > 0) + ', descriptionBlocks=' + descriptionBlocks.value.length + ', inlineImages=' + descriptionImages.value.length)
    } else {
      logger.warn('No email context found in session storage')
    }
    loaded.value = true
  }

  return { subject, bodyText, bodyHtml, bodyDescription, descriptionBlocks, descriptionImages, sender, recipients, ccList, date, messageId, selectedText, loaded, load }
})
