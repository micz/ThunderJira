<!--
  ThunderJira [https://micz.it/thunderbird-addon-thunderjira/]
  Copyright (C) 2026 Mic (m@micz.it)

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
-->

<script setup>
function openOptions() {
  browser.runtime.openOptionsPage()
}

function openUrl(url) {
  browser.windows.openDefaultBrowser(url)
}
</script>

<template>
  <div class="onboarding-body">
    <div class="content">

      <div class="section header">
        <h1>
          <img src="/icons/icon.png" class="title-icon" alt="ThunderJira icon" />
          ThunderJira
        </h1>
        <p>
          Welcome to ThunderJira!
          <br>This add-on integrates Jira directly into Thunderbird, letting you manage issues without leaving your inbox.
          <br>Create Jira issues from emails, enrich Jira links with live previews, and work seamlessly with both Jira Cloud and Server.
          <br><br>On this page, you'll find an overview of the key features available to help you make the most of ThunderJira.
          <br>Let's see how to get started!
        </p>
      </div>

      <div class="section image-full">
        <h2>Create Jira Issues from Emails</h2>
        <img src="./images/create-issue.png" alt="Create Jira issue from email" />
        <p>
          Right-click any email or use the action button in the message header to create a new Jira issue.
        </p>
        <ul>
          <li><b>Subject to Summary</b>: The email subject is automatically used as the issue summary.</li>
          <li><b>Body to Description</b>: The email body is converted and pre-filled as the issue description.</li>
          <li><b>Text Selection</b>: Select specific text in an email to use only that portion as the description.</li>
          <li><b>All Issue Fields</b>: Choose project, issue type, and fill in additional fields supported by your Jira setup.</li>
        </ul>
      </div>

      <div class="section image-right">
        <h2>Jira Link Enrichment</h2>
        <img src="./images/link-enrichment.png" alt="Enriched Jira links in email" />
        <p>
          When an email contains Jira issue links, ThunderJira automatically enriches them with interactive badges.
        </p>
        <ul>
          <li><b>Live Badges</b>: Each Jira link gets an inline badge showing the issue key and status.</li>
          <li><b>Hover Preview</b>: Hover over a badge to see a tooltip with the issue summary and status.</li>
          <li><b>Click for Details</b>: Click a badge to open a detail panel with more information about the issue, like the one on the right.</li>
        </ul>
      </div>

      <div class="section image-left">
        <h2>Cloud &amp; Server Support</h2>
        <img src="./images/cloud-server.png" alt="Jira Cloud and Server support" />
        <p>
          ThunderJira works with both Jira Cloud and self-hosted Jira Server / Data Center instances.
        </p>
        <ul>
          <li><b>Jira Cloud</b>: Connect using your Atlassian email and API token.</li>
          <li><b>Jira Server / Data Center</b>: Connect using your server URL and Personal Access Token (PAT).</li>
        </ul>
        <p class="clear">
          Configure your connection in the add-on options to get started.
        </p>
      </div>

      <div class="section getting-started">
        <h2>Getting Started</h2>
        <p>
          Configure your Jira connection to start using ThunderJira with your projects.
        </p>
        <p class="configure-button-container">
          <button class="button" @click="openOptions">Configure Now</button>
        </p>
      </div>

      <div class="section footer">
        <p style="text-align: center;">
          If you have any questions or suggestions, please open an issue on the
          <a href="#" @click.prevent="openUrl('https://github.com/micz/ThunderJira/')">GitHub page</a>.
        </p>
        <p style="text-align: center;"><br>
          Do you enjoy ThunderJira?
        </p>
        <p class="configure-button-container" style="text-align: center;">
          <button class="button" href="#" @click.prevent="openUrl('https://www.paypal.com/donate/?business=UHN4SXPGEXWQL&no_recurring=1&item_name=Thunderbird+Addon+ThunderJira&currency_code=EUR')">Make a donation!</button>
        </p>
      </div>

    </div>
  </div>
</template>

<style scoped>
.onboarding-body {
  font-family: var(--font-family-base);
  line-height: var(--line-height-loose);
  width: 960px;
  margin: 0 auto;
  padding: var(--space-5);
  font-size: var(--font-size-md);
  color: var(--color-text);
  background-color: var(--color-bg);
}

.content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin-top: 2em;
  padding: 2em;
  background: var(--color-bg-subtle);
  box-shadow: var(--shadow-md);
  border-radius: var(--border-radius-lg);
  position: relative;
}

.section {
  justify-content: space-between;
  align-items: start;
  width: 100%;
  margin-bottom: 2em;
  text-align: left;
  padding: 1ex 0 0;
}

.section:not(:last-child) {
  border-bottom: 1px solid var(--color-border);
  padding: 1ex 0;
}

.section.header,
.section.footer {
  flex-direction: column;
  z-index: 1;
  position: relative;
}

h1, h2 {
  color: var(--color-text);
  font-weight: var(--font-weight-bold);
}

h1 {
  font-size: var(--font-size-xl);
}

h2 {
  font-size: var(--font-size-lg);
  margin-bottom: var(--space-3);
}

.title-icon {
  margin-right: var(--space-5);
  position: relative;
  top: 12px;
}

.section.image-full img {
  display: block;
  max-width: 100%;
  margin: 15px auto 25px;
}

.section.image-right img {
  float: right;
  margin: 15px 0 35px 35px;
}

.section.image-left img {
  float: left;
  margin: 15px 35px 45px 0;
}

.section ul {
  padding-inline-start: 2em;
}

.section.image-left ul {
  padding-inline-start: calc(50% + 2em);
}

.clear {
  clear: both;
}

.section > img {
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
  margin-top: 15px;
}

.section p {
  color: var(--color-text);
}

.section p a {
  color: var(--color-text-link);
  text-decoration: none;
}

.section p a:hover {
  text-decoration: underline;
}

.getting-started {
  text-align: center;
}

.configure-button-container {
  margin-top: var(--space-4);
}

.button {
  padding: 10px 20px;
  color: var(--color-btn-primary-text);
  background-color: var(--color-btn-primary-bg);
  border: none;
  border-radius: var(--border-radius-md);
  cursor: pointer;
  text-decoration: none;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  transition: background-color var(--transition-normal), box-shadow var(--transition-normal);
}

.button:hover {
  background-color: var(--color-btn-primary-bg-hover);
  box-shadow: inset 4px 2px 5px rgba(0, 0, 0, 0.3);
}

.button:active {
  box-shadow: inset 5px 2px 5px rgba(0, 0, 0, 0.3);
}
</style>
