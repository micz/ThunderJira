import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getEmailContext } from '../../../shared/storage.js'

export const useEmailContextStore = defineStore('emailContext', () => {
  const subject = ref('')
  const bodyText = ref('')
  const bodyHtml = ref('')
  const sender = ref('')
  const date = ref('')
  const messageId = ref('')
  const loaded = ref(false)

  async function load() {
    const ctx = await getEmailContext()
    if (ctx) {
      subject.value = ctx.subject ?? ''
      bodyText.value = ctx.bodyText ?? ''
      bodyHtml.value = ctx.bodyHtml ?? ''
      sender.value = ctx.sender ?? ''
      date.value = ctx.date ?? ''
      messageId.value = ctx.messageId ?? ''
    }
    loaded.value = true
  }

  return { subject, bodyText, bodyHtml, sender, date, messageId, loaded, load }
})
