export function buildAuthHeaders({ type, email, apiToken, pat }) {
  if (type === 'cloud') {
    const encoded = btoa(`${email}:${apiToken}`)
    return {
      'Authorization': `Basic ${encoded}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  }

  if (type === 'server') {
    return {
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  }

  throw new Error(`Unknown Jira type: ${type}`)
}
