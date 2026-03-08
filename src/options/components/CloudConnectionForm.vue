<script setup>
import { useConnectionSettingsStore } from '../stores/connection-settings.store.js'

const store = useConnectionSettingsStore()
const i18n = browser.i18n.getMessage.bind(browser.i18n)
</script>

<template>
  <div class="form-fields">
    <div class="field">
      <label for="jira-url">{{ i18n('labelJiraUrl') }}</label>
      <input
        id="jira-url"
        v-model="store.jiraUrl"
        type="url"
        :placeholder="i18n('placeholderJiraUrl')"
        :disabled="store.loading"
      />
    </div>
    <div class="field">
      <label for="email">{{ i18n('labelEmail') }}</label>
      <input
        id="email"
        v-model="store.email"
        type="email"
        :placeholder="i18n('placeholderEmail')"
        :disabled="store.loading"
      />
    </div>
    <div class="field">
      <label for="api-token">{{ i18n('labelApiToken') }}</label>
      <input
        id="api-token"
        v-model="store.apiToken"
        type="password"
        :placeholder="i18n('placeholderApiToken')"
        :disabled="store.loading"
      />
    </div>
  </div>
</template>

<style scoped>
.form-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.field input {
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  color: var(--color-text);
  background: var(--color-bg);
  transition: border-color var(--transition-fast);
}

.field input:focus {
  border-color: var(--color-border-focus);
}

.field input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
