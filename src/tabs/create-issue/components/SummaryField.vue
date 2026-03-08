<script setup>
import { ref, onMounted, computed } from 'vue'
import { useI18n } from '../../../shared/composables/useI18n.js'
import { useEmailContextStore } from '../stores/email-context.store.js'
import { useCreateIssueStore } from '../stores/create-issue.store.js'

const { t } = useI18n()
const emailCtx = useEmailContextStore()
const createIssue = useCreateIssueStore()

const MAX_LENGTH = 255
const touched = ref(false)

const charCountText = computed(() =>
  t('charCount', String(createIssue.summary.length), String(MAX_LENGTH))
)

const isOverLimit = computed(() => createIssue.summary.length > MAX_LENGTH)
const isEmpty = computed(() => touched.value && !createIssue.summary.trim())

onMounted(() => {
  if (!createIssue.summary && emailCtx.subject) {
    createIssue.summary = emailCtx.subject
  }
})

function onBlur() {
  touched.value = true
}
</script>

<template>
  <div class="field-group">
    <label class="field-label">{{ t('labelSummary') }}</label>
    <input
      type="text"
      class="field-input"
      :class="{ 'field-error-border': isEmpty || isOverLimit }"
      :placeholder="t('placeholderSummary')"
      v-model="createIssue.summary"
      :maxlength="MAX_LENGTH"
      @blur="onBlur"
    />
    <div class="field-footer">
      <span v-if="isEmpty" class="field-error">{{ t('errorSummaryRequired') }}</span>
      <span class="char-count" :class="{ 'over-limit': isOverLimit }">
        {{ charCountText }}
      </span>
    </div>
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

.field-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.field-error {
  font-size: var(--font-size-xs);
  color: var(--color-danger);
}

.char-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-left: auto;
}

.char-count.over-limit {
  color: var(--color-danger);
}
</style>
