<!--
/*
 *  ThunderJira [https://micz.it/thunderbird-addon-thunderjira/]
 *  Copyright (C) 2026 Mic (m@micz.it)

 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.

 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.

 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
-->

<script setup>
import { ref, onMounted } from 'vue'
import { useConnectionSettingsStore } from './stores/connection-settings.store.js'
import CloudConnectionForm from './components/CloudConnectionForm.vue'
import ServerConnectionForm from './components/ServerConnectionForm.vue'
import ConnectionTestButton from './components/ConnectionTestButton.vue'
import SaveButton from './components/SaveButton.vue'
import ReleaseNotes from './components/ReleaseNotes.vue'

const store = useConnectionSettingsStore()

const i18n = browser.i18n.getMessage.bind(browser.i18n)

const showReleaseNotes = ref(false)

onMounted(() => {
  store.load()
})

// When "Use last used project" is enabled, the default project is irrelevant:
// clear and persist it, and the dropdown stays disabled until the option is
// turned back off (it is left empty on re-enable).
async function onUseLastProjectChange() {
  await store.saveUseLastProject()
  if (store.useLastProject && store.defaultProject) {
    store.defaultProject = ''
    await store.saveDefaultProject()
  }
}
</script>

<template>
  <div class="options-page">
    <ReleaseNotes v-if="showReleaseNotes" @back="showReleaseNotes = false" />

    <template v-else>
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
        <h2 class="debug-title">{{ i18n('defaultProjectSectionTitle') }}</h2>
        <label class="debug-label">
          <input
            type="checkbox"
            v-model="store.useLastProject"
            @change="onUseLastProjectChange"
          />
          {{ i18n('labelUseLastProject') }}
        </label>
        <p class="debug-desc">{{ i18n('labelUseLastProjectDesc') }}</p>
        <label class="debug-label" for="defaultProjectSelect">{{ i18n('labelDefaultProject') }}</label>
        <div class="default-project-row">
          <select
            id="defaultProjectSelect"
            class="default-project-select"
            v-model="store.defaultProject"
            :disabled="store.useLastProject || store.loadingProjects"
            @change="store.saveDefaultProject()"
          >
            <option value="">{{ i18n('defaultProjectNone') }}</option>
            <option
              v-for="project in store.projects"
              :key="project.id"
              :value="project.key"
            >
              {{ project.key }} — {{ project.name }}
            </option>
          </select>
          <button
            type="button"
            class="btn btn-secondary reload-btn"
            :disabled="store.useLastProject || store.loadingProjects"
            @click="store.loadProjects()"
          >
            {{ i18n('buttonReloadProjects') }}
          </button>
        </div>
        <p v-if="store.loadingProjects" class="debug-desc">{{ i18n('defaultProjectLoadHint') }}</p>
        <p v-else-if="store.projects.length === 0" class="debug-desc">{{ i18n('defaultProjectLoadHint') }}</p>
        <p v-if="store.projectsError" class="debug-desc field-error">{{ store.projectsError }}</p>
        <p class="debug-desc">{{ i18n('labelDefaultProjectDesc') }}</p>
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

      <div class="footer-section">
        <a class="release-notes-link" href="#" @click.prevent="showReleaseNotes = true">
          {{ i18n('linkReleaseNotes') }}
        </a>
      </div>

      <div class="debug-section privacy-section">
        <h2 class="debug-title">{{ i18n('privacyNoticeTitle') }}</h2>
        <p class="debug-desc">{{ i18n('privacyNoticeText') }}</p>
      </div>
    </template>
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
  margin-bottom: var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.debug-desc.field-error {
  color: var(--color-danger);
}

.default-project-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-top: var(--space-1);
}

.default-project-select {
  flex: 1;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  color: var(--color-text);
  background: var(--color-bg);
  cursor: pointer;
}

.default-project-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.reload-btn {
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  background: var(--color-btn-secondary-bg);
  color: var(--color-btn-secondary-text);
  font-family: var(--font-family-base);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--transition-fast);
}

.reload-btn:hover:not(:disabled) {
  background: var(--color-btn-secondary-bg-hover);
}

.reload-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.footer-section {
  margin-top: var(--space-8);
  text-align: center;
}

.release-notes-link {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-decoration: underline;
  transition: color var(--transition-fast);
}

.release-notes-link:hover {
  color: var(--color-text);
}
</style>
