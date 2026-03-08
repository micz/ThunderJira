<script setup>
import { useConnectionSettingsStore } from '../stores/connection-settings.store.js'

const store = useConnectionSettingsStore()
const i18n = browser.i18n.getMessage.bind(browser.i18n)

async function handleTest() {
  await store.testConnection()
}
</script>

<template>
  <div class="test-wrapper">
    <button
      class="btn btn-secondary"
      :disabled="store.loading"
      @click="handleTest"
    >
      {{ i18n('buttonTestConnection') }}
    </button>
    <span v-if="store.testResult === 'success'" class="test-feedback test-success">
      {{ i18n('testSuccess') }}
    </span>
    <span v-if="store.testResult === 'failure'" class="test-feedback test-failure">
      {{ i18n('testFailure', store.error || '') }}
    </span>
  </div>
</template>

<style scoped>
.test-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.btn {
  padding: var(--space-2) var(--space-4);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-btn-secondary-bg);
  color: var(--color-btn-secondary-text);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-btn-secondary-bg-hover);
}

.test-feedback {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.test-success {
  color: var(--color-success);
}

.test-failure {
  color: var(--color-danger);
}
</style>
