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
        placeholder="https//:mycompany.atlassian.net"
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
      <div class="input-wrapper">
        <input
          id="api-token"
          v-model="store.apiToken"
          :type="showToken ? 'text' : 'password'"
          :placeholder="i18n('placeholderApiToken')"
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
