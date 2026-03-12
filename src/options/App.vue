<script setup>
import { onMounted } from 'vue'
import { useConnectionSettingsStore } from './stores/connection-settings.store.js'
import CloudConnectionForm from './components/CloudConnectionForm.vue'
import ServerConnectionForm from './components/ServerConnectionForm.vue'
import ConnectionTestButton from './components/ConnectionTestButton.vue'
import SaveButton from './components/SaveButton.vue'

const store = useConnectionSettingsStore()

const i18n = browser.i18n.getMessage.bind(browser.i18n)

onMounted(() => {
  store.load()
})
</script>

<template>
  <div class="options-page">
    <h1 class="options-title">{{ i18n('optionsTitle') }}</h1>

    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ active: store.jiraType === 'cloud' }"
        @click="store.jiraType = 'cloud'"
      >
        {{ i18n('optionsCloudTab') }}
      </button>
      <button
        class="tab-btn"
        :class="{ active: store.jiraType === 'server' }"
        @click="store.jiraType = 'server'"
      >
        {{ i18n('optionsServerTab') }}
      </button>
    </div>

    <div class="form-container">
      <CloudConnectionForm v-if="store.jiraType === 'cloud'" />
      <ServerConnectionForm v-else />
    </div>

    <div v-if="store.error" class="error-banner">
      {{ store.error }}
    </div>

    <div class="actions">
      <ConnectionTestButton />
      <SaveButton />
    </div>

    <div class="debug-section">
      <h2 class="debug-title">{{ i18n('uiSectionTitle') }}</h2>
      <label class="debug-label">
        <input
          type="checkbox"
          v-model="store.showOptionalFields"
          @change="store.saveShowOptionalFields()"
        />
        {{ i18n('labelShowOptionalFields') }}
      </label>
      <p class="debug-desc">{{ i18n('labelShowOptionalFieldsDesc') }}</p>
      <label class="debug-label">
        <input
          type="checkbox"
          v-model="store.loadRemoteContent"
          @change="store.saveLoadRemoteContent()"
        />
        {{ i18n('labelLoadRemoteContent') }}
      </label>
      <p class="debug-desc">{{ i18n('labelLoadRemoteContentDesc') }}</p>
    </div>

    <div class="debug-section">
      <h2 class="debug-title">{{ i18n('debugSectionTitle') }}</h2>
      <label class="debug-label">
        <input
          type="checkbox"
          v-model="store.debugMode"
          @change="store.saveDebugMode()"
        />
        {{ i18n('labelDebugMode') }}
      </label>
      <p class="debug-desc">{{ i18n('labelDebugModeDesc') }}</p>
    </div>
  </div>
</template>

<style scoped>
.options-page {
  max-width: 560px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

.options-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-6);
}

.tab-bar {
  display: flex;
  gap: var(--space-1);
  margin-bottom: var(--space-6);
  border-bottom: var(--border-width) solid var(--color-border);
}

.tab-btn {
  padding: var(--space-2) var(--space-4);
  border: none;
  background: none;
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}

.tab-btn:hover {
  color: var(--color-text);
}

.tab-btn.active {
  color: var(--color-btn-primary-bg);
  border-bottom-color: var(--color-btn-primary-bg);
}

.form-container {
  margin-bottom: var(--space-4);
}

.error-banner {
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-4);
  background: var(--jira-red-bg);
  color: var(--color-danger);
  border-radius: var(--border-radius-md);
  font-size: var(--font-size-sm);
}

.actions {
  display: flex;
  gap: var(--space-3);
}

.debug-section {
  margin-top: var(--space-8);
  padding-top: var(--space-6);
  border-top: var(--border-width) solid var(--color-border);
}

.debug-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-3);
  color: var(--color-text-muted);
}

.debug-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-base);
  cursor: pointer;
}

.debug-desc {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>
