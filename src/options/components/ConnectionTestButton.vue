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
      :disabled="!store.canTest"
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
