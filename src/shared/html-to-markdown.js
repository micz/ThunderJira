import TurndownService from 'turndown'

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  hr: '---',
})

/**
 * Convert an HTML string to Markdown.
 * Returns an empty string if the input is empty or falsy.
 */
export function htmlToMarkdown(html) {
  if (!html) return ''
  return turndown.turndown(html)
}
