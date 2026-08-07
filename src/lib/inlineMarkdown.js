// Advisor replies come back as light markdown. The renderer used to split on
// `**bold**` only, so Claude's single-asterisk emphasis reached the screen with
// its asterisks intact — "*before* attacking your credit card". That reads as
// broken output, and Claude uses italics constantly.
//
// This is deliberately not a markdown parser. It handles the two inline marks
// that actually show up in advisor prose and leaves everything else as text.

// Bold is listed first so `**x**` never matches as italic-empty-italic.
// Italic requires a non-space, non-asterisk character after the opening mark so
// that arithmetic ("$5 * 3") and stray bullets are left alone.
const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/

/**
 * Split a line into typed inline tokens.
 * @returns {{type: 'text'|'bold'|'italic', value: string}[]}
 */
export function splitInlineMarkdown(text) {
  if (!text) return []
  return String(text)
    .split(INLINE)
    .filter(part => part !== '')
    .map(part => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return { type: 'bold', value: part.slice(2, -2) }
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return { type: 'italic', value: part.slice(1, -1) }
      }
      return { type: 'text', value: part }
    })
}
