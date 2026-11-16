// Text → glyphs for the compiled PDF. Each character is drawn from Courier Prime when it has it,
// otherwise from the Cousine fallback, otherwise as its nearest plain equivalent (a no-break space
// as a space…), otherwise as "?" — and every such character is reported, so the writer is told
// exactly which ones (never silently).
//
// The page layout (lib/screenplay.js) is untouched: every character keeps the one Courier cell it
// has always had, and Cousine's glyphs are drawn at exactly Courier Prime's advance. A combining
// accent typed as a separate character (é as e + ´) is composed first (NFC), so é, ñ and every
// Vietnamese letter print whole. An accent with no composed form (q́) can't be placed well
// without the font's positioning tables, so the letter prints without it and the accent is
// reported like any other character the PDF can't show.

/** Characters neither font has, written as their nearest plain equivalent. */
export const NEAR = {
  0x00a0: ' ', 0x2002: ' ', 0x2003: ' ', 0x2009: ' ', 0x200a: ' ', 0x202f: ' ', 0x2007: ' ', 0x2008: ' ',
  0x2010: '-', 0x2011: '-', 0x2012: '-', 0x2212: '-', 0x2015: '—',
  0x2032: "'", 0x2033: '"', 0x00ad: '',
};

const MARK = /\p{M}/u;
/** Zero-width characters that only steer layout (joiners, direction marks, BOM, variation selectors): never drawn. */
const INVISIBLE = (cp) => [0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2060, 0xfeff, 0x061c].includes(cp)
  || (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef);

/**
 * Split a run's text into glyph pieces.
 *   primary, fallback — parsed fonts (ttf.js); fallback may be null.
 * Returns { pieces: [{ font: 'primary'|'fallback', cell, glyphs: [{ gid, text }] }], unsupported: [char…] }
 *   cell — the Courier cell (0, 1, 2 …) the piece starts at, counted the way the PDF draws it.
 */
export function glyphRuns(text, primary, fallback = null) {
  const pieces = [];
  const unsupported = [];
  const question = primary.glyphOf(0x3f);
  let cell = 0;
  const put = (font, gid, ch) => {
    const last = pieces[pieces.length - 1];
    if (last && last.font === font) last.glyphs.push({ gid, text: ch });
    else pieces.push({ font, cell, glyphs: [{ gid, text: ch }] });
    cell += 1;
  };
  for (const ch of String(text).normalize('NFC')) {
    const cp = ch.codePointAt(0);
    if (cp < 0x20 || INVISIBLE(cp)) continue; // control characters (tabs are expanded before this)
    if (MARK.test(ch)) { unsupported.push(ch); continue; } // an accent left over after composing
    let g = primary.glyphOf(cp);
    if (g) { put('primary', g, ch); continue; }
    g = fallback ? fallback.glyphOf(cp) : 0;
    if (g) { put('fallback', g, ch); continue; }
    if (NEAR[cp] !== undefined) {
      for (const c of NEAR[cp]) put('primary', primary.glyphOf(c.codePointAt(0)), c);
      continue;
    }
    unsupported.push(ch);
    put('primary', question, '?');
  }
  return { pieces, unsupported };
}

/** Distinct characters, in the order first met. */
export const distinct = (chars) => [...new Set(chars)];

/** A PDF ToUnicode CMap for { gid → text }: copy, search and screen readers get the real characters. */
export function toUnicodeCMap(map) {
  const hex4 = (n) => n.toString(16).toUpperCase().padStart(4, '0');
  const utf16 = (s) => Array.from(s).map((c) => {
    const cp = c.codePointAt(0);
    if (cp <= 0xffff) return hex4(cp);
    const v = cp - 0x10000;
    return hex4(0xd800 + (v >> 10)) + hex4(0xdc00 + (v & 0x3ff));
  }).join('');
  const entries = [...map.entries()].sort((a, b) => a[0] - b[0]);
  let body = '';
  for (let i = 0; i < entries.length; i += 100) {
    const chunk = entries.slice(i, i + 100);
    body += `${chunk.length} beginbfchar\n${chunk.map(([g, t]) => `<${hex4(g)}> <${utf16(t)}>`).join('\n')}\nendbfchar\n`;
  }
  return '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n'
    + '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n'
    + '/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n'
    + '1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n'
    + `${body}endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n`;
}

/** Glyph ids as an Identity-H hex string: <0041004200C3>. */
export const hexGlyphs = (gids) => `<${gids.map((g) => g.toString(16).toUpperCase().padStart(4, '0')).join('')}>`;

/**
 * The note after a PDF export when some characters couldn't be shown, naming them:
 *   The PDF can't show 3 characters: 你, 好, ◌́. They print as "?" (accents are left off). Print Script… keeps them, in your computer's fonts.
 */
export function unsupportedMessage({ missing = 0, unsupported = [] }, max = 8) {
  const show = (c) => (MARK.test(c) ? `◌${c}` : c);
  const list = unsupported.slice(0, max).map(show).join(', ') + (unsupported.length > max ? ', …' : '');
  const marks = unsupported.some((c) => MARK.test(c));
  const letters = unsupported.some((c) => !MARK.test(c));
  const how = letters && marks ? 'They print as “?” (accents are left off).' : marks ? 'Those accents are left off.' : 'They print as “?”.';
  return `The PDF can’t show ${missing} character${missing === 1 ? '' : 's'}${list ? `: ${list}` : ''}. ${how} Print Script… keeps them, in your computer’s fonts.`;
}
