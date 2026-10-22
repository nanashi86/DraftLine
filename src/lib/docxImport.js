// Word (.docx) → the plain text the importer reads (lib/textScriptParser.js).
//
// In a screenplay typed in Word each line is its own paragraph, the blank lines between elements
// are empty paragraphs, and a character name sometimes sits above its dialogue with a soft line
// break (Shift+Enter) instead. mammoth's HTML keeps all three — <p>…</p>, <p></p>, <br /> — so the
// text is rebuilt from it one line per paragraph (mammoth's plain-text mode drops the soft breaks
// and would run "THEO" into "Not tonight."):
//
//   Word:   [INT. KITCHEN - NIGHT] [] [Rosa stirs a pot.] [] [ROSA ⏎ You're late.]
//   text:   INT. KITCHEN - NIGHT\n\nRosa stirs a pot.\n\nROSA\nYou're late.
//
// mammoth itself is large, so it's loaded only when a .docx is actually imported.

const PARA_END = '\u0001';
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') {
    const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  }
  return ENTITIES[e.toLowerCase()] ?? m;
});

/** mammoth's HTML → one line per Word paragraph, soft breaks kept, empty paragraphs → blank lines. */
export function docxHtmlToScript(html) {
  return decode(
    String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|h[1-6]|li|td)>/gi, PARA_END)
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\u00A0/g, ' ') // Word's non-breaking spaces
    .split(PARA_END)
    .map((p) => p.replace(/[ \t]+$/gm, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // runs of empty paragraphs → one blank line
    .replace(/^\s*\n/, '')
    .trimEnd();
}

/** A File / Blob → ArrayBuffer, with FileReader (the importer's other files use file.text()). */
export function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('The file couldn’t be read.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * A .docx's contents → { text, warnings }: the script as plain text for the importer.
 *   input: an ArrayBuffer (the browser) or { buffer } (Node, tests)
 *   mammoth: passed in by tests; otherwise loaded on first use
 */
export async function docxToScriptText(input, mammoth) {
  const lib = mammoth || (await import('mammoth')).default;
  const source = input instanceof ArrayBuffer ? { arrayBuffer: input } : input;
  let result;
  try {
    result = await lib.convertToHtml(source, { ignoreEmptyParagraphs: false });
  } catch {
    throw new Error('That Word file couldn’t be read. If it opens in Word, try File → Save As → Word Document (.docx), or copy and paste the script here.');
  }
  return { text: docxHtmlToScript(result.value), warnings: (result.messages || []).map((m) => m.message) };
}
