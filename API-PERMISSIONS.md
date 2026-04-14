# ThunderJira — API Permissions & Token Scopes

This document lists every Jira REST API endpoint used by ThunderJira and the minimum permissions required to generate a safe, fine-grained token.

---

## Jira Server / Data Center (Personal Access Token)

### Required Project Permissions

The PAT must belong to a user who has the following **project-level permissions** on every project they want to use with ThunderJira:

| Permission | Reason |
|------------|--------|
| **Browse Projects** | Read projects, issues, statuses, priorities, assignees |
| **Create Issues** | Create new issues from emails |
| ~~**Add Comments**~~ | ~~Add an email as a comment to an existing issue~~ |
| **Assignable User** | Appear in assignable-user search results |

No administration permissions are required.

### API Endpoints Used (REST API v2)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/rest/api/2/project` | List all visible projects |
| GET | `/rest/api/2/project/{projectKey}` | Get issue types for a project |
| GET | `/rest/api/2/issue/createmeta?projectKeys=…&issuetypeIds=…&expand=projects.issuetypes.fields` | Get available fields for issue creation |
| POST | `/rest/api/2/issue` | Create a new issue |
| POST | `/rest/api/2/issue/{issueKey}/comment` | Add a comment to an issue |
| GET | `/rest/api/2/issue/{issueKey}?fields=summary,status,assignee,priority,description,customfield_10021` | Read a single issue |
| POST | `/rest/api/2/search` | Search issues via JQL |
| GET | `/rest/api/2/user/assignable/search?project=…&username=…` | Search for assignable users |
| GET | `/rest/api/2/jql/autocompletedata/suggestions?fieldName=labels&fieldValue=…` | Search for labels |

### Authentication

- **Header:** `Authorization: Bearer {PAT}`
- Generate a PAT from your Jira profile: **Profile → Personal Access Tokens → Create token**.

---

## Jira Cloud (API Token)

### Important Note on Scopes

Jira Cloud API tokens (generated at `id.atlassian.com`) **do not support fine-grained scopes**. The token inherits all permissions of the user who created it.

To apply the principle of least privilege:

1. Create a **dedicated Jira Cloud account** with minimal permissions.
2. Grant that account only the project-level permissions listed below.
3. Generate the API token from that account.

### Required Project Permissions

| Permission | Reason |
|------------|--------|
| **Browse Projects** | Read projects, issues, statuses, priorities, assignees |
| **Create Issues** | Create new issues from emails |
| **Add Comments** | Add an email as a comment to an existing issue |
| **Assignable User** | Appear in assignable-user search results |

No administration permissions are required.

### API Endpoints Used (REST API v3)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/rest/api/3/project/search?maxResults=200&orderBy=name` | List all visible projects |
| GET | `/rest/api/3/project/{projectKey}` | Get issue types for a project |
| GET | `/rest/api/3/issue/createmeta/{projectKey}/issuetypes/{issueTypeId}` | Get available fields for issue creation |
| POST | `/rest/api/3/issue` | Create a new issue |
| POST | `/rest/api/3/issue/{issueKey}/comment` | Add a comment to an issue |
| GET | `/rest/api/3/issue/{issueKey}?fields=summary,status,assignee,priority,description,flagged` | Read a single issue |
| GET | `/rest/api/3/search/jql?jql=…&fields=…` | Search issues via JQL |
| GET | `/rest/api/3/user/assignable/search?project=…&query=…` | Search for assignable users |
| GET | `/rest/api/3/jql/autocompletedata/suggestions?fieldName=labels&fieldValue=…` | Search for labels |

### Authentication

- **Header:** `Authorization: Basic base64(email:apiToken)`
- Generate an API token at: [https://id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)

---

## Summary

ThunderJira only performs **read** operations (projects, issues, users, labels) and **write** operations (create issues, add comments). It does **not** delete, modify, or administer any Jira resource.
