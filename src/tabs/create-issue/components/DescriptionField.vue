<!--
/*
 *  ThunderJira [https://micz.it/thunderbird-addon-thunderjira/]
 *  Copyright (C) 2026 Mic (m@micz.it)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
-->

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useI18n } from '../../../shared/composables/useI18n.js'
import { useCreateIssueStore } from '../stores/create-issue.store.js'

const { t } = useI18n()
const createIssue = useCreateIssueStore()

// contenteditable root. The description is a plain-text region (white-space:
// pre-wrap renders newlines) that can also host pasted/dropped images as
// inline <img> elements. The store is the single source of truth via the
// ordered `descriptionBlocks` model; this component mirrors the DOM into it.
const editorEl = ref(null)

// id -> objectURL for every <img> currently rendered. Object URLs are revoked
// when the corresponding image is removed from the DOM (e.g. via Backspace).
const objectUrls = {}

// --- DOM <-> blocks ---

const BLOCK_TAGS = new Set(['DIV', 'P'])

// Walks the contenteditable DOM and produces the ordered block list the store
// understands. Text nodes accumulate into a text block; <img data-img-id> splits
// the text and becomes an image block. <br> elements are deliberately ignored:
// the only <br>s in this editor are Gecko's caret placeholders (real newlines
// are inserted as literal "\n" text nodes by the Enter handler), and counting
// them would produce spurious empty paragraphs around images in the ADF/wiki
// output.
function extractBlocks(root) {
  const blocks = []
  let textBuf = ''
  const flush = () => {
    if (textBuf) {
      blocks.push({ type: 'text', text: textBuf })
      textBuf = ''
    }
  }
  function walk(node) {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        textBuf += child.data
      } else if (child.nodeName === 'BR') {
        // Ignored — see comment above.
      } else if (child.nodeName === 'IMG') {
        const id = child.getAttribute('data-img-id')
        if (id) {
          flush()
          blocks.push({
            type: 'image',
            id,
            filename: child.getAttribute('data-filename') || ('image-' + id),
          })
        }
      } else {
        walk(child)
        if (BLOCK_TAGS.has(child.nodeName)) textBuf += '\n'
      }
    }
  }
  walk(root)
  flush()
  return blocks
}

// Renders the store's block model into the editor. Called once on mount.
function renderBlocks(blocks) {
  const el = editorEl.value
  if (!el) return
  el.replaceChildren()
  for (const block of blocks) {
    if (block.type === 'image') {
      const img = createImageElement(block.id, block.filename)
      el.appendChild(img)
    } else if (block.text) {
      // Skip empty text so the :empty placeholder can show for a blank field.
      el.appendChild(document.createTextNode(block.text))
    }
  }
}

function createImageElement(id, filename) {
  const img = document.createElement('img')
  img.setAttribute('data-img-id', id)
  img.setAttribute('data-filename', filename)
  img.className = 'desc-image'
  img.alt = filename
  const entry = createIssue.images[id]
  if (entry?.blob) {
    const url = URL.createObjectURL(entry.blob)
    objectUrls[id] = url
    img.src = url
  }
  return img
}

// Re-extracts blocks from the DOM, revokes object URLs for images that are no
// longer present, and pushes the result to the store.
function syncToStore() {
  const el = editorEl.value
  if (!el) return
  const blocks = extractBlocks(el)
  const present = new Set(blocks.filter((b) => b.type === 'image').map((b) => b.id))
  for (const id of Object.keys(objectUrls)) {
    if (!present.has(id)) {
      URL.revokeObjectURL(objectUrls[id])
      delete objectUrls[id]
    }
  }
  // When the editor is effectively empty, drop any stray <br>/empty text nodes
  // the browser may have left so the :empty placeholder can reappear.
  if (blocks.length === 0 && el.childNodes.length > 0) {
    el.replaceChildren()
  }
  createIssue.setDescriptionBlocks(blocks)
}

// --- Caret / insertion helpers ---

function insertNodeAtCaret(node) {
  const el = editorEl.value
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || !el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
    el.appendChild(node)
    moveCaretAfter(node)
    return
  }
  const range = sel.getRangeAt(0)
  range.deleteContents()
  range.insertNode(node)
  moveCaretAfter(node)
}

function moveCaretAfter(node) {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.setStartAfter(node)
  range.setEndAfter(node)
  sel.removeAllRanges()
  sel.addRange(range)
}

function placeCaretAtPoint(x, y) {
  const doc = editorEl.value.ownerDocument
  let range = null
  if (doc.caretRangeFromPoint) {
    range = doc.caretRangeFromPoint(x, y)
  } else if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y)
    if (pos) {
      range = doc.createRange()
      range.setStart(pos.offsetNode, pos.offset)
      range.collapse(true)
    }
  }
  const sel = window.getSelection()
  if (range && editorEl.value.contains(range.startContainer)) {
    sel.removeAllRanges()
    sel.addRange(range)
  } else {
    range = doc.createRange()
    range.selectNodeContents(editorEl.value)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
  }
}

// --- Image handling ---

function extFromType(type) {
  if (type === 'image/png') return 'png'
  if (type === 'image/jpeg') return 'jpg'
  if (type === 'image/gif') return 'gif'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/bmp') return 'bmp'
  if (type === 'image/svg+xml') return 'svg'
  return 'png'
}

// Inserts a single image file (Blob) at the current caret, registers it in the
// store, and syncs the block model. The image is display:block, so the caret
// lands cleanly right after it — no spacer text node is needed (a spacer would
// become its own paragraph in the ADF/wiki output).
function insertImageFile(file) {
  const { id, filename } = createIssue.addImage(file, extFromType(file.type))
  const img = createImageElement(id, filename)
  insertNodeAtCaret(img)
  syncToStore()
}

function getImagesFromDataTransfer(dataTransfer) {
  const files = []
  if (!dataTransfer) return files
  for (const item of (dataTransfer.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile()
      if (f) files.push(f)
    }
  }
  if (files.length) return files
  for (const f of (dataTransfer.files ?? [])) {
    if (f.type.startsWith('image/')) files.push(f)
  }
  return files
}

// --- Event handlers ---

function onKeydown(e) {
  // Insert a literal "\n" text node instead of letting Gecko insert a <div>/<br>
  // (or convert execCommand insertText '\n' into a <br>), so the DOM stays
  // text-node based and extractBlocks can ignore <br> placeholders entirely.
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    insertNodeAtCaret(document.createTextNode('\n'))
    syncToStore()
  }
}

function onPaste(e) {
  const images = getImagesFromDataTransfer(e.clipboardData)
  if (images.length) {
    e.preventDefault()
    for (const f of images) insertImageFile(f)
    return
  }
  // No image: insert the clipboard as a plain-text node (strips rich
  // formatting). Done via the range API rather than execCommand so newlines
  // stay as "\n" text and are never converted to <br> by Gecko.
  const text = e.clipboardData?.getData('text/plain') ?? ''
  if (text) {
    e.preventDefault()
    insertNodeAtCaret(document.createTextNode(text))
    syncToStore()
  }
}

function onDrop(e) {
  const images = getImagesFromDataTransfer(e.dataTransfer)
  if (!images.length) return
  e.preventDefault()
  editorEl.value?.focus()
  placeCaretAtPoint(e.clientX, e.clientY)
  for (const f of images) insertImageFile(f)
}

function onInput() {
  syncToStore()
}

onMounted(() => {
  renderBlocks(createIssue.descriptionBlocks)
})

// The email pre-fill (setDescriptionFromEmail) runs in the parent App's
// onMounted, which fires AFTER this child's onMounted. So at mount the blocks
// are usually still empty; watch for them arriving and render once — but only
// while the editor is empty, so we never clobber what the user has typed.
watch(() => createIssue.descriptionBlocks, (blocks) => {
  const el = editorEl.value
  if (!el) return
  if (el.childNodes.length === 0) renderBlocks(blocks)
})
</script>

<template>
  <div class="field-group">
    <label class="field-label">{{ t('labelDescription') }}</label>

    <div
      ref="editorEl"
      class="field-editor"
      contenteditable="true"
      spellcheck="true"
      role="textbox"
      aria-multiline="true"
      :data-placeholder="t('descriptionPlaceholder')"
      @keydown="onKeydown"
      @paste="onPaste"
      @drop="onDrop"
      @dragover.prevent
      @input="onInput"
    ></div>

    <p class="field-hint">{{ t('descImagesHint') }}</p>
  </div>
</template>

<style scoped>
.field-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.field-editor {
  width: 100%;
  min-height: 180px;
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  background: var(--color-bg);
  resize: vertical;
  overflow-y: auto;
  line-height: var(--line-height-normal);
  white-space: pre-wrap;
  word-break: break-word;
  transition: border-color var(--transition-fast);
}

.field-editor:focus {
  border-color: var(--color-border-focus);
  outline: none;
}

.field-editor:empty::before {
  content: attr(data-placeholder);
  color: var(--color-text-muted);
  pointer-events: none;
}

.desc-image {
  display: block;
  max-width: 100%;
  max-height: 240px;
  margin: var(--space-2) 0;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-sm);
}

.field-hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
</style>