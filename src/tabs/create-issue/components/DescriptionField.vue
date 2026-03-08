<script setup>
import { onMounted } from 'vue'
import { useI18n } from '../../../shared/composables/useI18n.js'
import { useEmailContextStore } from '../stores/email-context.store.js'
import { useCreateIssueStore } from '../stores/create-issue.store.js'

const { t } = useI18n()
const emailCtx = useEmailContextStore()
const createIssue = useCreateIssueStore()

onMounted(() => {
  if (!createIssue.descriptionPlain && emailCtx.bodyText) {
    createIssue.descriptionPlain = emailCtx.bodyText
  }
})
</script>

<template>
  <div class="field-group">
    <label class="field-label">{{ t('labelDescription') }}</label>

    <div class="mode-toggle">
      <label class="radio-label">
        <input
          type="radio"
          value="plain"
          v-model="createIssue.descriptionMode"
        />
        {{ t('labelDescriptionModePlain') }}
      </label>
      <label class="radio-label">
        <input
          type="radio"
          value="html"
          v-model="createIssue.descriptionMode"
        />
        {{ t('labelDescriptionModeHtml') }}
      </label>
    </div>

    <textarea
      v-if="createIssue.descriptionMode === 'plain'"
      class="field-textarea"
      v-model="createIssue.descriptionPlain"
      rows="10"
    ></textarea>

    <div v-else class="html-preview">
      <div class="html-content" v-html="createIssue.descriptionHtml"></div>
      <p class="html-note">{{ t('emailHtmlNote') }}</p>
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

.mode-toggle {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-1);
}

.radio-label {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  cursor: pointer;
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

.html-preview {
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: var(--space-3);
  background: var(--color-bg-subtle);
  max-height: 300px;
  overflow-y: auto;
}

.html-content {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  word-break: break-word;
}

.html-note {
  margin-top: var(--space-3);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-style: italic;
}
</style>
