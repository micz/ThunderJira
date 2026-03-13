<!--
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
-->

<script setup>
import { computed, onMounted } from 'vue'
import { useI18n } from '../../../shared/composables/useI18n.js'
import { useJiraMetaStore } from '../stores/jira-meta.store.js'
import { useCreateIssueStore } from '../stores/create-issue.store.js'

const { t } = useI18n()
const jiraMeta = useJiraMetaStore()
const createIssue = useCreateIssueStore()

const isInvalid = computed(() => !!createIssue.selectedProject && !createIssue.selectedIssueType)

onMounted(() => {
  if (createIssue.selectedProject && jiraMeta.issueTypes.length === 0) {
    jiraMeta.loadIssueTypes(createIssue.selectedProject.key)
  }
  if (createIssue.selectedProject && createIssue.selectedIssueType && jiraMeta.fields.length === 0) {
    jiraMeta.loadFields(createIssue.selectedProject.key, createIssue.selectedIssueType.id)
  }
})

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
        :class="{ 'field-error-border': isInvalid }"
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

.field-error-border {
  border-color: var(--color-danger);
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
