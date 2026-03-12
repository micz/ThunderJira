// message-overlay.js — Jira link enrichment for Thunderbird email display
// Vanilla JS only — no imports, no Vue, no external dependencies.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const JIRA_LINK_REGEX = /(https?:\/\/[^\s"<>]+\/browse\/([A-Z]+-\d+))/g
const TOOLTIP_SHOW_DELAY_MS = 300
const TOOLTIP_HIDE_DELAY_MS = 200
const DESCRIPTION_MAX_CHARS = 200
const SUMMARY_MAX_CHARS = 80

// ---------------------------------------------------------------------------
// Style injection
// ---------------------------------------------------------------------------

function injectStyles() {
  if (document.getElementById('jira-overlay-styles')) return

  const style = document.createElement('style')
  style.id = 'jira-overlay-styles'
  style.textContent = `
    .jira-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 7px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
      background-color: #0052cc;
      color: #fff;
      cursor: pointer;
      user-select: none;
      text-decoration: none;
      vertical-align: middle;
      transition: background-color 100ms ease;
      position: relative;
    }
    .jira-badge:hover {
      background-color: #0065ff;
    }

    .jira-tooltip {
      position: fixed;
      z-index: 9999;
      background: #ffffff;
      border: 1px solid #dfe1e6;
      border-radius: 4px;
      box-shadow: 0 4px 8px rgba(9,30,66,0.16);
      padding: 8px 10px;
      min-width: 220px;
      max-width: 320px;
      pointer-events: none;
      font-size: 12px;
      color: #172b4d;
      line-height: 1.4;
    }
    .jira-tooltip-key {
      font-weight: 700;
      color: #0052cc;
    }
    .jira-tooltip-summary {
      color: #172b4d;
      margin-top: 4px;
      margin-bottom: 2px;
    }
    .jira-tooltip-meta {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }
    .jira-tooltip-loading {
      color: #5e6c84;
      font-style: italic;
    }
    .jira-tooltip-error {
      color: #de350b;
    }
    .jira-tooltip-hint {
      font-size: 11px;
      color: #97a0af;
      margin-top: 5px;
    }

    .jira-panel-overlay {
      position: fixed;
      inset: 0;
      z-index: 9998;
      background: transparent;
    }
    .jira-panel {
      position: fixed;
      z-index: 9999;
      background: #ffffff;
      border: 1px solid #dfe1e6;
      border-radius: 6px;
      box-shadow: 0 8px 24px rgba(9,30,66,0.20);
      width: 360px;
      overflow-y: auto;
      font-size: 13px;
      color: #172b4d;
      line-height: 1.5;
    }
    .jira-panel-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 14px 16px 10px;
      border-bottom: 1px solid #dfe1e6;
      gap: 8px;
      cursor: grab;
      user-select: none;
    }
    .jira-panel-header.jira-dragging {
      cursor: grabbing;
    }
    .jira-panel-key {
      font-size: 11px;
      font-weight: 700;
      color: #0052cc;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .jira-panel-summary {
      font-size: 14px;
      font-weight: 600;
      color: #172b4d;
      margin-top: 2px;
      line-height: 1.3;
    }
    .jira-panel-close {
      background: none;
      border: none;
      cursor: pointer;
      color: #5e6c84;
      font-size: 18px;
      line-height: 1;
      padding: 0 2px;
      flex-shrink: 0;
    }
    .jira-panel-close:hover { color: #172b4d; }
    .jira-panel-body {
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .jira-panel-row {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .jira-panel-label {
      font-size: 11px;
      font-weight: 600;
      color: #5e6c84;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .jira-panel-value {
      font-size: 13px;
      color: #172b4d;
    }
    .jira-panel-description {
      font-size: 12px;
      color: #5e6c84;
      line-height: 1.5;
    }
    .jira-panel-footer {
      padding: 10px 16px 14px;
      border-top: 1px solid #dfe1e6;
    }
    .jira-panel-open-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 600;
      color: #0052cc;
      text-decoration: none;
      cursor: pointer;
      background: none;
      border: none;
      padding: 0;
    }
    .jira-panel-open-link:hover { color: #0065ff; text-decoration: underline; }
    .jira-panel-loading {
      padding: 24px 16px;
      text-align: center;
      color: #5e6c84;
      font-style: italic;
    }
    .jira-panel-error {
      padding: 16px;
      color: #de350b;
      font-size: 12px;
    }

    .jira-status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .jira-status--done     { background: #e3fcef; color: #00875a; }
    .jira-status--progress { background: #fffae6; color: #ff8b00; }
    .jira-status--blocked  { background: #ffebe6; color: #de350b; }
    .jira-status--todo     { background: #f4f5f7; color: #5e6c84; }

    .jira-inline-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .jira-avatar {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }
    .jira-avatar-initials {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #0052cc;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .jira-icon {
      width: 16px;
      height: 16px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .jira-tooltip-hint {
      font-size: 11px;
      color: #97a0af;
      margin-top: 5px;
    }
  `
  document.head.appendChild(style)
}

// ---------------------------------------------------------------------------
// Link enrichment
// ---------------------------------------------------------------------------

function enrichLinks() {
  const anchors = Array.from(document.querySelectorAll('a'))
  for (const anchor of anchors) {
    if (anchor.dataset.jiraEnriched) continue
    const href = anchor.href || ''
    JIRA_LINK_REGEX.lastIndex = 0
    const match = JIRA_LINK_REGEX.exec(href)
    if (match) {
      enrichLink(anchor, match[2], match[1])
    }
  }
}

function enrichLink(anchor, issueKey, fullUrl) {
  const badge = document.createElement('span')
  badge.className = 'jira-badge'
  badge.dataset.issueKey = issueKey
  badge.dataset.jiraUrl = fullUrl
  badge.dataset.jiraEnriched = 'true'
  badge.textContent = issueKey
  badge.setAttribute('role', 'button')
  badge.setAttribute('tabindex', '0')

  anchor.replaceWith(badge)

  registerHoverListeners(badge)
  registerClickListener(badge)
}

// ---------------------------------------------------------------------------
// Tooltip — global state (one at a time)
// ---------------------------------------------------------------------------

let _tooltipEl = null
let _tooltipShowTimer = null
let _tooltipHideTimer = null

function registerHoverListeners(badge) {
  badge.addEventListener('mouseenter', () => {
    clearTimeout(_tooltipHideTimer)
    _tooltipShowTimer = setTimeout(() => showTooltip(badge), TOOLTIP_SHOW_DELAY_MS)
  })

  badge.addEventListener('mouseleave', () => {
    clearTimeout(_tooltipShowTimer)
    _tooltipHideTimer = setTimeout(() => hideTooltip(), TOOLTIP_HIDE_DELAY_MS)
  })
}

async function showTooltip(badge) {
  hideTooltip()

  const issueKey = badge.dataset.issueKey
  const rect = badge.getBoundingClientRect()

  _tooltipEl = createTooltipLoading()
  positionTooltip(_tooltipEl, rect)
  document.body.appendChild(_tooltipEl)

  let response
  try {
    response = await browser.runtime.sendMessage({ type: 'JIRA_GET_ISSUE', payload: { issueKey } })
  } catch (_err) {
    response = { error: 'sendMessage failed' }
  }

  if (!_tooltipEl || !document.body.contains(_tooltipEl)) return

  if (response.error) {
    updateTooltipError(_tooltipEl)
  } else {
    updateTooltipData(_tooltipEl, response.data)
  }
}

function hideTooltip() {
  if (_tooltipEl) {
    _tooltipEl.remove()
    _tooltipEl = null
  }
}

function createTooltipLoading() {
  const el = document.createElement('div')
  el.className = 'jira-tooltip'

  const loading = document.createElement('span')
  loading.className = 'jira-tooltip-loading'
  loading.textContent = browser.i18n.getMessage('tooltipLoading')
  el.appendChild(loading)

  return el
}

function updateTooltipError(el) {
  el.textContent = ''
  const err = document.createElement('span')
  err.className = 'jira-tooltip-error'
  err.textContent = browser.i18n.getMessage('tooltipErrorLoad')
  el.appendChild(err)
}

function updateTooltipData(el, issue) {
  el.textContent = ''

  const fields = issue.fields || {}
  const status = fields.status || {}
  const statusName = status.name || ''
  const statusCat = status.statusCategory || {}
  const flagged = !!fields.flagged || (Array.isArray(fields.customfield_10021) && fields.customfield_10021.length > 0)

  // Row 1: key + status badge + optional flag
  const meta = document.createElement('div')
  meta.className = 'jira-tooltip-meta'

  const keyEl = document.createElement('span')
  keyEl.className = 'jira-tooltip-key'
  keyEl.textContent = issue.key || ''
  meta.appendChild(keyEl)

  meta.appendChild(buildStatusBadge(statusName, statusCat, null))

  if (flagged) {
    const flagEl = document.createElement('span')
    flagEl.textContent = '\uD83D\uDEA9'
    flagEl.style.cssText = 'font-size:13px;line-height:1;'
    meta.appendChild(flagEl)
  }

  el.appendChild(meta)

  // Summary
  const summary = fields.summary || ''
  if (summary) {
    const summaryEl = document.createElement('div')
    summaryEl.className = 'jira-tooltip-summary'
    summaryEl.textContent = truncate(summary, SUMMARY_MAX_CHARS)
    el.appendChild(summaryEl)
  }

  // Hint
  const hint = document.createElement('div')
  hint.className = 'jira-tooltip-hint'
  hint.textContent = browser.i18n.getMessage('tooltipClickToExpand')
  el.appendChild(hint)
}

function positionTooltip(el, badgeRect) {
  const margin = 6

  el.style.visibility = 'hidden'
  el.style.position = 'fixed'
  el.style.top = '0px'
  el.style.left = '0px'
  document.body.appendChild(el)
  const elHeight = el.offsetHeight
  const elWidth = el.offsetWidth
  el.remove()
  el.style.visibility = ''

  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth

  let top = badgeRect.bottom + margin
  if (top + elHeight > viewportHeight) {
    top = badgeRect.top - elHeight - margin
  }
  if (top < margin) top = margin

  let left = badgeRect.left
  if (left + elWidth > viewportWidth - margin) {
    left = viewportWidth - elWidth - margin
  }
  if (left < margin) left = margin

  el.style.top = top + 'px'
  el.style.left = left + 'px'
}

// ---------------------------------------------------------------------------
// Panel — global state (one at a time)
// ---------------------------------------------------------------------------

let _panelEl = null
let _overlayEl = null
let _escListener = null
let _panelBadge = null
let _resizeListener = null

// Drag state
let _panelDragged = false
let _isDragging = false
let _lastDragEndTime = 0
let _dragStartX = 0
let _dragStartY = 0
let _dragStartPanelTop = 0
let _dragStartPanelLeft = 0

function registerClickListener(badge) {
  badge.addEventListener('click', (e) => {
    e.stopPropagation()
    hideTooltip()
    clearTimeout(_tooltipShowTimer)

    if (_panelEl && _panelEl.dataset.issueKey === badge.dataset.issueKey) {
      closePanel()
      return
    }

    openPanel(badge)
  })
}

async function openPanel(badge) {
  closePanel()

  const issueKey = badge.dataset.issueKey
  const jiraUrl = badge.dataset.jiraUrl
  const rect = badge.getBoundingClientRect()

  _panelBadge = badge
  _panelDragged = false

  _overlayEl = document.createElement('div')
  _overlayEl.className = 'jira-panel-overlay'
  _overlayEl.addEventListener('click', () => {
    // Ignore the click that immediately follows a drag release
    if (Date.now() - _lastDragEndTime < 300) return
    closePanel()
  })
  document.body.appendChild(_overlayEl)

  _panelEl = createPanelLoading(issueKey)
  positionPanel(_panelEl, rect)
  document.body.appendChild(_panelEl)

  _escListener = (e) => {
    if (e.key === 'Escape') closePanel()
  }
  document.addEventListener('keydown', _escListener)

  _resizeListener = () => {
    if (_panelEl && _panelBadge && !_panelDragged) {
      positionPanel(_panelEl, _panelBadge.getBoundingClientRect())
    }
  }
  window.addEventListener('resize', _resizeListener)

  let response
  try {
    response = await browser.runtime.sendMessage({ type: 'JIRA_GET_ISSUE', payload: { issueKey } })
  } catch (_err) {
    response = { error: 'sendMessage failed' }
  }

  if (!_panelEl || !document.body.contains(_panelEl)) return

  if (response.error) {
    updatePanelError(_panelEl, issueKey, jiraUrl)
  } else {
    updatePanelData(_panelEl, response.data, jiraUrl)
  }

  // Reposition now that the panel has its final content height
  if (_panelEl && _panelBadge && !_panelDragged) {
    positionPanel(_panelEl, _panelBadge.getBoundingClientRect())
  }
}

function closePanel() {
  _isDragging = false
  _panelDragged = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)

  if (_escListener) {
    document.removeEventListener('keydown', _escListener)
    _escListener = null
  }
  if (_resizeListener) {
    window.removeEventListener('resize', _resizeListener)
    _resizeListener = null
  }
  if (_panelEl) { _panelEl.remove(); _panelEl = null }
  if (_overlayEl) { _overlayEl.remove(); _overlayEl = null }
  _panelBadge = null
}

// ---------------------------------------------------------------------------
// Drag and drop
// ---------------------------------------------------------------------------

function setupDrag(header) {
  header.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    if (e.target.closest('.jira-panel-close')) return
    e.preventDefault()

    // Convert bottom-anchored positioning to top before dragging
    const rect = _panelEl.getBoundingClientRect()
    _panelEl.style.bottom = ''
    _panelEl.style.top = rect.top + 'px'
    _panelEl.style.left = rect.left + 'px'

    _isDragging = true
    _panelDragged = true
    _dragStartX = e.clientX
    _dragStartY = e.clientY
    _dragStartPanelTop = rect.top
    _dragStartPanelLeft = rect.left

    header.classList.add('jira-dragging')
    document.addEventListener('mousemove', onDragMove)
    document.addEventListener('mouseup', onDragEnd)
  })
}

function onDragMove(e) {
  if (!_isDragging || !_panelEl) return
  _panelEl.style.top = (_dragStartPanelTop + e.clientY - _dragStartY) + 'px'
  _panelEl.style.left = (_dragStartPanelLeft + e.clientX - _dragStartX) + 'px'
}

function onDragEnd() {
  if (!_isDragging) return
  _isDragging = false
  _lastDragEndTime = Date.now()
  if (_panelEl) {
    const header = _panelEl.querySelector('.jira-panel-header')
    if (header) header.classList.remove('jira-dragging')
  }
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}

// ---------------------------------------------------------------------------
// Panel content builders
// ---------------------------------------------------------------------------

function createPanelLoading(issueKey) {
  const panel = document.createElement('div')
  panel.className = 'jira-panel'
  panel.dataset.issueKey = issueKey

  const loading = document.createElement('div')
  loading.className = 'jira-panel-loading'
  loading.textContent = browser.i18n.getMessage('tooltipLoading')
  panel.appendChild(loading)

  return panel
}

function updatePanelError(panel, issueKey, jiraUrl) {
  panel.textContent = ''
  panel.dataset.issueKey = issueKey

  const err = document.createElement('div')
  err.className = 'jira-panel-error'
  err.textContent = browser.i18n.getMessage('tooltipErrorLoad')
  panel.appendChild(err)

  panel.appendChild(buildPanelFooter(jiraUrl))
}

function updatePanelData(panel, issue, jiraUrl) {
  panel.textContent = ''

  const fields = issue.fields || {}
  const status = fields.status || {}
  const statusName = status.name || ''
  const statusCat = status.statusCategory || {}
  const assignee = fields.assignee
  const priority = fields.priority
  const description = extractDescriptionText(fields.description)
  const flagged = !!fields.flagged || (Array.isArray(fields.customfield_10021) && fields.customfield_10021.length > 0)

  // Header
  const header = document.createElement('div')
  header.className = 'jira-panel-header'

  const headerLeft = document.createElement('div')

  const keyRow = document.createElement('div')
  keyRow.className = 'jira-inline-row'

  const keyEl = document.createElement('div')
  keyEl.className = 'jira-panel-key'
  keyEl.textContent = issue.key || ''
  keyRow.appendChild(keyEl)

  if (flagged) {
    const flagEl = document.createElement('span')
    flagEl.textContent = '\uD83D\uDEA9'
    flagEl.style.cssText = 'font-size:14px;line-height:1;'
    keyRow.appendChild(flagEl)
  }

  headerLeft.appendChild(keyRow)

  const summaryEl = document.createElement('div')
  summaryEl.className = 'jira-panel-summary'
  summaryEl.textContent = fields.summary || ''
  headerLeft.appendChild(summaryEl)

  header.appendChild(headerLeft)

  const closeBtn = document.createElement('button')
  closeBtn.className = 'jira-panel-close'
  closeBtn.textContent = '\u2715'
  closeBtn.setAttribute('aria-label', 'Close')
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    closePanel()
  })
  header.appendChild(closeBtn)

  panel.appendChild(header)
  setupDrag(header)

  // Body
  const body = document.createElement('div')
  body.className = 'jira-panel-body'

  body.appendChild(buildPanelRow('Status', buildStatusBadge(statusName, statusCat, status.iconUrl)))
  body.appendChild(buildPanelRow(browser.i18n.getMessage('panelAssignee'), buildAssigneeValue(assignee)))
  body.appendChild(buildPanelRow(browser.i18n.getMessage('panelPriority'), buildPriorityValue(priority)))

  const descText = description
    ? truncate(description, DESCRIPTION_MAX_CHARS)
    : browser.i18n.getMessage('panelNoDescription')
  body.appendChild(buildPanelRow(browser.i18n.getMessage('panelDescription'), buildDescriptionValue(descText)))

  panel.appendChild(body)
  panel.appendChild(buildPanelFooter(jiraUrl))
}

function buildPanelRow(labelText, valueEl) {
  const row = document.createElement('div')
  row.className = 'jira-panel-row'

  const label = document.createElement('div')
  label.className = 'jira-panel-label'
  label.textContent = labelText
  row.appendChild(label)
  row.appendChild(valueEl)

  return row
}

function buildStatusBadge(statusName, statusCat, iconUrl) {
  const el = document.createElement('span')
  el.className = 'jira-status ' + getStatusClass(statusCat)

  if (iconUrl) {
    const img = document.createElement('img')
    img.className = 'jira-icon'
    img.src = iconUrl
    img.alt = ''
    img.onerror = () => img.remove()
    el.appendChild(img)
  }

  const text = document.createElement('span')
  text.textContent = statusName
  el.appendChild(text)

  return el
}

function buildAssigneeValue(assignee) {
  const el = document.createElement('div')
  el.className = 'jira-panel-value jira-inline-row'

  if (!assignee) {
    el.textContent = browser.i18n.getMessage('panelUnassigned')
    return el
  }

  const avatarUrl = assignee.avatarUrls && (assignee.avatarUrls['24x24'] || assignee.avatarUrls['32x32'] || assignee.avatarUrls['16x16'])
  const displayName = assignee.displayName || assignee.name || browser.i18n.getMessage('panelUnassigned')

  if (avatarUrl) {
    const img = document.createElement('img')
    img.className = 'jira-avatar'
    img.src = avatarUrl
    img.alt = ''
    img.onerror = () => img.replaceWith(buildAvatarInitials(displayName))
    el.appendChild(img)
  } else {
    el.appendChild(buildAvatarInitials(displayName))
  }

  const name = document.createElement('span')
  name.textContent = displayName
  el.appendChild(name)

  return el
}

function buildAvatarInitials(name) {
  const el = document.createElement('span')
  el.className = 'jira-avatar-initials'
  el.textContent = (name || '?').charAt(0).toUpperCase()
  return el
}

function buildPriorityValue(priority) {
  const el = document.createElement('div')
  el.className = 'jira-panel-value jira-inline-row'

  if (!priority) {
    el.textContent = browser.i18n.getMessage('panelNoPriority')
    return el
  }

  if (priority.iconUrl) {
    const img = document.createElement('img')
    img.className = 'jira-icon'
    img.src = priority.iconUrl
    img.alt = ''
    img.onerror = () => img.remove()
    el.appendChild(img)
  }

  const name = document.createElement('span')
  name.textContent = priority.name || browser.i18n.getMessage('panelNoPriority')
  el.appendChild(name)

  return el
}

function buildDescriptionValue(text) {
  const el = document.createElement('div')
  el.className = 'jira-panel-description'
  el.textContent = text
  return el
}

function buildPanelFooter(jiraUrl) {
  const footer = document.createElement('div')
  footer.className = 'jira-panel-footer'

  const link = document.createElement('button')
  link.className = 'jira-panel-open-link'
  link.textContent = browser.i18n.getMessage('panelOpenInJira')
  link.addEventListener('click', (e) => {
    e.stopPropagation()
    browser.runtime.sendMessage({ type: 'OPEN_URL', payload: { url: jiraUrl } })
    closePanel()
  })
  footer.appendChild(link)

  return footer
}

function positionPanel(el, badgeRect) {
  const margin = 6
  const panelWidth = 360
  const maxPanelHeight = 480

  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth

  const availableBelow = viewportHeight - badgeRect.bottom - margin * 2
  const availableAbove = badgeRect.top - margin * 2

  el.style.top = ''
  el.style.bottom = ''

  if (availableBelow >= availableAbove || availableBelow >= 120) {
    const maxH = Math.min(maxPanelHeight, Math.max(availableBelow, 80))
    el.style.top = (badgeRect.bottom + margin) + 'px'
    el.style.maxHeight = maxH + 'px'
  } else {
    const maxH = Math.min(maxPanelHeight, Math.max(availableAbove, 80))
    el.style.bottom = (viewportHeight - badgeRect.top + margin) + 'px'
    el.style.maxHeight = maxH + 'px'
  }

  let left = badgeRect.left
  if (left + panelWidth > viewportWidth - margin) {
    left = viewportWidth - panelWidth - margin
  }
  if (left < margin) left = margin

  el.style.left = left + 'px'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusClass(statusCategory) {
  const map = {
    done:          'jira-status--done',
    indeterminate: 'jira-status--progress',
    new:           'jira-status--todo',
  }
  return map[statusCategory && statusCategory.key] || 'jira-status--todo'
}

function truncate(text, maxChars) {
  if (!text) return ''
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars).trimEnd() + '\u2026'
}

function extractDescriptionText(description) {
  if (!description) return ''
  if (typeof description === 'string') return description
  if (description.type === 'doc' && description.content) {
    return extractAdfText(description.content)
  }
  return ''
}

function extractAdfText(nodes) {
  if (!nodes) return ''
  return nodes.map(function (node) {
    if (node.type === 'text') return node.text || ''
    if (node.type === 'hardBreak') return '\n'
    if (node.content) return extractAdfText(node.content)
    return ''
  }).join('')
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

injectStyles()
enrichLinks()

window.addEventListener('unload', () => {
  hideTooltip()
  closePanel()
})
