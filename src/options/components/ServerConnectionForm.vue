<script setup>
import { ref } from 'vue'
import { useConnectionSettingsStore } from '../stores/connection-settings.store.js'

const store = useConnectionSettingsStore()
const i18n = browser.i18n.getMessage.bind(browser.i18n)
const showToken = ref(false)
</script>

<template>
  <div class="form-fields">
    <div class="field">
      <label for="jira-url">{{ i18n('labelJiraUrl') }}</label>
      <input
        id="jira-url"
        v-model="store.jiraUrl"
        type="url"
        placeholder="https://jira.mycompany.com"
        :disabled="store.loading"
      />
    </div>
    <div class="field">
      <label for="pat">{{ i18n('labelPat') }}</label>
      <div class="input-wrapper">
        <input
          id="pat"
          v-model="store.apiToken"
          :type="showToken ? 'text' : 'password'"
          :placeholder="i18n('placeholderPat')"
          :disabled="store.loading"
        />
        <button
          type="button"
          class="toggle-btn"
          :disabled="store.loading"
          @click="showToken = !showToken"
        >
          <img src="/icons/pwd-hide.png" alt="" />
        </button>
      </div>
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

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-wrapper input {
  flex: 1;
  padding-right: 36px;
}

.toggle-btn {
  position: absolute;
  right: 0;
  height: 100%;
  width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  opacity: 0.6;
}

.toggle-btn:hover {
  opacity: 1;
}

.toggle-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.toggle-btn img {
  width: 18px;
  height: 18px;
}

@media (prefers-color-scheme: dark) {
  .toggle-btn img {
    filter: invert(1);
  }
}
</style>
