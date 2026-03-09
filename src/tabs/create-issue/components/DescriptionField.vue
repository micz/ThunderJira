<script setup>
import { useI18n } from '../../../shared/composables/useI18n.js'
import { useCreateIssueStore } from '../stores/create-issue.store.js'

const { t } = useI18n()
const createIssue = useCreateIssueStore()
</script>

<template>
  <div class="field-group">
    <label class="field-label">{{ t('labelDescription') }}</label>

    <textarea
      class="field-textarea"
      v-model="createIssue.description"
      rows="10"
    ></textarea>
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

.field-textarea {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  background: var(--color-bg);
  resize: vertical;
  line-height: var(--line-height-normal);
  transition: border-color var(--transition-fast);
}

.field-textarea:focus {
  border-color: var(--color-border-focus);
  outline: none;
}
</style>
