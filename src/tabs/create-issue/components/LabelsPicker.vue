<script setup>
import { ref, computed } from 'vue'
import { useI18n } from '../../../shared/composables/useI18n.js'
import { sendMessage, JIRA_SEARCH_LABELS } from '../../../shared/messaging.js'

const { t } = useI18n()

const props = defineProps({
  fieldId: { type: String, required: true },
  modelValue: { type: Array, default: () => [] },
  invalid: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'blur'])

const searchQuery = ref('')
const isOpen = ref(false)
const suggestions = ref([])
const loading = ref(false)
let debounceTimer = null

// Filtered suggestions: exclude already-selected labels
const filteredSuggestions = computed(() => {
  const selected = new Set(props.modelValue)
  return suggestions.value.filter((l) => !selected.has(l))
})

// Hide "create new" if the typed text exactly matches an existing suggestion (case-insensitive)
const showCreateNew = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return false
  return !suggestions.value.some((l) => l.toLowerCase() === q)
})

// Show dropdown whenever there is text in the input
const showDropdown = computed(() => isOpen.value && searchQuery.value.trim().length > 0)

async function fetchSuggestions(query) {
  loading.value = true
  try {
    const response = await sendMessage(JIRA_SEARCH_LABELS, { query })
    suggestions.value = response.error ? [] : (response.data ?? [])
  } catch {
    suggestions.value = []
  } finally {
    loading.value = false
  }
}

function onInput() {
  const query = searchQuery.value
  clearTimeout(debounceTimer)

  if (query.trim().length < 1) {
    suggestions.value = []
    isOpen.value = false
    return
  }

  isOpen.value = true
  debounceTimer = setTimeout(() => fetchSuggestions(query.trim()), 300)
}

function addLabel(label) {
  const trimmed = label.trim()
  if (!trimmed) return
  const current = props.modelValue ?? []
  if (!current.includes(trimmed)) {
    emit('update:modelValue', [...current, trimmed])
  }
  searchQuery.value = ''
  isOpen.value = false
  suggestions.value = []
}

function removeLabel(label) {
  emit('update:modelValue', (props.modelValue ?? []).filter((l) => l !== label))
}

function onFocus() {
  if (searchQuery.value.trim().length >= 1) {
    isOpen.value = true
  }
}

function onBlur() {
  setTimeout(() => {
    isOpen.value = false
    searchQuery.value = ''
    suggestions.value = []
    emit('blur')
  }, 200)
}
</script>

<template>
  <div class="labels-picker">
    <div v-if="(modelValue ?? []).length > 0" class="chips-row">
      <span
        v-for="label in modelValue"
        :key="label"
        class="chip"
      >
        {{ label }}
        <button type="button" class="chip-remove" @mousedown.prevent="removeLabel(label)">&times;</button>
      </span>
    </div>

    <div class="picker-wrapper">
      <input
        type="text"
        class="field-input"
        :class="{ 'field-error-border': props.invalid && (modelValue ?? []).length === 0 }"
        :placeholder="t('placeholderSearchLabels')"
        v-model="searchQuery"
        @input="onInput"
        @keydown.enter.prevent="addLabel(searchQuery)"
        @keydown.esc="isOpen = false; searchQuery = ''; suggestions = []"
        @focus="onFocus"
        @blur="onBlur"
      />
      <div v-if="loading" class="spinner" />

      <ul v-if="showDropdown" class="dropdown-list">
        <!-- "Create new" row: only when typed text doesn't match an existing suggestion -->
        <li
          v-if="showCreateNew"
          class="dropdown-item create-new"
          @mousedown.prevent="addLabel(searchQuery)"
        >
          <span class="create-label">{{ searchQuery.trim() }}</span>
          <span class="create-hint">{{ t('labelCreateNew') }}</span>
        </li>

        <!-- Divider only when both rows are visible -->
        <li v-if="showCreateNew && filteredSuggestions.length > 0" class="dropdown-divider" />

        <!-- Existing label suggestions -->
        <li
          v-for="label in filteredSuggestions"
          :key="label"
          class="dropdown-item"
          @mousedown.prevent="addLabel(label)"
        >
          {{ label }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.labels-picker {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  background: var(--jira-blue-light);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.chip-remove {
  border: none;
  background: none;
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.chip-remove:hover {
  color: var(--color-text);
}

.picker-wrapper {
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

.field-error-border {
  border-color: var(--color-danger);
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
  padding: 0;
  z-index: var(--z-overlay);
}

.dropdown-item {
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  font-size: var(--font-size-base);
  color: var(--color-text);
  transition: background var(--transition-fast);
}

.dropdown-item:hover {
  background: var(--color-bg-subtle);
}

.dropdown-item.create-new {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: var(--font-weight-medium);
}

.create-label {
  color: var(--color-text);
}

.create-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-weight: var(--font-weight-normal);
}

.dropdown-divider {
  height: 1px;
  background: var(--color-border);
  margin: var(--space-1) 0;
}
</style>
