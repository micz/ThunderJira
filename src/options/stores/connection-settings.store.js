import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { sendMessage, JIRA_GET_PROJECTS } from '../../shared/messaging.js'
import { STORAGE_KEY_JIRA_CONFIG } from '../../shared/constants.js'
import { getDebugMode, setDebugMode, getShowOptionalFields, setShowOptionalFields } from '../../shared/storage.js'
import { tjLogger } from '../../shared/mztj-logger.js'

const logger = new tjLogger('Options', false)
getDebugMode().then(enabled => logger.changeDebug(enabled))

export const useConnectionSettingsStore = defineStore('connectionSettings', () => {
  // --- state ---
  const jiraType = ref('cloud')
  const jiraUrl = ref('')
  const email = ref('')
  const apiToken = ref('')
  const debugMode = ref(false)
  const showOptionalFields = ref(false)
  const loading = ref(false)
  const error = ref(null)
  const testResult = ref(null)

  // Snapshot of last saved/loaded values for dirty tracking
  const _saved = ref(null)

  // --- derived ---
  const dirty = computed(() => {
    if (!_saved.value) return true
    return (
      jiraType.value !== _saved.value.jiraType ||
      jiraUrl.value !== _saved.value.jiraUrl ||
      email.value !== _saved.value.email ||
      apiToken.value !== _saved.value.apiToken
    )
  })

  const canTest = computed(() => !loading.value && !dirty.value)

  function _takeSnapshot() {
    _saved.value = {
      jiraType: jiraType.value,
      jiraUrl: jiraUrl.value,
      email: email.value,
      apiToken: apiToken.value,
    }
  }

  // --- actions ---

  async function load() {
    loading.value = true
    error.value = null

    try {
      const result = await browser.storage.local.get(STORAGE_KEY_JIRA_CONFIG)
      const config = result[STORAGE_KEY_JIRA_CONFIG]

      debugMode.value = await getDebugMode()
      showOptionalFields.value = await getShowOptionalFields()
      logger.changeDebug(debugMode.value)
      logger.log('Settings loaded')

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

      _takeSnapshot()
      logger.log(`Jira config loaded: type=${jiraType.value}, url=${jiraUrl.value}`)
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
      _takeSnapshot()
      logger.log(`Settings saved: type=${jiraType.value}, url=${jiraUrl.value}`)
    } catch (err) {
      error.value = err.message ?? String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function saveDebugMode() {
    await setDebugMode(debugMode.value)
    logger.changeDebug(debugMode.value)
    logger.log(`Debug mode set to: ${debugMode.value}`)
  }

  async function saveShowOptionalFields() {
    await setShowOptionalFields(showOptionalFields.value)
    logger.log(`Show optional fields set to: ${showOptionalFields.value}`)
  }

  async function testConnection() {
    loading.value = true
    error.value = null
    testResult.value = null

    logger.log('Testing Jira connection...')
    try {
      const response = await sendMessage(JIRA_GET_PROJECTS)

      if (response.error) {
        testResult.value = 'failure'
        error.value = response.error
        logger.warn(`Connection test failed: ${response.error}`)
      } else {
        testResult.value = 'success'
        logger.log('Connection test succeeded')
      }
    } catch (err) {
      testResult.value = 'failure'
      error.value = err.message ?? String(err)
      logger.warn(`Connection test error: ${err.message}`)
    } finally {
      loading.value = false
    }
  }

  // Clear stale test result when form is modified
  watch(dirty, (isDirty) => {
    if (isDirty) testResult.value = null
  })

  return {
    jiraType,
    jiraUrl,
    email,
    apiToken,
    debugMode,
    showOptionalFields,
    loading,
    error,
    testResult,
    dirty,
    canTest,
    load,
    save,
    saveDebugMode,
    saveShowOptionalFields,
    testConnection,
  }
})
