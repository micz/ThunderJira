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
import { ref } from 'vue'
import { useConnectionSettingsStore } from '../stores/connection-settings.store.js'
import { requestSitePermission } from '../permissions.js'

const store = useConnectionSettingsStore()
const i18n = browser.i18n.getMessage.bind(browser.i18n)
const saveSuccess = ref(false)

async function handleSave() {
  store.error = null
  saveSuccess.value = false

  // Server connections require a runtime permission grant before saving
  if (store.jiraType === 'server') {
    const granted = await requestSitePermission(store.jiraUrl)
    if (!granted) {
      store.error = i18n('errorPermissionDenied')
      return
    }
  }

  try {
    await store.save()
    saveSuccess.value = true
  } catch {
    // Error is already set in the store
  }
}
</script>

<template>
  <div class="save-wrapper">
    <button
      class="btn btn-primary"
      :disabled="store.loading"
      @click="handleSave"
    >
      {{ i18n('buttonSave') }}
    </button>
    <span v-if="saveSuccess" class="save-feedback">
      {{ i18n('savedSuccessfully') }}
    </span>
  </div>
</template>

<style scoped>
.save-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.btn {
  padding: var(--space-2) var(--space-4);
  border: none;
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

.btn-primary {
  background: var(--color-btn-primary-bg);
  color: var(--color-btn-primary-text);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-btn-primary-bg-hover);
}

.save-feedback {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-success);
}
</style>
