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

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { sendMessage } from '../../../shared/messaging.js'
import { JIRA_CREATE_ISSUE } from '../../../shared/messaging.js'
import { useJiraMetaStore } from './jira-meta.store.js'
import { getDebugMode, getJiraConfig, setLastUsedProject } from '../../../shared/storage.js'
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

// Reads a Blob as a base64 data URL string, used to serialize image blobs into
// the JSON runtime message sent to the background script.
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}

export const useCreateIssueStore = defineStore('createIssue', () => {
  const jiraMeta = useJiraMetaStore()
  const selectedProject = ref(null)
  const selectedIssueType = ref(null)
  const summary = ref('')
  // The description is modeled as an ordered list of blocks so that pasted/
  // dropped images keep their position relative to the text. Each block is
  // either { type: 'text', text } or { type: 'image', id, filename }. The
  // binary data for image blocks lives in `images`, keyed by id.
  const descriptionBlocks = ref([])
  const images = ref({})
  let imageCounter = 0
  const dynamicFieldValues = ref({})
  const flagged = ref(false)
  const submitting = ref(false)
  const submitError = ref(null)
  const attachmentsWarning = ref(null)
  const createdIssue = ref(null)
  const submittedData = ref(null)

  // Plain-text rendering of the description, used for the success snapshot.
  // Image blocks are rendered as a small placeholder so the summary stays
  // readable without re-embedding the images.
  const descriptionText = computed(() => {
    return descriptionBlocks.value
      .map((b) => (b.type === 'image' ? '🖼 ' + b.filename : b.text ?? ''))
      .join('\n')
      .trim()
  })

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
    const text = emailContext.bodyDescription ?? emailContext.bodyText ?? ''
    descriptionBlocks.value = [{ type: 'text', text }]
    logger.log('Description pre-filled from email body')
  }

  // Registers a pasted/dropped image blob and returns the id + generated
  // filename the editor should associate with the inserted <img> element.
  function addImage(blob, ext) {
    imageCounter += 1
    const id = 'img_' + imageCounter
    const filename = 'thunderjira-img-' + imageCounter + '.' + ext
    images.value[id] = { id, filename, blob, mimeType: blob.type }
    logger.log('Image added: ' + filename + ' (' + blob.type + ')')
    return { id, filename }
  }

  // Replaces the block list from the editor and prunes any image blobs that are
  // no longer referenced (e.g. the user deleted an image with Backspace).
  function setDescriptionBlocks(blocks) {
    descriptionBlocks.value = blocks
    const present = new Set(blocks.filter((b) => b.type === 'image').map((b) => b.id))
    for (const id of Object.keys(images.value)) {
      if (!present.has(id)) delete images.value[id]
    }
  }

  async function submitIssue() {
    submitting.value = true
    submitError.value = null
    attachmentsWarning.value = null
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
        ...formattedDynamic,
      }

      // Convert image blobs to base64 data URLs so the runtime message stays
      // plain JSON (no reliance on structured-clone-of-Blob). The background
      // reconstructs a Blob from each data URL for the multipart upload.
      const imagesPayload = await Promise.all(
        Object.values(images.value).map(async (img) => ({
          id: img.id,
          filename: img.filename,
          mimeType: img.mimeType,
          dataUrl: await blobToDataUrl(img.blob),
        }))
      )

      // Strip Vue reactivity Proxies: runtime.sendMessage uses structured clone,
      // which cannot clone reactive Proxy objects ("Proxy object could not be
      // cloned"). Build plain copies of the block list and fields.
      const blocksPayload = descriptionBlocks.value.map((b) =>
        b.type === 'image'
          ? { type: 'image', id: b.id, filename: b.filename }
          : { type: 'text', text: b.text }
      )

      const response = await sendMessage(JIRA_CREATE_ISSUE, {
        fields: { ...fields },
        descriptionBlocks: blocksPayload,
        images: imagesPayload,
      })
      if (response.error) {
        submitError.value = response.error
        logger.warn('submitIssue failed: ' + response.error)
        return
      }
      if (response.attachmentsWarning) {
        attachmentsWarning.value = response.attachmentsWarning
        logger.warn('submitIssue completed with attachment warning: ' + response.attachmentsWarning)
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
        description: descriptionText.value,
        dynamicFields,
        flagged: flagged.value,
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
      // Remember the project so the next issue form can preselect it when the
      // "Use last used project" option is enabled.
      await setLastUsedProject(selectedProject.value.key)
    } catch (err) {
      submitError.value = err.message ?? String(err)
      logger.warn('submitIssue error: ' + submitError.value)
    } finally {
      submitting.value = false
    }
  }

  function reset() {
    summary.value = ''
    descriptionBlocks.value = []
    images.value = {}
    imageCounter = 0
    flagged.value = false
    dynamicFieldValues.value = {}
    submitting.value = false
    submitError.value = null
    attachmentsWarning.value = null
    createdIssue.value = null
    submittedData.value = null
    logger.log('Store reset')
  }

  return {
    selectedProject,
    selectedIssueType,
    summary,
    descriptionBlocks,
    images,
    descriptionText,
    flagged,
    dynamicFieldValues,
    submitting,
    submitError,
    attachmentsWarning,
    createdIssue,
    submittedData,
    isReadyToSubmit,
    setSummaryFromEmail,
    setDescriptionFromEmail,
    setDescriptionBlocks,
    addImage,
    submitIssue,
    reset,
  }
})
