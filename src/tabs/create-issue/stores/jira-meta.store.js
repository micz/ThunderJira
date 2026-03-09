import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { sendMessage } from '../../../shared/messaging.js'
import {
  JIRA_GET_PROJECTS,
  JIRA_GET_ISSUE_TYPES,
  JIRA_GET_FIELDS,
} from '../../../shared/messaging.js'
import { getDebugMode } from '../../../shared/storage.js'
import { tjLogger } from '../../../shared/mztj-logger.js'

const logger = new tjLogger('JiraMetaStore', false)
getDebugMode().then(enabled => logger.changeDebug(enabled))

export const useJiraMetaStore = defineStore('jiraMeta', () => {
  const projects = ref([])
  const issueTypes = ref([])
  const fields = ref([])
  const loadingProjects = ref(false)
  const loadingIssueTypes = ref(false)
  const loadingFields = ref(false)
  const error = ref(null)

  const requiredFields = computed(() => fields.value.filter((f) => f.required))
  const optionalFields = computed(() => fields.value.filter((f) => !f.required))

  async function loadProjects() {
    loadingProjects.value = true
    error.value = null
    logger.log('Loading projects...')
    try {
      const response = await sendMessage(JIRA_GET_PROJECTS)
      if (response.error) {
        error.value = response.error
        logger.warn('loadProjects failed: ' + response.error)
        return
      }
      projects.value = response.data
      logger.log('loadProjects -> ' + projects.value.length + ' projects')
    } catch (err) {
      error.value = err.message ?? String(err)
      logger.warn('loadProjects error: ' + error.value)
    } finally {
      loadingProjects.value = false
    }
  }

  async function loadIssueTypes(projectKey) {
    loadingIssueTypes.value = true
    error.value = null
    issueTypes.value = []
    fields.value = []
    logger.log('Loading issue types for project: ' + projectKey)
    try {
      const response = await sendMessage(JIRA_GET_ISSUE_TYPES, { projectKey })
      if (response.error) {
        error.value = response.error
        logger.warn('loadIssueTypes failed: ' + response.error)
        return
      }
      issueTypes.value = response.data
      logger.log('loadIssueTypes [' + projectKey + '] -> ' + issueTypes.value.length + ' types')
    } catch (err) {
      error.value = err.message ?? String(err)
      logger.warn('loadIssueTypes error: ' + error.value)
    } finally {
      loadingIssueTypes.value = false
    }
  }

  async function loadFields(projectKey, issueTypeId) {
    loadingFields.value = true
    error.value = null
    fields.value = []
    logger.log('Loading fields for project=' + projectKey + ', issueTypeId=' + issueTypeId)
    try {
      const response = await sendMessage(JIRA_GET_FIELDS, { projectKey, issueTypeId })
      if (response.error) {
        error.value = response.error
        logger.warn('loadFields failed: ' + response.error)
        return
      }
      fields.value = response.data
      logger.log('loadFields -> ' + fields.value.length + ' fields')
    } catch (err) {
      error.value = err.message ?? String(err)
      logger.warn('loadFields error: ' + error.value)
    } finally {
      loadingFields.value = false
    }
  }

  return {
    projects,
    issueTypes,
    fields,
    loadingProjects,
    loadingIssueTypes,
    loadingFields,
    error,
    requiredFields,
    optionalFields,
    loadProjects,
    loadIssueTypes,
    loadFields,
  }
})
