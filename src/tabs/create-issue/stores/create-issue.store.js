import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { sendMessage } from '../../../shared/messaging.js'
import { JIRA_CREATE_ISSUE } from '../../../shared/messaging.js'
import { useJiraMetaStore } from './jira-meta.store.js'
import { getDebugMode } from '../../../shared/storage.js'
import { tjLogger } from '../../../shared/mztj-logger.js'

const logger = new tjLogger('CreateIssueStore', false)
getDebugMode().then(enabled => logger.changeDebug(enabled))

export const useCreateIssueStore = defineStore('createIssue', () => {
  const selectedProject = ref(null)
  const selectedIssueType = ref(null)
  const summary = ref('')
  const descriptionMode = ref('plain')
  const descriptionPlain = ref('')
  const descriptionHtml = ref('')
  const dynamicFieldValues = ref({})
  const submitting = ref(false)
  const submitError = ref(null)
  const createdIssue = ref(null)
  const submittedData = ref(null)

  const isReadyToSubmit = computed(() => {
    if (!summary.value.trim()) return false
    if (!selectedProject.value) return false
    if (!selectedIssueType.value) return false

    const jiraMeta = useJiraMetaStore()
    for (const field of jiraMeta.requiredFields) {
      // Skip summary/project/issuetype — handled above
      if (field.id === 'summary' || field.id === 'project' || field.id === 'issuetype') continue
      const val = dynamicFieldValues.value[field.id]
      if (val === undefined || val === null || val === '') return false
    }
    return true
  })

  function setSummaryFromEmail(emailContext) {
    if (!summary.value && emailContext.subject) {
      summary.value = emailContext.subject
      logger.log('Summary pre-filled from email subject: "' + summary.value + '"')
    }
  }

  function setDescriptionFromEmail(emailContext) {
    descriptionPlain.value = emailContext.bodyText ?? ''
    descriptionHtml.value = emailContext.bodyHtml ?? ''
    logger.log('Description pre-filled from email body')
  }

  async function submitIssue() {
    submitting.value = true
    submitError.value = null
    logger.log('Submitting issue: project=' + selectedProject.value?.key + ', type=' + selectedIssueType.value?.name + ', summary="' + summary.value + '"')
    try {
      const fields = {
        project: { key: selectedProject.value.key },
        issuetype: { id: selectedIssueType.value.id },
        summary: summary.value,
        description: descriptionMode.value === 'html'
          ? descriptionHtml.value
          : descriptionPlain.value,
        ...dynamicFieldValues.value,
      }

      const response = await sendMessage(JIRA_CREATE_ISSUE, { fields })
      if (response.error) {
        submitError.value = response.error
        logger.warn('submitIssue failed: ' + response.error)
        return
      }

      // Snapshot submitted values for the summary view
      submittedData.value = {
        projectKey: selectedProject.value.key,
        projectName: selectedProject.value.name,
        issueTypeName: selectedIssueType.value.name,
        summary: summary.value,
        description: descriptionMode.value === 'html'
          ? descriptionHtml.value
          : descriptionPlain.value,
        descriptionMode: descriptionMode.value,
      }

      // Derive browse URL from the self link returned by Jira
      const data = response.data
      const baseUrl = data.self.split('/rest/')[0]
      createdIssue.value = {
        key: data.key,
        id: data.id,
        url: baseUrl + '/browse/' + data.key,
      }
      logger.log('Issue created successfully: ' + createdIssue.value.key + ' - ' + createdIssue.value.url)
    } catch (err) {
      submitError.value = err.message ?? String(err)
      logger.warn('submitIssue error: ' + submitError.value)
    } finally {
      submitting.value = false
    }
  }

  function reset() {
    summary.value = ''
    descriptionMode.value = 'plain'
    descriptionPlain.value = ''
    descriptionHtml.value = ''
    dynamicFieldValues.value = {}
    submitting.value = false
    submitError.value = null
    createdIssue.value = null
    submittedData.value = null
    logger.log('Store reset')
  }

  return {
    selectedProject,
    selectedIssueType,
    summary,
    descriptionMode,
    descriptionPlain,
    descriptionHtml,
    dynamicFieldValues,
    submitting,
    submitError,
    createdIssue,
    submittedData,
    isReadyToSubmit,
    setSummaryFromEmail,
    setDescriptionFromEmail,
    submitIssue,
    reset,
  }
})
