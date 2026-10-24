// WinAnsiEncoding (PDF's standard Latin text encoding): Unicode → one byte per character.
// Covers ASCII, Latin-1 (French, Spanish, Haitian Creole accents …) and the typographic
// extras in 0x80–0x9F: curly quotes, dashes, the ellipsis, € and so on.

const HIGH = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e,
  0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

/** Characters with no WinAnsi code, written as their nearest plain equivalent. */
const NEAR = {
  0x00a0: ' ', 0x2002: ' ', 0x2003: ' ', 0x2009: ' ', 0x200a: ' ', 0x202f: ' ', 0x2007: ' ', 0x2008: ' ',
  0x2010: '-', 0x2011: '-', 0x2012: '-', 0x2212: '-', 0x2015: '—',
  0x2032: "'", 0x2033: '"', 0x00ad: '',
};

/** The WinAnsi byte for code point `cp`, or -1. */
export function winAnsiCode(cp) {
  if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa1 && cp <= 0xff)) return cp;
  if (cp === 0xa0) return 0x20;
  return HIGH[cp] ?? -1;
}

/** Unicode code points (0x80–0x9F slots and their Unicode) for building a font's /Widths. */
export const WIN_ANSI_UNICODE = (() => {
  const out = new Map();
  for (let c = 0x20; c <= 0xff; c++) if (c <= 0x7e || c >= 0xa1) out.set(c, c);
  for (const [u, c] of Object.entries(HIGH)) out.set(c, Number(u));
  return out; // byte → code point
})();

/**
 * Text → WinAnsi bytes. Characters outside it are mapped to a near equivalent where there is
 * one, otherwise written as "?" — counted, so the caller can tell the writer.
 */
export function encodeWinAnsi(text) {
  const bytes = [];
  let missing = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    let code = winAnsiCode(cp);
    if (code < 0 && NEAR[cp] !== undefined) {
      for (const c of NEAR[cp]) bytes.push(winAnsiCode(c.codePointAt(0)));
      continue;
    }
    if (code < 0) {
      if (cp < 0x20) continue; // control characters (tabs are expanded before this)
      code = 0x3f;
      missing++;
    }
    bytes.push(code);
  }
  return { bytes, missing };
}
