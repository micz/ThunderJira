import { STORAGE_KEY_JIRA_CONFIG, STORAGE_KEY_EMAIL_CONTEXT, STORAGE_KEY_DEBUG } from './constants.js'

export async function getJiraConfig() {
  const result = await browser.storage.local.get(STORAGE_KEY_JIRA_CONFIG)
  return result[STORAGE_KEY_JIRA_CONFIG] ?? null
}

export async function setJiraConfig(config) {
  await browser.storage.local.set({ [STORAGE_KEY_JIRA_CONFIG]: config })
}

export async function getEmailContext() {
  const result = await browser.storage.session.get(STORAGE_KEY_EMAIL_CONTEXT)
  return result[STORAGE_KEY_EMAIL_CONTEXT] ?? null
}

export async function setEmailContext(ctx) {
  await browser.storage.session.set({ [STORAGE_KEY_EMAIL_CONTEXT]: ctx })
}

export async function getDebugMode() {
  const result = await browser.storage.local.get(STORAGE_KEY_DEBUG)
  return result[STORAGE_KEY_DEBUG] ?? false
}

export async function setDebugMode(enabled) {
  await browser.storage.local.set({ [STORAGE_KEY_DEBUG]: enabled })
}
