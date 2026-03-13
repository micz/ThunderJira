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

// Message type constants
export const JIRA_GET_PROJECTS    = 'JIRA_GET_PROJECTS'
export const JIRA_GET_ISSUE_TYPES = 'JIRA_GET_ISSUE_TYPES'
export const JIRA_GET_FIELDS      = 'JIRA_GET_FIELDS'
export const JIRA_CREATE_ISSUE    = 'JIRA_CREATE_ISSUE'
export const JIRA_ADD_COMMENT     = 'JIRA_ADD_COMMENT'
export const JIRA_GET_ISSUE       = 'JIRA_GET_ISSUE'
export const JIRA_SEARCH_ISSUES   = 'JIRA_SEARCH_ISSUES'
export const JIRA_SEARCH_USERS    = 'JIRA_SEARCH_USERS'
export const JIRA_SEARCH_LABELS   = 'JIRA_SEARCH_LABELS'
export const GET_EMAIL_CONTEXT    = 'GET_EMAIL_CONTEXT'
export const GET_SELECTION        = 'GET_SELECTION'
export const OPEN_URL             = 'OPEN_URL'

// Convenience wrapper — always use this, never call browser.runtime.sendMessage directly
export async function sendMessage(type, payload = {}) {
  return browser.runtime.sendMessage({ type, payload })
}
