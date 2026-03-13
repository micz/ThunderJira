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

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { sendMessage } from '../../../shared/messaging.js'
import {
  JIRA_GET_PROJECTS,
  JIRA_GET_ISSUE_TYPES,
  JIRA_GET_FIELDS,
} from '../../../shared/messaging.js'
import { getDebugMode } from '../../../shared/storage.js'
import { tjLogger } from '../../../shared/mztj-logger.js'

const logger = new tjLogger('JiraMetaStore', false)
getDebugMode().then(enabled => logger.changeDebug(enabled))

export const UNSUPPORTED_SCHEMA_TYPES = new Set(['team', 'issuerestriction'])
const UNSUPPORTED_SCHEMA_CUSTOM = new Set([
  'com.atlassian.jira.plugins.jira-development-integration-plugin:designcf',
  'com.pyxis.greenhopper.jira:gh-lexo-rank',
  'com.atlassian.jira.plugins.jira-development-integration-plugin:devsummarycf',
  'com.atlassian.jira.plugins.jira-development-integration-plugin:vulnerabilitycf'
])
export const UNSUPPORTED_SYSTEMS = new Set([
  'issuerestriction', 'rankBeforeIssue', 'rankAfterIssue'
])

export const useJiraMetaStore = defineStore('jiraMeta', () => {
  const projects = ref([])
  const issueTypes = ref([])
  const fields = ref([])
  const loadingProjects = ref(false)
  const loadingIssueTypes = ref(false)
  const loadingFields = ref(false)
  const error = ref(null)

  const requiredFields = computed(() => fields.value.filter((f) => f.required))
  const optionalFields = computed(() => fields.value.filter((f) => !f.required))

  async function loadProjects() {
    loadingProjects.value = true
    error.value = null
    logger.log('Loading projects...')
    try {
      const response = await sendMessage(JIRA_GET_PROJECTS)
      if (response.error) {
        error.value = response.error
        logger.warn('loadProjects failed: ' + response.error)
        return
      }
      projects.value = response.data
      logger.log('loadProjects -> ' + projects.value.length + ' projects')
    } catch (err) {
      error.value = err.message ?? String(err)
      logger.warn('loadProjects error: ' + error.value)
    } finally {
      loadingProjects.value = false
    }
  }

  async function loadIssueTypes(projectKey) {
    loadingIssueTypes.value = true
    error.value = null
    issueTypes.value = []
    fields.value = []
    logger.log('Loading issue types for project: ' + projectKey)
    try {
      const response = await sendMessage(JIRA_GET_ISSUE_TYPES, { projectKey })
      if (response.error) {
        error.value = response.error
        logger.warn('loadIssueTypes failed: ' + response.error)
        return
      }
      issueTypes.value = response.data
      logger.log('loadIssueTypes [' + projectKey + '] -> ' + issueTypes.value.length + ' types')
    } catch (err) {
      error.value = err.message ?? String(err)
      logger.warn('loadIssueTypes error: ' + error.value)
    } finally {
      loadingIssueTypes.value = false
    }
  }

  async function loadFields(projectKey, issueTypeId) {
    loadingFields.value = true
    error.value = null
    fields.value = []
    logger.log('Loading fields for project=' + projectKey + ', issueTypeId=' + issueTypeId)
    try {
      const response = await sendMessage(JIRA_GET_FIELDS, { projectKey, issueTypeId })
      if (response.error) {
        error.value = response.error
        logger.warn('loadFields failed: ' + response.error)
        return
      }
      
      // Filter out unsupported fields immediately
      fields.value = (response.data || []).filter((f) => {
        if (UNSUPPORTED_SCHEMA_TYPES.has(f.schema?.type)) return false
        if (UNSUPPORTED_SYSTEMS.has(f.schema?.system)) return false
        if (UNSUPPORTED_SCHEMA_CUSTOM.has(f.schema?.custom)) return false
        return true
      })
      
      logger.log('loadFields -> ' + fields.value.length + ' fields')
    } catch (err) {
      error.value = err.message ?? String(err)
      logger.warn('loadFields error: ' + error.value)
    } finally {
      loadingFields.value = false
    }
  }

  return {
    projects,
    issueTypes,
    fields,
    loadingProjects,
    loadingIssueTypes,
    loadingFields,
    error,
    requiredFields,
    optionalFields,
    loadProjects,
    loadIssueTypes,
    loadFields,
  }
})
