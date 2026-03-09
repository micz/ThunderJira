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
  const sender = ref('')
  const date = ref('')
  const messageId = ref('')
  const loaded = ref(false)

  async function load() {
    logger.log('Loading email context from session storage')
    const ctx = await getEmailContext()
    if (ctx) {
      subject.value = ctx.subject ?? ''
      bodyText.value = ctx.bodyText ?? ''
      bodyHtml.value = ctx.bodyHtml ?? ''
      sender.value = ctx.sender ?? ''
      date.value = ctx.date ?? ''
      messageId.value = ctx.messageId ?? ''
      logger.log('Email context loaded: subject="' + subject.value + '", sender="' + sender.value + '", date=' + date.value)
    } else {
      logger.warn('No email context found in session storage')
    }
    loaded.value = true
  }

  return { subject, bodyText, bodyHtml, sender, date, messageId, loaded, load }
})
