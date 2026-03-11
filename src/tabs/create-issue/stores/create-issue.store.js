import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { sendMessage } from '../../../shared/messaging.js'
import { JIRA_CREATE_ISSUE } from '../../../shared/messaging.js'
import { useJiraMetaStore } from './jira-meta.store.js'
import { getDebugMode, getJiraConfig } from '../../../shared/storage.js'
import { tjLogger } from '../../../shared/mztj-logger.js'

const logger = new tjLogger('CreateIssueStore', false)
getDebugMode().then(enabled => logger.changeDebug(enabled))

const OBJECT_ID_TYPES = new Set([
  'priority', 'option', 'resolution', 'securitylevel',
])

// Fields that cannot be set via the create issue API
const NON_CREATABLE_FIELDS = new Set([
  'issuelinks', 'issuerestriction', 'rankBeforeIssue', 'rankAfterIssue', 'attachment',
])

function formatDynamicFields(rawValues, fieldsMeta, jiraType) {
  const formatted = {}
  for (const [fieldId, rawValue] of Object.entries(rawValues)) {
    if (rawValue === '' || rawValue === null || rawValue === undefined) continue
    if (NON_CREATABLE_FIELDS.has(fieldId)) continue

    const meta = fieldsMeta.find((f) => f.fieldId === fieldId || f.id === fieldId || f.key === fieldId)
    
    if (!meta) {
      formatted[fieldId] = rawValue
      continue
    }

    const schemaType = meta.schema?.type

    if (OBJECT_ID_TYPES.has(schemaType)) {
      formatted[fieldId] = { id: rawValue }
    } else if (schemaType === 'array') {
      if (meta.allowedValues?.length > 0) {
        // Multi-select with allowed values: wrap each id in { id }
        const ids = Array.isArray(rawValue) ? rawValue : [rawValue]
        formatted[fieldId] = ids.filter((v) => v !== '').map((v) => ({ id: v }))
      } else {
        // Free-text array (e.g. labels): split comma-separated string or use array as-is
        const items = typeof rawValue === 'string'
          ? rawValue.split(',').map((s) => s.trim()).filter(Boolean)
          : Array.from(rawValue)
        formatted[fieldId] = items
      }
    } else if (schemaType === 'user') {
      const userId = rawValue?.id ?? rawValue
      formatted[fieldId] = jiraType === 'cloud'
        ? { accountId: userId }
        : { name: userId }
    } else if (schemaType === 'issuelink' || fieldId === 'parent') {
      formatted[fieldId] = { key: rawValue?.key ?? rawValue }
    } else if (schemaType === 'number') {
      formatted[fieldId] = Number(rawValue)
    } else {
      formatted[fieldId] = rawValue
    }
  }
  return formatted
}

export const useCreateIssueStore = defineStore('createIssue', () => {
  const jiraMeta = useJiraMetaStore()
  const selectedProject = ref(null)
  const selectedIssueType = ref(null)
  const summary = ref('')
  const description = ref('')
  const dynamicFieldValues = ref({})
  const flagged = ref(false)
  const submitting = ref(false)
  const submitError = ref(null)
  const createdIssue = ref(null)
  const submittedData = ref(null)

  const isReadyToSubmit = computed(() => {
    if (!summary.value.trim()) return false
    if (!selectedProject.value) return false
    if (!selectedIssueType.value) return false

    for (const field of jiraMeta.requiredFields) {
      const fieldId = field.fieldId ?? field.id ?? field.key
      // Skip summary/project/issuetype/description/reporter — handled above or explicitly
      if (fieldId === 'summary' || fieldId === 'project' || fieldId === 'issuetype' || fieldId === 'description' || fieldId === 'reporter') continue
      const val = dynamicFieldValues.value[fieldId]
      if (val === undefined || val === null || val === '') return false
      // User fields store { id, displayName } — check for id
      if (field.schema?.type === 'user' && typeof val === 'object' && !val.id) return false
      // Issue fields store { key, summary } — check for key
      if ((fieldId === 'parent' || field.schema?.type === 'issuelink') && typeof val === 'object' && !val.key) return false
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
    description.value = emailContext.bodyDescription ?? emailContext.bodyText ?? ''
    logger.log('Description pre-filled from email body')
  }

  async function submitIssue() {
    submitting.value = true
    submitError.value = null
    logger.log('Submitting issue: project=' + selectedProject.value?.key + ', type=' + selectedIssueType.value?.name + ', summary="' + summary.value + '"')
    try {
      const jiraConfig = await getJiraConfig()
      const jiraType = jiraConfig?.type ?? 'cloud'
      const formattedDynamic = formatDynamicFields(dynamicFieldValues.value, jiraMeta.fields, jiraType)

      if (flagged.value) {
        const flaggedMeta = jiraMeta.fields.find((f) =>
          f.schema?.system === 'flagged' ||
          (f.schema?.items === 'option' && f.allowedValues?.length === 1 && f.allowedValues[0].value === 'Impediment')
        )
        if (flaggedMeta) {
          const optId = flaggedMeta.allowedValues?.[0]?.id
          if (optId) formattedDynamic[flaggedMeta.id] = [{ id: optId }]
        }
      }

      const fields = {
        project: { key: selectedProject.value.key },
        issuetype: { id: selectedIssueType.value.id },
        summary: summary.value,
        description: description.value,
        ...formattedDynamic,
      }

      const response = await sendMessage(JIRA_CREATE_ISSUE, { fields })
      if (response.error) {
        submitError.value = response.error
        logger.warn('submitIssue failed: ' + response.error)
        return
      }

      // Snapshot submitted values for the summary view
      const dynamicFields = []
      for (const [fieldId, rawValue] of Object.entries(dynamicFieldValues.value)) {
        if (rawValue === '' || rawValue === null || rawValue === undefined) continue
        const meta = jiraMeta.fields.find((f) => f.fieldId === fieldId || f.id === fieldId || f.key === fieldId)
        if (!meta) continue

        let displayValue
        if (meta.allowedValues?.length > 0) {
          if (Array.isArray(rawValue)) {
            displayValue = rawValue
              .map((v) => meta.allowedValues.find((o) => String(o.id ?? o.value) === String(v)))
              .filter(Boolean)
              .map((o) => o.name ?? o.value)
              .join(', ')
          } else {
            const opt = meta.allowedValues.find((o) => String(o.id ?? o.value) === String(rawValue))
            displayValue = opt ? (opt.name ?? opt.value) : rawValue
          }
        } else if (meta.schema?.type === 'user' && typeof rawValue === 'object') {
          displayValue = rawValue.displayName ?? rawValue.id ?? ''
        } else if ((meta.fieldId === 'parent' || meta.id === 'parent' || meta.schema?.type === 'issuelink') && typeof rawValue === 'object') {
          displayValue = rawValue.key + (rawValue.summary ? ' — ' + rawValue.summary : '')
        } else if (meta.schema?.type === 'array' && typeof rawValue === 'string') {
          displayValue = rawValue
        } else {
          displayValue = String(rawValue)
        }

        if (displayValue) {
          dynamicFields.push({ label: meta.name, value: displayValue })
        }
      }

      submittedData.value = {
        projectKey: selectedProject.value.key,
        projectName: selectedProject.value.name,
        issueTypeName: selectedIssueType.value.name,
        summary: summary.value,
        description: description.value,
        dynamicFields,
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
    description.value = ''
    flagged.value = false
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
    description,
    flagged,
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
