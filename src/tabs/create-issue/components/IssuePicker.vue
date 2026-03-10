<script setup>
import { ref, watch } from 'vue'
import { useI18n } from '../../../shared/composables/useI18n.js'
import { sendMessage, JIRA_SEARCH_ISSUES } from '../../../shared/messaging.js'
import { useCreateIssueStore } from '../stores/create-issue.store.js'
import { useJiraMetaStore } from '../stores/jira-meta.store.js'

const { t } = useI18n()
const createIssue = useCreateIssueStore()
const jiraMeta = useJiraMetaStore()

const props = defineProps({
  fieldId: { type: String, required: true },
  modelValue: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue'])

const searchQuery = ref(props.modelValue ? props.modelValue.key + ' — ' + props.modelValue.summary : '')
const isOpen = ref(false)
const results = ref([])
const loading = ref(false)
let debounceTimer = null

watch(
  () => props.modelValue,
  (val) => {
    if (!isOpen.value) {
      searchQuery.value = val ? val.key + ' — ' + val.summary : ''
    }
  }
)

async function search(query) {
  const projectKey = createIssue.selectedProject?.key
  if (!projectKey || query.length < 2) {
    results.value = []
    return
  }

  loading.value = true
  try {
    const escapedQuery = query.replace(/"/g, '\\"')
    let typeFilter = ''
    if (props.fieldId === 'parent') {
      const currentLevel = createIssue.selectedIssueType?.hierarchyLevel ?? 0
      const parentTypeNames = jiraMeta.issueTypes
        .filter((t) => t.hierarchyLevel > currentLevel)
        .map((t) => '"' + t.name + '"')
      typeFilter = parentTypeNames.length > 0
        ? ' AND issueType in (' + parentTypeNames.join(', ') + ')'
        : ' AND issueType not in subTaskIssueTypes()'
    }
    const jql = 'project = "' + projectKey + '"' + typeFilter + ' AND summary ~ "' + escapedQuery + '*" ORDER BY updated DESC'
    const response = await sendMessage(JIRA_SEARCH_ISSUES, {
      jql,
      fields: ['summary'],
      maxResults: 10,
    })
    if (response.error) {
      results.value = []
      return
    }
    results.value = (response.data?.issues ?? []).map((issue) => ({
      key: issue.key,
      summary: issue.fields?.summary ?? '',
    }))
  } catch {
    results.value = []
  } finally {
    loading.value = false
  }
}

function onInput(event) {
  const query = event.target.value
  searchQuery.value = query
  clearTimeout(debounceTimer)

  if (query.length < 2) {
    results.value = []
    return
  }

  debounceTimer = setTimeout(() => search(query), 300)
}

function selectIssue(issue) {
  emit('update:modelValue', { key: issue.key, summary: issue.summary })
  searchQuery.value = issue.key + ' — ' + issue.summary
  isOpen.value = false
  results.value = []
}

function clearSelection() {
  emit('update:modelValue', null)
  searchQuery.value = ''
  results.value = []
}

function onFocus() {
  isOpen.value = true
  searchQuery.value = ''
}

function onBlur() {
  setTimeout(() => {
    isOpen.value = false
    if (props.modelValue) {
      searchQuery.value = props.modelValue.key + ' — ' + props.modelValue.summary
    } else {
      searchQuery.value = ''
    }
  }, 200)
}
</script>

<template>
  <div class="issue-picker">
    <div class="picker-wrapper">
      <input
        type="text"
        class="field-input"
        :placeholder="t('placeholderSearchIssue')"
        :value="searchQuery"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
      />
      <div v-if="loading" class="spinner" />
      <button
        v-if="props.modelValue && !loading"
        class="clear-btn"
        type="button"
        @mousedown.prevent="clearSelection"
      >
        &times;
      </button>

      <ul v-if="isOpen && results.length > 0" class="dropdown-list">
        <li
          v-for="issue in results"
          :key="issue.key"
          class="dropdown-item"
          :class="{ selected: props.modelValue?.key === issue.key }"
          @mousedown.prevent="selectIssue(issue)"
        >
          <span class="issue-key">{{ issue.key }}</span>
          <span class="issue-summary">{{ issue.summary }}</span>
        </li>
      </ul>

      <div
        v-if="isOpen && !loading && searchQuery.length >= 2 && results.length === 0"
        class="dropdown-list no-results"
      >
        {{ t('labelNoIssuesFound') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.issue-picker {
  width: 100%;
}

.picker-wrapper {
  position: relative;
}

.field-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  padding-right: calc(var(--space-3) + 24px);
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

.clear-btn {
  position: absolute;
  right: var(--space-2);
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: none;
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0 var(--space-1);
  line-height: 1;
}

.clear-btn:hover {
  color: var(--color-text);
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

.dropdown-list.no-results {
  padding: var(--space-2) var(--space-3);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
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

.issue-key {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  flex-shrink: 0;
}

.issue-summary {
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
