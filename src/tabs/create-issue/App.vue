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
import { ref, onMounted, watch, nextTick } from 'vue'
import { useI18n } from '../../shared/composables/useI18n.js'
import { useEmailContextStore } from './stores/email-context.store.js'
import { useJiraMetaStore } from './stores/jira-meta.store.js'
import { useCreateIssueStore } from './stores/create-issue.store.js'
import EmailPreview from './components/EmailPreview.vue'
import ProjectSelector from './components/ProjectSelector.vue'
import IssueTypeSelector from './components/IssueTypeSelector.vue'
import SummaryField from './components/SummaryField.vue'
import DescriptionField from './components/DescriptionField.vue'
import DynamicFields from './components/DynamicFields.vue'
import SubmitBar from './components/SubmitBar.vue'
import SuccessBanner from './components/SuccessBanner.vue'
import IssueSummary from './components/IssueSummary.vue'

const { t } = useI18n()
const emailCtx = useEmailContextStore()
const jiraMeta = useJiraMetaStore()
const createIssue = useCreateIssueStore()
const pageTop = ref(null)

onMounted(async () => {
  await emailCtx.load()
  createIssue.setSummaryFromEmail(emailCtx)
  createIssue.setDescriptionFromEmail(emailCtx)
  jiraMeta.loadProjects()
})

watch(() => createIssue.createdIssue, (val) => {
  if (val) {
    nextTick(() => pageTop.value?.scrollIntoView({ behavior: 'smooth' }))
  }
})
</script>

<template>
  <div ref="pageTop" class="create-issue-page">
    <h1 class="page-title">{{ t('createIssueTitle') }}</h1>

    <SuccessBanner v-if="createIssue.createdIssue" />

    <IssueSummary v-if="createIssue.createdIssue" />

    <div v-else class="layout">
      <aside class="preview-col">
        <EmailPreview />
      </aside>

      <main class="form-col">
        <ProjectSelector />
        <IssueTypeSelector />
        <SummaryField />
        <DescriptionField />
        <DynamicFields />
        <SubmitBar />
      </main>
    </div>
  </div>
</template>

<style scoped>
.create-issue-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}

.page-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-6);
}

.layout {
  display: flex;
  gap: var(--space-6);
  align-items: flex-start;
}

.preview-col {
  width: 40%;
  flex-shrink: 0;
}

.form-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

@media (max-width: 900px) {
  .layout {
    flex-direction: column;
  }
  .preview-col {
    width: 100%;
    position: static;
  }
}
</style>
