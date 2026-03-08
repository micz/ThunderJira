import { ref } from 'vue'
import { defineStore } from 'pinia'
import { sendMessage, JIRA_GET_PROJECTS } from '../../shared/messaging.js'
import { STORAGE_KEY_JIRA_CONFIG } from '../../shared/constants.js'

export const useConnectionSettingsStore = defineStore('connectionSettings', () => {
  // --- state ---
  const jiraType = ref('cloud')
  const jiraUrl = ref('')
  const email = ref('')
  const apiToken = ref('')
  const loading = ref(false)
  const error = ref(null)
  const testResult = ref(null)

  // --- actions ---

  async function load() {
    loading.value = true
    error.value = null

    try {
      const result = await browser.storage.local.get(STORAGE_KEY_JIRA_CONFIG)
      const config = result[STORAGE_KEY_JIRA_CONFIG]
      if (!config) return

      jiraType.value = config.type ?? 'cloud'
      jiraUrl.value = config.url ?? ''

      if (config.type === 'cloud') {
        email.value = config.credentials?.email ?? ''
        apiToken.value = config.credentials?.apiToken ?? ''
      } else {
        email.value = ''
        apiToken.value = config.credentials?.pat ?? ''
      }
    } catch (err) {
      error.value = err.message ?? String(err)
    } finally {
      loading.value = false
    }
  }

  async function save() {
    loading.value = true
    error.value = null

    try {
      const config = {
        url: jiraUrl.value,
        type: jiraType.value,
        credentials: jiraType.value === 'cloud'
          ? { email: email.value, apiToken: apiToken.value }
          : { pat: apiToken.value },
      }

      await browser.storage.local.set({ [STORAGE_KEY_JIRA_CONFIG]: config })
    } catch (err) {
      error.value = err.message ?? String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function testConnection() {
    loading.value = true
    error.value = null
    testResult.value = null

    try {
      const response = await sendMessage(JIRA_GET_PROJECTS)

      if (response.error) {
        testResult.value = 'failure'
        error.value = response.error
      } else {
        testResult.value = 'success'
      }
    } catch (err) {
      testResult.value = 'failure'
      error.value = err.message ?? String(err)
    } finally {
      loading.value = false
    }
  }

  return {
    jiraType,
    jiraUrl,
    email,
    apiToken,
    loading,
    error,
    testResult,
    load,
    save,
    testConnection,
  }
})
