<script setup>
import { useI18n } from '../../../shared/composables/useI18n.js'
import { useCreateIssueStore } from '../stores/create-issue.store.js'

const { t } = useI18n()
const createIssue = useCreateIssueStore()
</script>

<template>
  <div class="issue-summary">
    <h2 class="summary-heading">{{ createIssue.createdIssue.key }}</h2>

    <dl class="summary-fields">
      <div class="field-row">
        <dt class="field-label">{{ t('labelProject') }}</dt>
        <dd class="field-value">{{ createIssue.submittedData.projectName }} ({{ createIssue.submittedData.projectKey }})</dd>
      </div>

      <div class="field-row">
        <dt class="field-label">{{ t('labelIssueType') }}</dt>
        <dd class="field-value">{{ createIssue.submittedData.issueTypeName }}</dd>
      </div>

      <div class="field-row">
        <dt class="field-label">{{ t('labelSummary') }}</dt>
        <dd class="field-value">{{ createIssue.submittedData.summary }}</dd>
      </div>

      <div class="field-row">
        <dt class="field-label">{{ t('labelDescription') }}</dt>
        <dd class="field-value description-value">{{ createIssue.submittedData.description }}</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.issue-summary {
  background: var(--color-bg-subtle);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.summary-heading {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-5);
  color: var(--color-text);
}

.summary-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin: 0;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.field-value {
  font-size: var(--font-size-base);
  color: var(--color-text);
  margin: 0;
}

.description-value {
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
  line-height: var(--line-height-normal);
}
</style>
