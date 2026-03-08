import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { sendMessage } from '../../../shared/messaging.js'
import {
  JIRA_GET_PROJECTS,
  JIRA_GET_ISSUE_TYPES,
  JIRA_GET_FIELDS,
} from '../../../shared/messaging.js'

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
    try {
      const response = await sendMessage(JIRA_GET_PROJECTS)
      if (response.error) {
        error.value = response.error
        return
      }
      projects.value = response.data
    } catch (err) {
      error.value = err.message ?? String(err)
    } finally {
      loadingProjects.value = false
    }
  }

  async function loadIssueTypes(projectKey) {
    loadingIssueTypes.value = true
    error.value = null
    issueTypes.value = []
    fields.value = []
    try {
      const response = await sendMessage(JIRA_GET_ISSUE_TYPES, { projectKey })
      if (response.error) {
        error.value = response.error
        return
      }
      issueTypes.value = response.data
    } catch (err) {
      error.value = err.message ?? String(err)
    } finally {
      loadingIssueTypes.value = false
    }
  }

  async function loadFields(projectKey, issueTypeId) {
    loadingFields.value = true
    error.value = null
    fields.value = []
    try {
      const response = await sendMessage(JIRA_GET_FIELDS, { projectKey, issueTypeId })
      if (response.error) {
        error.value = response.error
        return
      }
      fields.value = response.data
    } catch (err) {
      error.value = err.message ?? String(err)
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
