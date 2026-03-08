<script setup>
import { useI18n } from '../../../shared/composables/useI18n.js'
import { useCreateIssueStore } from '../stores/create-issue.store.js'

const { t } = useI18n()
const createIssue = useCreateIssueStore()
</script>

<template>
  <div class="submit-bar">
    <div v-if="createIssue.submitError" class="error-banner">
      {{ t('errorCreateIssue') }}: {{ createIssue.submitError }}
    </div>
    <button
      class="submit-btn"
      :disabled="!createIssue.isReadyToSubmit || createIssue.submitting"
      @click="createIssue.submitIssue()"
    >
      <span v-if="createIssue.submitting" class="spinner" />
      {{ t('btnCreateIssue') }}
    </button>
  </div>
</template>

<style scoped>
.submit-bar {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: var(--border-width) solid var(--color-border);
}

.error-banner {
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-3);
  background: var(--jira-red-bg);
  color: var(--color-danger);
  border-radius: var(--border-radius-md);
  font-size: var(--font-size-sm);
}

.submit-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-5);
  border: none;
  border-radius: var(--border-radius-md);
  background: var(--color-btn-primary-bg);
  color: var(--color-btn-primary-text);
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.submit-btn:hover:not(:disabled) {
  background: var(--color-btn-primary-bg-hover);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: var(--color-btn-primary-text);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
