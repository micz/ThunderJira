# ThunderJira — API Permissions & Token Scopes

This document lists every Jira REST API endpoint used by ThunderJira and the minimum permissions required to generate a safe, fine-grained token.
The **add comment** feature has not been implemented yet.

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
| ~~POST~~ | ~~`/rest/api/2/issue/{issueKey}/comment`~~ | ~~Add a comment to an issue~~ |
| GET | `/rest/api/2/issue/{issueKey}?fields=summary,status,assignee,priority,description,customfield_10021` | Read a single issue |
| POST | `/rest/api/2/search` | Search issues via JQL |
| GET | `/rest/api/2/user/assignable/search?project=…&username=…` | Search for assignable users |
| GET | `/rest/api/2/jql/autocompletedata/suggestions?fieldName=labels&fieldValue=…` | Search for labels |

### Authentication

- **Header:** `Authorization: Bearer {PAT}`
- Generate a PAT from your Jira profile: **Profile → Personal Access Tokens → Create token**.

---

## Jira Cloud (API Token)

### Important Note on API Tokens

Jira Cloud API tokens (generated at `id.atlassian.com`) inherit all permissions of the user who created them. To apply the principle of least privilege:

1. Create a **dedicated Jira Cloud account** with minimal permissions.
2. Grant that account only the project-level permissions listed below.
3. Generate the API token from that account.

If your organization uses **OAuth 2.0 (3LO)** or **Forge apps** with fine-grained token scopes, use the granular scope names listed in the table below.

### Required Project Permissions

| Permission | Reason |
|------------|--------|
| **Browse Projects** | Read projects, issues, statuses, priorities, assignees |
| **Create Issues** | Create new issues from emails |
| ~~**Add Comments**~~ | ~~Add an email as a comment to an existing issue~~ |
| **Assignable User** | Appear in assignable-user search results |

No administration permissions are required.

### API Endpoints and Granular Scopes (REST API v3)

| Method | Endpoint | Purpose | Granular Scopes |
|--------|----------|---------|-----------------|
| GET | `/rest/api/3/project/search` | List all visible projects | `read:project:jira`, `read:issue-type:jira`, `read:project.property:jira`, `read:user:jira`, `read:application-role:jira` |
| GET | `/rest/api/3/project/{projectKey}` | Get issue types for a project | `read:project:jira`, `read:issue-type:jira`, `read:project.property:jira`, `read:user:jira`, `read:application-role:jira` |
| GET | `/rest/api/3/issue/createmeta/{projectKey}/issuetypes/{issueTypeId}` | Get available fields for issue creation | `read:issue-meta:jira`, `read:avatar:jira`, `read:field-configuration:jira` |
| POST | `/rest/api/3/issue` | Create a new issue | `write:issue:jira`, `write:comment:jira`, `write:comment.property:jira`, `write:attachment:jira`, `read:issue:jira` |
| ~~POST~~ | ~~`/rest/api/3/issue/{issueKey}/comment`~~ | ~~Add a comment to an issue~~ | ~~`write:comment:jira`, `write:comment.property:jira`~~ |
| GET | `/rest/api/3/issue/{issueKey}` | Read a single issue | `read:issue:jira`, `read:issue-meta:jira`, `read:issue-security-level:jira`, `read:issue.vote:jira`, `read:issue.changelog:jira`, `read:avatar:jira` |
| GET | `/rest/api/3/search/jql` | Search issues via JQL | `read:issue-details:jira`, `read:audit-log:jira`, `read:avatar:jira`, `read:field-configuration:jira`, `read:issue-meta:jira` |
| GET | `/rest/api/3/user/assignable/search` | Search for assignable users | `read:issue:jira`, `read:project:jira`, `read:user:jira`, `read:application-role:jira`, `read:avatar:jira` |
| GET | `/rest/api/3/jql/autocompletedata/suggestions` | Search for labels | `read:issue-details:jira` |

### Minimum Scope Checklist

If you are configuring scopes for an OAuth 2.0 or Forge app, select these granular scopes:

**Read scopes:**
- `read:project:jira`
- `read:project.property:jira`
- `read:issue-type:jira`
- `read:issue:jira`
- `read:issue-details:jira`
- `read:issue-meta:jira`
- `read:issue-security-level:jira`
- `read:issue.vote:jira`
- `read:issue.changelog:jira`
- `read:field-configuration:jira`
- `read:user:jira`
- `read:application-role:jira`
- `read:avatar:jira`
- `read:audit-log:jira`

**Write scopes:**
- `write:issue:jira`
- ~~`write:comment:jira`~~
- ~~`write:comment.property:jira`~~
- `write:attachment:jira`

Alternatively, the **classic scopes** `read:jira-work` and `write:jira-work` cover all of the above, but grant broader access.

### Authentication

- **Header:** `Authorization: Basic base64(email:apiToken)`
- Generate an API token at: [https://id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)

---

## Summary

ThunderJira only performs **read** operations (projects, issues, users, labels) and **write** operations (create issues, ~~add comments~~). It does **not** delete, modify, or administer any Jira resource.
