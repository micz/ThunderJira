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
import { computed } from 'vue'
import { useI18n } from '../../../shared/composables/useI18n.js'
import { useCreateIssueStore } from '../stores/create-issue.store.js'
import { useJiraMetaStore } from '../stores/jira-meta.store.js'

const { t } = useI18n()
const createIssue = useCreateIssueStore()
const jiraMeta = useJiraMetaStore()

const hasFlaggedField = computed(() =>
  jiraMeta.fields.some(isFlaggedField)
)

function isFlaggedField(field) {
  if (field.schema?.system === 'flagged') return true
  return field.schema?.items === 'option'
    && field.allowedValues?.length === 1
    && field.allowedValues[0].value === 'Impediment'
}

const MAX_LENGTH = 255

const charCountText = computed(() =>
  t('charCount', String(createIssue.summary.length), String(MAX_LENGTH))
)

const isOverLimit = computed(() => createIssue.summary.length > MAX_LENGTH)
const isEmpty = computed(() => !createIssue.summary.trim())
</script>

<template>
  <div class="field-group">
    <label class="field-label">{{ t('labelSummary') }}</label>
    <div class="summary-row">
      <input
        type="text"
        class="field-input"
        :class="{ 'field-error-border': isEmpty || isOverLimit }"
        :placeholder="t('placeholderSummary')"
        v-model="createIssue.summary"
        :maxlength="MAX_LENGTH"
      />
      <button
        v-if="hasFlaggedField"
        type="button"
        class="flag-btn"
        :class="{ active: createIssue.flagged }"
        :title="createIssue.flagged ? t('unflagIssue') : t('flagIssue')"
        @click="createIssue.flagged = !createIssue.flagged"
      >🚩</button>
    </div>
    <div class="field-footer">
      <span v-if="isEmpty" class="field-error">{{ t('errorSummaryRequired') }}</span>
      <span class="char-count" :class="{ 'over-limit': isOverLimit }">
        {{ charCountText }}
      </span>
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

.summary-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.summary-row .field-input {
  flex: 1;
}

.flag-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-1);
  border: none;
  background: none;
  cursor: pointer;
  font-size: var(--font-size-lg);
  opacity: 0.3;
  transition: opacity var(--transition-fast);
  border-radius: var(--border-radius-md);
}

.flag-btn:hover {
  opacity: 0.6;
}

.flag-btn.active {
  opacity: 1;
}

.field-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  color: var(--color-text);
  background: var(--color-bg);
  transition: border-color var(--transition-fast);
}

.field-input:focus {
  border-color: var(--color-border-focus);
  outline: none;
}

.field-error-border {
  border-color: var(--color-danger);
}

.field-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.field-error {
  font-size: var(--font-size-xs);
  color: var(--color-danger);
}

.char-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-left: auto;
}

.char-count.over-limit {
  color: var(--color-danger);
}
</style>
