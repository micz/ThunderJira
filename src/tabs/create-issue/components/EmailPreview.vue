<script setup>
import { ref } from 'vue'
import { useI18n } from '../../../shared/composables/useI18n.js'
import { useEmailContextStore } from '../stores/email-context.store.js'

const { t } = useI18n()
const emailCtx = useEmailContextStore()
const showHtml = ref(false)
</script>

<template>
  <div class="email-preview">
    <div class="meta-row">
      <span class="meta-label">{{ t('emailFrom') }}:</span>
      <span class="meta-value">{{ emailCtx.sender }}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">{{ t('emailDate') }}:</span>
      <span class="meta-value">{{ emailCtx.date }}</span>
    </div>
    <div class="subject">
      <span class="meta-label">{{ t('emailSubject') }}:</span>
      <span class="subject-text">{{ emailCtx.subject }}</span>
    </div>

    <div class="body-toggle">
      <button
        class="toggle-btn"
        :class="{ active: !showHtml }"
        @click="showHtml = false"
      >
        {{ t('emailShowText') }}
      </button>
      <button
        class="toggle-btn"
        :class="{ active: showHtml }"
        @click="showHtml = true"
      >
        {{ t('emailShowHtml') }}
      </button>
    </div>

    <div class="body-content">
      <pre v-if="!showHtml" class="body-text">{{ emailCtx.bodyText }}</pre>
      <div v-else class="body-html" v-html="emailCtx.bodyHtml"></div>
    </div>
  </div>
</template>

<style scoped>
.email-preview {
  background: var(--color-bg-subtle);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: var(--space-4);
  font-size: var(--font-size-sm);
  overflow-y: auto;
  max-height: 70vh;
}

.meta-row {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.meta-label {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.meta-value {
  color: var(--color-text);
}

.subject {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
  margin-bottom: var(--space-4);
}

.subject-text {
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
}

.body-toggle {
  display: flex;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
}

.toggle-btn {
  padding: var(--space-1) var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-sm);
  background: var(--color-bg);
  color: var(--color-text-muted);
  font-family: var(--font-family-base);
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.toggle-btn:hover {
  background: var(--color-bg-subtle);
}

.toggle-btn.active {
  background: var(--color-btn-primary-bg);
  color: var(--color-btn-primary-text);
  border-color: var(--color-btn-primary-bg);
}

.body-content {
  border-top: var(--border-width) solid var(--color-border);
  padding-top: var(--space-3);
}

.body-text {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
  margin: 0;
}

.body-html {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  word-break: break-word;
}
</style>
