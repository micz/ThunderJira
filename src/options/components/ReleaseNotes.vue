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
import _changelog from '../../../CHANGELOG.md?raw'

const changelog = _changelog.split('\n').slice(1).join('\n')

const i18n = browser.i18n.getMessage.bind(browser.i18n)

const emit = defineEmits(['back'])
</script>

<template>
  <div class="release-notes-page">
    <a class="back-btn" href="#" @click.prevent="emit('back')">← {{ i18n('releaseNotesBack') }}</a>
    <div class="release-notes-header">
      <h1 class="release-notes-title">{{ i18n('releaseNotesTitle') }}</h1>
    </div>
    <div class="release-notes-content" v-html="changelog"></div>
  </div>
</template>

<style scoped>
.release-notes-page {
  padding: var(--space-2) 0;
}

.release-notes-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.back-btn {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-decoration: underline;
  transition: color var(--transition-fast);
  white-space: nowrap;
}

.back-btn:hover {
  color: var(--color-text);
}

.release-notes-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  margin: 0;
}

.release-notes-content :deep(h2) {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  margin-top: var(--space-6);
  margin-bottom: var(--space-2);
  color: var(--color-text);
}

.release-notes-content :deep(ul) {
  margin: 0;
  padding-left: var(--space-6);
}

.release-notes-content :deep(li) {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-1);
}

.release-notes-content :deep(img) {
  display: none;
}
</style>
