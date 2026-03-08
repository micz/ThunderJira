export function buildAuthHeaders({ type, email, apiToken, pat }) {
  if (type === 'cloud') {
    const encoded = btoa(`${email}:${apiToken}`)
    return {
      'Authorization': `Basic ${encoded}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Atlassian-Token': 'no-check',
    }
  }

  if (type === 'server') {
    return {
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Atlassian-Token': 'no-check',
      'X-Requested-With': 'XMLHttpRequest',
    }
  }

  throw new Error(`Unknown Jira type: ${type}`)
}
