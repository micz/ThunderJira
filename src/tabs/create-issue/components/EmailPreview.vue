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
import { useI18n } from '../../../shared/composables/useI18n.js'
import { useEmailContextStore } from '../stores/email-context.store.js'

const { t } = useI18n()
const emailCtx = useEmailContextStore()
</script>

<template>
  <div class="email-preview">
    <div class="meta-row">
      <span class="meta-label">{{ t('emailFrom') }}:</span>
      <span class="meta-value">{{ emailCtx.sender }}</span>
    </div>
    <div v-if="emailCtx.recipients.length" class="meta-row">
      <span class="meta-label">{{ t('emailTo') }}:</span>
      <span class="meta-value">{{ emailCtx.recipients.join(', ') }}</span>
    </div>
    <div v-if="emailCtx.ccList.length" class="meta-row">
      <span class="meta-label">{{ t('emailCc') }}:</span>
      <span class="meta-value">{{ emailCtx.ccList.join(', ') }}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">{{ t('emailDate') }}:</span>
      <span class="meta-value">{{ emailCtx.date }}</span>
    </div>
    <div class="subject">
      <span class="meta-label">{{ t('emailSubject') }}:</span>
      <span class="subject-text">{{ emailCtx.subject }}</span>
    </div>

    <div class="body-content">
      <div v-if="emailCtx.bodyHtml" class="body-html" v-html="emailCtx.bodyHtml"></div>
      <pre v-else class="body-text">{{ emailCtx.bodyText }}</pre>
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
  word-break: break-word;
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
