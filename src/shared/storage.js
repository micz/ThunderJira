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

import {
  STORAGE_KEY_JIRA_CONFIG,
  STORAGE_KEY_EMAIL_CONTEXT,
  STORAGE_KEY_DEBUG,
  STORAGE_KEY_SHOW_OPTIONAL,
  STORAGE_KEY_LOAD_REMOTE_CONTENT,
  STORAGE_KEY_DEFAULT_PROJECT,
  STORAGE_KEY_USE_LAST_PROJECT,
  STORAGE_KEY_LAST_USED_PROJECT,
  DEFAULT_DEBUG_MODE,
  DEFAULT_SHOW_OPTIONAL,
  DEFAULT_LOAD_REMOTE_CONTENT,
  DEFAULT_USE_LAST_PROJECT,
  DEFAULT_DEFAULT_PROJECT
} from './constants.js'

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
  return result[STORAGE_KEY_DEBUG] ?? DEFAULT_DEBUG_MODE
}

export async function setDebugMode(enabled) {
  await browser.storage.local.set({ [STORAGE_KEY_DEBUG]: enabled })
}

export async function getShowOptionalFields() {
  const result = await browser.storage.local.get(STORAGE_KEY_SHOW_OPTIONAL)
  return result[STORAGE_KEY_SHOW_OPTIONAL] ?? DEFAULT_SHOW_OPTIONAL
}

export async function setShowOptionalFields(enabled) {
  await browser.storage.local.set({ [STORAGE_KEY_SHOW_OPTIONAL]: enabled })
}

export async function getLoadRemoteContent() {
  const result = await browser.storage.local.get(STORAGE_KEY_LOAD_REMOTE_CONTENT)
  return result[STORAGE_KEY_LOAD_REMOTE_CONTENT] ?? DEFAULT_LOAD_REMOTE_CONTENT
}

export async function setLoadRemoteContent(enabled) {
  await browser.storage.local.set({ [STORAGE_KEY_LOAD_REMOTE_CONTENT]: enabled })
}

export async function getDefaultProject() {
  const result = await browser.storage.local.get(STORAGE_KEY_DEFAULT_PROJECT)
  return result[STORAGE_KEY_DEFAULT_PROJECT] ?? DEFAULT_DEFAULT_PROJECT
}

export async function setDefaultProject(projectKey) {
  await browser.storage.local.set({ [STORAGE_KEY_DEFAULT_PROJECT]: projectKey })
}

export async function getUseLastProject() {
  const result = await browser.storage.local.get(STORAGE_KEY_USE_LAST_PROJECT)
  return result[STORAGE_KEY_USE_LAST_PROJECT] ?? DEFAULT_USE_LAST_PROJECT
}

export async function setUseLastProject(enabled) {
  await browser.storage.local.set({ [STORAGE_KEY_USE_LAST_PROJECT]: enabled })
}

export async function getLastUsedProject() {
  const result = await browser.storage.local.get(STORAGE_KEY_LAST_USED_PROJECT)
  return result[STORAGE_KEY_LAST_USED_PROJECT] ?? DEFAULT_DEFAULT_PROJECT
}

export async function setLastUsedProject(projectKey) {
  await browser.storage.local.set({ [STORAGE_KEY_LAST_USED_PROJECT]: projectKey })
}
