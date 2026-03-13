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
import { ref, computed, watch } from 'vue'
import { useI18n } from '../../../shared/composables/useI18n.js'
import { useJiraMetaStore } from '../stores/jira-meta.store.js'
import { useCreateIssueStore } from '../stores/create-issue.store.js'

const { t } = useI18n()
const jiraMeta = useJiraMetaStore()
const createIssue = useCreateIssueStore()

const isInvalid = computed(() => !createIssue.selectedProject)

const searchQuery = ref(
  createIssue.selectedProject
    ? `${createIssue.selectedProject.key} — ${createIssue.selectedProject.name}`
    : ''
)
const isOpen = ref(false)

const filteredProjects = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return jiraMeta.projects
  return jiraMeta.projects.filter(
    (p) => p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)
  )
})

function selectProject(project) {
  createIssue.selectedProject = project
  createIssue.selectedIssueType = null
  searchQuery.value = `${project.key} — ${project.name}`
  isOpen.value = false
  jiraMeta.loadIssueTypes(project.key)
}

watch(
  () => jiraMeta.projects,
  (projects) => {
    if (projects.length === 1 && !createIssue.selectedProject) {
      selectProject(projects[0])
    }
  }
)

function onFocus() {
  isOpen.value = true
  searchQuery.value = ''
}

function onBlur() {
  // Delay to allow click on list items
  setTimeout(() => {
    isOpen.value = false
    if (createIssue.selectedProject) {
      searchQuery.value = `${createIssue.selectedProject.key} — ${createIssue.selectedProject.name}`
    }
  }, 200)
}
</script>

<template>
  <div class="field-group">
    <label class="field-label">{{ t('labelProject') }}</label>
    <div class="selector-wrapper">
      <input
        type="text"
        class="field-input"
        :class="{ 'field-error-border': isInvalid }"
        :placeholder="t('placeholderSearchProject')"
        v-model="searchQuery"
        @focus="onFocus"
        @blur="onBlur"
      />
      <div v-if="jiraMeta.loadingProjects" class="spinner" />
      <ul v-if="isOpen && filteredProjects.length > 0" class="dropdown-list">
        <li
          v-for="project in filteredProjects"
          :key="project.id"
          class="dropdown-item"
          :class="{ selected: createIssue.selectedProject?.id === project.id }"
          @mousedown.prevent="selectProject(project)"
        >
          <span class="project-key">{{ project.key }}</span>
          <span class="project-name">{{ project.name }}</span>
        </li>
      </ul>
    </div>
    <div v-if="jiraMeta.error" class="field-error">{{ jiraMeta.error }}</div>
  </div>
</template>

<style scoped>
.field-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.selector-wrapper {
  position: relative;
}

.field-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  color: var(--color-text);
  background: var(--color-bg);
  transition: border-color var(--transition-fast);
}

.field-input:focus {
  border-color: var(--color-border-focus);
  outline: none;
}

.spinner {
  position: absolute;
  right: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-btn-primary-bg);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: translateY(-50%) rotate(360deg); }
}

.dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 240px;
  overflow-y: auto;
  background: var(--color-bg);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-md);
  list-style: none;
  margin-top: var(--space-1);
  z-index: var(--z-overlay);
}

.dropdown-item {
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  display: flex;
  gap: var(--space-2);
  transition: background var(--transition-fast);
}

.dropdown-item:hover {
  background: var(--color-bg-subtle);
}

.dropdown-item.selected {
  background: var(--jira-blue-light);
}

.project-key {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  flex-shrink: 0;
}

.project-name {
  color: var(--color-text-muted);
}

.field-error-border {
  border-color: var(--color-danger);
}

.field-error {
  font-size: var(--font-size-sm);
  color: var(--color-danger);
}
</style>
