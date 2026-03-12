# ThunderJira

A Thunderbird MailExtension that integrates Jira directly into the email client.

Supports **Jira Cloud** (atlassian.net) and **Jira Server / Data Center** (self-hosted).

## Features

- Create a Jira issue from an email — subject pre-fills the summary, body pre-fills the description
- ~~Add an email as a comment on an existing Jira issue~~
- Jira issue links in email bodies are enriched with a clickable badge that opens the issue in the browser

## Requirements

- Thunderbird 140 or later
- A Jira Cloud or Jira Server / Data Center instance

## Build

> Node.js 18+ is required to build the extension.



Install dependencies:

```bash
npm install
```

Build for development (watch mode):

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

The compiled extension is output to `dist/`.

## Debug in Thunderbird

1. Open Thunderbird
2. Go to **Menu → Add-ons and Themes → Extensions**
3. Click the gear icon → **Debug Add-ons**
4. Click **Load Temporary Add-on…**
5. Select the `manifest.json` file inside the `dist/` folder

To reload after a rebuild, click **Reload** next to the extension in the Debug Add-ons page.


## Configuration

After loading the extension, open **ThunderJira Options** from the Add-ons page to configure:

- **Jira Cloud**: instance URL (e.g. `https://yourcompany.atlassian.net`), your email address, and an API token
- **Jira Server / Data Center**: base URL and a Personal Access Token (PAT)

Use the **Test Connection** button to verify the credentials before saving.

Set any other option you need. 


<br>

## Graphics
- [DoubleDesign](https://icon-icons.com/authors/42-double-j-design) for the base image used to create the addon icon
- [JessiGue](https://www.flaticon.com/authors/jessigue) for the show/hide icon for api token fields
