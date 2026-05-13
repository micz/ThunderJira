# ![ThunderJira icon](public/icons/icon-32px.png "ThunderJira") ThunderJira Release Notes


<h2>Version 1.2.1 - 13/05/2026</h2>
<ul>
  <li>Fixed the XSRF error when using a Jira Data Center server [<a href="https://github.com/micz/ThunderJira/issues/8">#8</a>].</li>
  <li>Added a section in the option page to describe which user data is sent to the Jira server [<a href="https://github.com/micz/ThunderJira/issues/5">#5</a>].</li>
  <li>HTML sanitization now uses the <a href="https://github.com/cure53/DOMPurify">DOMPurify</a> library, replacing the previous custom implementation and hardening the email preview against XSS.</li>
  <li>Some minor fixes.</li>
</ul>
<h2>Version 1.2.0 - 21/04/2026</h2>
<ul>
  <li>Improved the mail body decoding also when using base64 encoding.</li>
</ul>
<h2>Version 1.1.0 - 20/03/2026</h2>
<ul>
  <li>Inline links to issues are not replaced by the issue badge. The issue badge is inserted before the link [<a href="https://github.com/micz/ThunderJira/issues/3">#3</a>].</li>
  <li>CSS styles are now stripped from the description when the mail body is converted to Markdown [<a href="https://github.com/micz/ThunderJira/issues/2">#2</a>].</li>
</ul>
<h2>Version 1.0.1 - 17/03/2026</h2>
<ul>
  <li>Minor fixes asked by the Thunderbird Review Team.</li>
  <li>Tab icon added</li>
</ul>
<h2>Version 1.0.0 - 14/03/2026</h2>
<ul>
  <li>First release.</li>
</ul>
