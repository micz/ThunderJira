# ThunderJira — Claude Code Instructions

## Project Overview

**ThunderJira** is a Thunderbird MailExtension (addon) that integrates Jira directly into the email client.
It supports both **Jira Cloud** (atlassian.net) and **Jira Server / Data Center** (self-hosted).

Core use cases:
- Create a Jira issue from an email (subject → summary, body → description)
- Add an email as a comment to an existing issue
- Preview linked Jira issues inline in the email body

## Stack

| Layer | Technology |
|-------|-----------|
| Extension platform | Thunderbird MailExtension, Manifest V3 |
| UI framework | Vue 3 Composition API with `<script setup>` |
| State management | Pinia — Setup Store pattern only |
| Build tool | Vite (multi-entry config) |
| Styling | Custom CSS with design tokens — no UI library |
| Minimum Thunderbird version | 140+ |

## Key Constraints — Always Respect

1. **Vue apps never call Jira directly.** All Jira API calls go through `runtime.sendMessage` to the background script.
2. **The background is the only module that instantiates `JiraClient`** and calls Jira REST APIs.
3. **No external UI dependencies.** Use only custom CSS with token variables defined in `src/assets/styles/tokens.css`.
4. **All Pinia stores use the Setup Store pattern** (function-based, not options object). Never use the Options Store.
5. **Vue components always use `<script setup>`** and `<style scoped>`.
6. **Email context is passed to Vue tab apps via `browser.storage.session`** — not via URL params or DOM injection.
7. **Inter-component messaging uses constants from `src/shared/messaging.js`** — never raw string literals.
8. **All code must use English.** Variable names, function names, comments, and any developer-written text (logs, error messages, inline docs) must be in English. No exceptions.

## Project Structure

```
public/               # Static files copied as-is to dist/ (manifest, icons, _locales)
dist/                 # Build output loaded by Thunderbird — never edit manually
src/
├── background/       # Event page — message router, JiraClient hub
├── api/              # JiraClient, auth helpers, field mappers
├── shared/           # Constants, storage helpers, messaging catalog, utils
├── content-scripts/  # message-overlay.js — Jira link enrichment in emails
├── options/          # Vue app — connection settings
├── tabs/
│   ├── create-issue/ # Vue app — create issue from email
│   └── add-comment/  # Vue app — add email as Jira comment
└── assets/
    └── styles/       # tokens.css, common.css
```

## Dev Workflow

```bash
npm run dev    # Vite watch build → dist/
```

After saving any file, Vite rebuilds and Thunderbird hot-reloads the extension.

## Architectural Specifications

Detailed specs for each subsystem live in `claude-spec/`. Read the relevant file before modifying any subsystem.

| File | Topic |
|------|-------|
| [claude-spec/01-architecture.md](claude-spec/01-architecture.md) | Overall data flow, app isolation, storage strategy |
| [claude-spec/02-manifest-and-permissions.md](claude-spec/02-manifest-and-permissions.md) | manifest.json structure, permissions, Event Page |
| [claude-spec/03-vue-apps.md](claude-spec/03-vue-apps.md) | The 3 Vue apps — entrypoints, stores, components |
| [claude-spec/04-pinia-stores.md](claude-spec/04-pinia-stores.md) | Store pattern, naming, catalog, error handling |
| [claude-spec/05-messaging.md](claude-spec/05-messaging.md) | Message catalog, background router, error protocol |
| [claude-spec/06-jira-client.md](claude-spec/06-jira-client.md) | JiraClient class, API versioning, auth |
| [claude-spec/07-content-script-and-popup.md](claude-spec/07-content-script-and-popup.md) | Link enrichment, email context writing |
| [claude-spec/08-css-tokens.md](claude-spec/08-css-tokens.md) | Design tokens, scoped CSS rules |
| [claude-spec/09-project-structure.md](claude-spec/09-project-structure.md) | Full directory tree, naming conventions |
| [claude-spec/99-thunderbird-team-spec.md](claude-spec/99-thunderbird-team-spec.md) | Thunderbird team guidelines, documented deviations, VENDOR.md, i18n, API audit |
