<script setup>
import { useI18n } from '../../../shared/composables/useI18n.js'
import { useJiraMetaStore } from '../stores/jira-meta.store.js'
import { useCreateIssueStore } from '../stores/create-issue.store.js'

const { t } = useI18n()
const jiraMeta = useJiraMetaStore()
const createIssue = useCreateIssueStore()

function onChange(event) {
  const id = event.target.value
  if (!id) {
    createIssue.selectedIssueType = null
    return
  }
  const issueType = jiraMeta.issueTypes.find((it) => it.id === id)
  createIssue.selectedIssueType = issueType ?? null
  if (issueType && createIssue.selectedProject) {
    jiraMeta.loadFields(createIssue.selectedProject.key, issueType.id)
  }
}
</script>

<template>
  <div class="field-group">
    <label class="field-label">{{ t('labelIssueType') }}</label>
    <div class="selector-wrapper">
      <select
        class="field-select"
        :disabled="!createIssue.selectedProject || jiraMeta.loadingIssueTypes"
        :value="createIssue.selectedIssueType?.id ?? ''"
        @change="onChange"
      >
        <option value="">—</option>
        <option
          v-for="it in jiraMeta.issueTypes"
          :key="it.id"
          :value="it.id"
        >
          {{ it.name }}
        </option>
      </select>
      <div v-if="jiraMeta.loadingIssueTypes" class="spinner" />
    </div>
  </div>
</template>

<style scoped>
.field-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.selector-wrapper {
  position: relative;
}

.field-select {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  color: var(--color-text);
  background: var(--color-bg);
  transition: border-color var(--transition-fast);
  appearance: auto;
}

.field-select:focus {
  border-color: var(--color-border-focus);
  outline: none;
}

.field-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  position: absolute;
  right: var(--space-7);
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-btn-primary-bg);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: translateY(-50%) rotate(360deg); }
}
</style>
