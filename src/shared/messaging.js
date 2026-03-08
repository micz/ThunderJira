// Message type constants
export const JIRA_GET_PROJECTS    = 'JIRA_GET_PROJECTS'
export const JIRA_GET_ISSUE_TYPES = 'JIRA_GET_ISSUE_TYPES'
export const JIRA_GET_FIELDS      = 'JIRA_GET_FIELDS'
export const JIRA_CREATE_ISSUE    = 'JIRA_CREATE_ISSUE'
export const JIRA_ADD_COMMENT     = 'JIRA_ADD_COMMENT'
export const JIRA_GET_ISSUE       = 'JIRA_GET_ISSUE'
export const JIRA_SEARCH_ISSUES   = 'JIRA_SEARCH_ISSUES'
export const GET_EMAIL_CONTEXT    = 'GET_EMAIL_CONTEXT'

// Convenience wrapper — always use this, never call browser.runtime.sendMessage directly
export async function sendMessage(type, payload = {}) {
  return browser.runtime.sendMessage({ type, payload })
}
