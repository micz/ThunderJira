<script setup>
import { ref } from 'vue'
import { useI18n } from '../../../shared/composables/useI18n.js'
import { useJiraMetaStore } from '../stores/jira-meta.store.js'
import { useCreateIssueStore } from '../stores/create-issue.store.js'
import UserPicker from './UserPicker.vue'
import IssuePicker from './IssuePicker.vue'

const { t } = useI18n()
const jiraMeta = useJiraMetaStore()
const createIssue = useCreateIssueStore()

const showOptional = ref(false)

// Fields that are handled by dedicated components, auto-filled by Jira,
// or not settable via the create issue API
const SKIP_FIELDS = new Set([
  'summary', 'project', 'issuetype', 'description', 'reporter', 'issuelinks', 'attachment',
])

// Schema types or system names that are not user-settable or require unsupported APIs
const UNSUPPORTED_SCHEMA_TYPES = new Set(['team'])
const UNSUPPORTED_SYSTEMS = new Set([
  'issuerestriction', 'rankBeforeIssue', 'rankAfterIssue',
])

function getFieldValue(fieldId) {
  return createIssue.dynamicFieldValues[fieldId] ?? ''
}

function setFieldValue(fieldId, value) {
  createIssue.dynamicFieldValues = {
    ...createIssue.dynamicFieldValues,
    [fieldId]: value,
  }
}

function getInputType(field) {
  const type = field.schema?.type
  if (type === 'number') return 'number'
  if (type === 'date') return 'date'
  if (type === 'datetime') return 'datetime-local'
  return 'text'
}

function isSelectField(field) {
  return field.allowedValues?.length > 0
}

function isMultiSelect(field) {
  return field.schema?.type === 'array' && field.allowedValues?.length > 0
}

function isUserField(field) {
  return field.schema?.type === 'user'
}

function isIssueField(field) {
  return field.id === 'parent' || field.schema?.type === 'issuelink'
}

function isSupported(field) {
  if (SKIP_FIELDS.has(field.id)) return false
  if (UNSUPPORTED_SCHEMA_TYPES.has(field.schema?.type)) return false
  if (UNSUPPORTED_SYSTEMS.has(field.schema?.system)) return false
  return true
}

function visibleRequired() {
  return jiraMeta.requiredFields.filter(isSupported)
}

function visibleOptional() {
  return jiraMeta.optionalFields.filter(isSupported)
}
</script>

<template>
  <div class="dynamic-fields">
    <div v-if="jiraMeta.loadingFields" class="spinner-wrapper">
      <div class="spinner" />
    </div>

    <template v-if="!jiraMeta.loadingFields">
      <!-- Required fields -->
      <div
        v-for="field in visibleRequired()"
        :key="field.id"
        class="field-group"
      >
        <label class="field-label">
          {{ field.name }}
          <span class="required-mark">* {{ t('labelRequired') }}</span>
        </label>

        <select
          v-if="isSelectField(field)"
          class="field-select"
          :multiple="isMultiSelect(field)"
          :value="getFieldValue(field.id)"
          @change="isMultiSelect(field)
            ? setFieldValue(field.id, Array.from($event.target.selectedOptions, o => o.value))
            : setFieldValue(field.id, $event.target.value)"
        >
          <option v-if="!isMultiSelect(field)" value="">—</option>
          <option
            v-for="opt in field.allowedValues"
            :key="opt.id ?? opt.value"
            :value="opt.id ?? opt.value"
          >
            {{ opt.name ?? opt.value }}
          </option>
        </select>

        <UserPicker
          v-else-if="isUserField(field)"
          :field-id="field.id"
          :model-value="getFieldValue(field.id)"
          @update:model-value="setFieldValue(field.id, $event)"
        />

        <IssuePicker
          v-else-if="isIssueField(field)"
          :field-id="field.id"
          :model-value="getFieldValue(field.id)"
          @update:model-value="setFieldValue(field.id, $event)"
        />

        <input
          v-else
          :type="getInputType(field)"
          class="field-input"
          :value="getFieldValue(field.id)"
          @input="setFieldValue(field.id, $event.target.value)"
        />
      </div>

      <!-- Optional fields (collapsible) -->
      <div v-if="visibleOptional().length > 0" class="optional-section">
        <button class="optional-toggle" @click="showOptional = !showOptional">
          {{ t('labelAdditionalFields') }}
          <span class="chevron" :class="{ open: showOptional }">&#9662;</span>
        </button>

        <template v-if="showOptional">
          <div
            v-for="field in visibleOptional()"
            :key="field.id"
            class="field-group"
          >
            <label class="field-label">{{ field.name }}</label>

            <select
              v-if="isSelectField(field)"
              class="field-select"
              :multiple="isMultiSelect(field)"
              :value="getFieldValue(field.id)"
              @change="isMultiSelect(field)
                ? setFieldValue(field.id, Array.from($event.target.selectedOptions, o => o.value))
                : setFieldValue(field.id, $event.target.value)"
            >
              <option v-if="!isMultiSelect(field)" value="">—</option>
              <option
                v-for="opt in field.allowedValues"
                :key="opt.id ?? opt.value"
                :value="opt.id ?? opt.value"
              >
                {{ opt.name ?? opt.value }}
              </option>
            </select>

            <UserPicker
              v-else-if="isUserField(field)"
              :field-id="field.id"
              :model-value="getFieldValue(field.id)"
              @update:model-value="setFieldValue(field.id, $event)"
            />

            <IssuePicker
              v-else-if="isIssueField(field)"
              :field-id="field.id"
              :model-value="getFieldValue(field.id)"
              @update:model-value="setFieldValue(field.id, $event)"
            />

            <input
              v-else
              :type="getInputType(field)"
              class="field-input"
              :value="getFieldValue(field.id)"
              @input="setFieldValue(field.id, $event.target.value)"
            />
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dynamic-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.spinner-wrapper {
  display: flex;
  justify-content: center;
  padding: var(--space-4);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-btn-primary-bg);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

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

.required-mark {
  font-size: var(--font-size-xs);
  color: var(--color-danger);
  font-weight: var(--font-weight-normal);
}

.field-input,
.field-select {
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

.field-input:focus,
.field-select:focus {
  border-color: var(--color-border-focus);
  outline: none;
}

.optional-section {
  margin-top: var(--space-2);
}

.optional-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border: none;
  background: none;
  font-family: var(--font-family-base);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  cursor: pointer;
}

.optional-toggle:hover {
  color: var(--color-text);
}

.chevron {
  transition: transform var(--transition-fast);
}

.chevron.open {
  transform: rotate(180deg);
}
</style>
