<script setup>
import { useI18n } from '../../../shared/composables/useI18n.js'
import { useCreateIssueStore } from '../stores/create-issue.store.js'

const { t } = useI18n()
const createIssue = useCreateIssueStore()

function openInJira() {
  browser.windows.openDefaultBrowser(createIssue.createdIssue.url)
}

function createAnother() {
  createIssue.reset()
}
</script>

<template>
  <div class="success-banner">
    <span class="success-text">
      {{ t('successIssueCreated', createIssue.createdIssue.key) }}
    </span>
    <div class="success-actions">
      <a class="link-btn" href="#" @click.prevent="openInJira">
        {{ t('OpenInJira') }} →
      </a>
      <button class="another-btn" @click="createAnother">
        {{ t('btnCreateAnother') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.success-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-4);
  background: var(--jira-green-bg);
  border: var(--border-width) solid var(--jira-green);
  border-radius: var(--border-radius-md);
}

.success-text {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.success-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.link-btn {
  font-size: var(--font-size-sm);
  color: var(--color-text-link);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
}

.link-btn:hover {
  text-decoration: underline;
}

.another-btn {
  padding: var(--space-1) var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  background: var(--color-btn-secondary-bg);
  color: var(--color-btn-secondary-text);
  font-family: var(--font-family-base);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.another-btn:hover {
  background: var(--color-btn-secondary-bg-hover);
}
</style>
