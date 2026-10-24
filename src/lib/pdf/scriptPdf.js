// Compiled PDF: the screenplay laid out and written as a PDF here, in JavaScript, rather than
// by the browser's print dialog — so the file is the same on every machine and browser.
//
//   US Letter, Courier Prime 12 pt embedded (Regular, Bold, Italic, Bold Italic as needed),
//   6 lines to the inch, margins 1.5 in left (binding), 1 in right / top / bottom, so 54 lines
//   of text a page. Indents measured from the page's left edge: Character 3.7 in, Parenthetical
//   3.1 in, Dialogue 2.5 in (3.5 in wide); Transitions flush right in the 6 in text column.
//   Page numbers "2." … at the top right, 0.5 in down, from page 2 on; the title page (when
//   there is one) comes first, unnumbered.
//
// Page breaks come from the same paginate() as the editor (lib/screenplay.js), fed by the wrap
// model instead of browser measurements: the scene-heading and transition rules, and speeches
// split with (MORE) / NAME (CONT'D), all apply. Pure: no DOM, no fetch — fonts come in as bytes.

import {
  DUAL_CPL, ELEMENT_META, PAGE_LINES, buildItems, pageLabel, paginate, wrapOffsets,
} from '../screenplay.js';
import { parseInline, segments } from '../formatting.js';
import { basedOnLine } from '../fountain.js';
import { DEFAULT_CREDIT, draftLines, titleTypography } from '../titleFonts.js';
import { parseTTF } from './ttf.js';
import { WIN_ANSI_UNICODE, encodeWinAnsi } from './winAnsi.js';
import { createPdf, name, ref, serialize, textString } from './pdfWriter.js';

const IN = 72; // points
export const GEOMETRY = Object.freeze({
  pageWidth: 8.5 * IN,
  pageHeight: 11 * IN,
  left: 1.5 * IN,
  right: 1 * IN,
  top: 1 * IN,
  bottom: 1 * IN,
  fontSize: 12,
  line: 12, // 6 lines per inch
  pageNumberTop: 0.5 * IN,
});
const TEXT_LEFT = GEOMETRY.left;
const TEXT_RIGHT = GEOMETRY.pageWidth - GEOMETRY.right; // 7.5 in
const TEXT_WIDTH = TEXT_RIGHT - TEXT_LEFT; // 6 in
/** Courier Prime's advance (1228 / 2048 em): 0.1 in at 12 pt. */
const ADVANCE_EM = 1228 / 2048;
const charWidth = (size) => ADVANCE_EM * size;

/** Where each element sits, in points from the left edge of the page (CSS: Editor.css). */
const PLACE = {
  scene: { x: TEXT_LEFT, width: TEXT_WIDTH, upper: true, bold: true },
  action: { x: TEXT_LEFT, width: TEXT_WIDTH },
  character: { x: TEXT_LEFT + 2.2 * IN, width: 3.8 * IN, upper: true },
  parenthetical: { x: TEXT_LEFT + 1.6 * IN, width: 2.5 * IN },
  dialogue: { x: TEXT_LEFT + 1 * IN, width: 3.5 * IN },
  transition: { x: TEXT_LEFT, width: TEXT_WIDTH, upper: true, align: 'right' },
  format_cue: { x: TEXT_LEFT, width: TEXT_WIDTH, upper: true, bold: true },
  centered: { x: TEXT_LEFT, width: TEXT_WIDTH, align: 'center' },
};
/** Dual dialogue: two 3 in columns, each element 2.7 in wide; cues centred, parentheticals in 0.35 in. */
const DUAL_COL = 3 * IN;
const DUAL_PLACE = {
  character: { dx: 0, width: 2.7 * IN, upper: true, align: 'center' },
  parenthetical: { dx: 0.35 * IN, width: 2 * IN },
  dialogue: { dx: 0, width: 2.7 * IN },
};
const SEAM_X = TEXT_LEFT + 2.2 * IN; // (MORE) and NAME (CONT'D): at the Character indent
const SCENE_NO_LEFT_EDGE = TEXT_LEFT - 0.45 * IN; // right edge of the left scene number
const SCENE_NO_RIGHT_X = TEXT_RIGHT + 0.3 * IN;

/** Uppercase each character on its own (so offsets stay put: "ß" keeps one cell). */
const upper = (s) => Array.from(s, (c) => { const u = c.toUpperCase(); return u.length === 1 ? u : c; }).join('');
const lineTop = (topLine) => GEOMETRY.top + topLine * GEOMETRY.line;

export function hasTitlePage(meta = {}) {
  return ['title', 'author', 'basedOn', 'contact', 'draftVersion', 'draftDate'].some((k) => meta[k]?.trim());
}

/**
 * Runs for lines [from, to) of `text` (with inline `marks`) laid out at `place`, the first of
 * them `top` points from the top of the page. Each run: { x, top, text, b, i, u, s, size, lh }.
 */
function textRuns(text, marks, place, { from = 0, to = Infinity, top, cpl, size = GEOMETRY.fontSize, lh = GEOMETRY.line }) {
  const src = String(text || '').replace(/\t/g, ' ');
  if (!src.trim()) return [];
  const cw = charWidth(size);
  const lines = wrapOffsets(src, cpl);
  const segs = segments(src, marks);
  // style at each offset
  const styleAt = [];
  let o = 0;
  for (const sg of segs) { for (let k = 0; k < sg.text.length; k++) styleAt[o + k] = sg; o += sg.text.length; }
  const runs = [];
  lines.slice(from, to).forEach(([s, e0], n) => {
    let e = e0;
    while (e > s && src[e - 1] === ' ') e--; // trailing spaces don't count for alignment
    if (e <= s) return;
    const len = e - s;
    const x0 = place.align === 'right' ? place.x + place.width - len * cw
      : place.align === 'center' ? place.x + (place.width - len * cw) / 2
        : place.x;
    let k = s;
    while (k < e) {
      const st = styleAt[k] || { b: false, i: false, u: false, s: false };
      let j = k + 1;
      while (j < e && ['b', 'i', 'u', 's'].every((x) => (styleAt[j] || {})[x] === st[x])) j++;
      const piece = src.slice(k, j);
      runs.push({
        x: x0 + (k - s) * cw,
        top: top + n * lh,
        text: place.upper ? upper(piece) : piece,
        b: !!(st.b || place.bold),
        i: !!st.i,
        u: !!(st.u || place.underline),
        s: !!st.s,
        size,
        lh,
      });
      k = j;
    }
  });
  return runs;
}

const plainRun = (x, top, text, extra = {}) => ({ x, top, text, b: false, i: false, u: false, s: false, size: GEOMETRY.fontSize, lh: GEOMETRY.line, ...extra });

/** The title page's runs (Courier Prime throughout; the title in its chosen size, weight and case). */
function titlePageRuns(meta) {
  const runs = [];
  const { font, size, bold } = titleTypography(meta);
  const lh = size * 1.15;
  const title = parseInline(meta.title?.trim() || 'Untitled');
  const center = { x: TEXT_LEFT, width: TEXT_WIDTH, align: 'center' };
  const titleCpl = Math.max(1, Math.floor(TEXT_WIDTH / charWidth(size)));
  const titlePlace = { ...center, upper: font.upper, bold, underline: font.id === 'courier-prime' };
  const titleLines = wrapOffsets(title.text, titleCpl).length;
  let y = 3.5 * IN;
  runs.push(...textRuns(title.text, title.marks, titlePlace, { top: y, cpl: titleCpl, size, lh }));
  y += titleLines * lh + 4 * GEOMETRY.line;
  const field = (raw, top) => {
    const f = parseInline(raw);
    const lines = f.text.split('\n').length;
    runs.push(...textRuns(f.text, f.marks, center, { top, cpl: 60 }));
    return wrapOffsets(f.text, 60).length || lines;
  };
  const author = meta.author?.trim();
  if (author) {
    const credit = (meta.credit ?? DEFAULT_CREDIT).trim();
    if (credit) y += (field(credit, y) + 1) * GEOMETRY.line;
    y += field(author, y) * GEOMETRY.line;
  }
  const based = basedOnLine(meta.basedOn);
  if (based) field(based, y + 3 * GEOMETRY.line);

  // Bottom corners: contact (left, 3.5 in wide) and draft version / date (right, 2.75 in), resting on the bottom margin.
  const bottomBlock = (lines, place, cpl) => {
    const all = lines.flatMap((l) => {
      const f = parseInline(l);
      return f.text.split('\n').map((t) => t.trim());
    });
    const count = all.reduce((n, t) => n + Math.max(1, wrapOffsets(t, cpl).length), 0);
    let top = GEOMETRY.pageHeight - GEOMETRY.bottom - count * GEOMETRY.line;
    for (const t of all) {
      const f = parseInline(t);
      runs.push(...textRuns(f.text, f.marks, place, { top, cpl }));
      top += Math.max(1, wrapOffsets(t, cpl).length) * GEOMETRY.line;
    }
  };
  if (meta.contact?.trim()) bottomBlock([meta.contact.trim()], { x: TEXT_LEFT, width: 3.5 * IN }, 35);
  const draft = draftLines(meta);
  if (draft.length) bottomBlock(draft, { x: TEXT_RIGHT - 2.75 * IN, width: 2.75 * IN, align: 'right' }, 27);
  return runs;
}

/**
 * The page model: [{ label, title, runs }], the title page first when there is one, then every
 * script page with its runs. Exposed for tests; compileScriptPdf draws it.
 */
export function layoutScriptPdf({ meta = {}, blocks = [], sceneNumbers = {} } = {}) {
  const items = buildItems(blocks);
  const layout = paginate(items);
  const pages = Array.from({ length: layout.pageCount }, (_, p) => ({ label: pageLabel(p), title: false, runs: [] }));
  const on = (p) => pages[Math.min(p, pages.length - 1)].runs;

  items.forEach((it, k) => {
    const pl = layout.place[k];
    if (!pl) return;
    if (it.kind === 'dual') {
      const top = lineTop(pl.topLine);
      [it.left, it.right].forEach((col, c) => {
        let line = 0;
        for (const b of col) {
          const dp = DUAL_PLACE[b.type] || DUAL_PLACE.dialogue;
          const cpl = DUAL_CPL[b.type] || 27;
          const place = { ...dp, x: TEXT_LEFT + c * DUAL_COL + dp.dx };
          on(pl.page).push(...textRuns(b.text, b.marks, place, { top: top + line * GEOMETRY.line, cpl }));
          line += wrapOffsets(b.text || ' ', cpl).length;
        }
      });
      return;
    }
    const b = it.block;
    const place = PLACE[b.type] || PLACE.action;
    const cpl = ELEMENT_META[b.type]?.cpl || 60;
    const pieces = pl.pieces || [{ page: pl.page, topLine: pl.topLine, from: 0, to: Infinity, more: false, cont: null }];
    pieces.forEach((pc, n) => {
      const runs = on(pc.page);
      if (pc.cont) runs.push(plainRun(SEAM_X, lineTop(pc.topLine - 1), upper(pc.cont)));
      runs.push(...textRuns(b.text, b.marks, place, { from: pc.from, to: pc.to, top: lineTop(pc.topLine), cpl }));
      if (pc.more) runs.push(plainRun(SEAM_X, lineTop(pc.topLine + (pc.to - pc.from)), '(MORE)'));
      const no = n === 0 ? sceneNumbers[it.key] : undefined;
      if (no != null && b.type === 'scene') {
        const label = String(no);
        runs.push(plainRun(SCENE_NO_LEFT_EDGE - label.length * charWidth(12), lineTop(pc.topLine), label, { b: true }));
        runs.push(plainRun(SCENE_NO_RIGHT_X, lineTop(pc.topLine), label, { b: true }));
      }
    });
  });

  pages.forEach((pg, p) => {
    if (p > 0) pg.runs.unshift(plainRun(TEXT_RIGHT - pg.label.length * charWidth(12), GEOMETRY.pageNumberTop, pg.label));
  });
  const all = hasTitlePage(meta) ? [{ label: '', title: true, runs: titlePageRuns(meta) }, ...pages] : pages;
  return { pages: all, scriptPages: layout.pageCount, layout, linesPerPage: PAGE_LINES };
}

const FONT_KEYS = { '00': 'regular', '10': 'bold', '01': 'italic', '11': 'boldItalic' };
const fontKey = (r) => FONT_KEYS[`${r.b ? 1 : 0}${r.i ? 1 : 0}`];
const RES = { regular: 'F1', bold: 'F2', italic: 'F3', boldItalic: 'F4' };

const pdfDate = (ms) => {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
};

const fmt = (n) => (Math.round(n * 1000) / 1000).toString();

/**
 * Compile the script to PDF bytes.
 *   fonts: { regular, bold, italic, boldItalic } — Courier Prime .ttf bytes (only the styles the
 *          script uses are embedded; regular is always needed).
 *   deflate(bytes) → Promise<Uint8Array> (zlib) compresses the streams; omit it for plain ones.
 *   now: creation time (ms) for the document info; omit it and the file carries no date, so the
 *        same script always compiles to the same bytes.
 * Returns { bytes, pageCount, scriptPages, missing } — `missing`: characters the font's
 * encoding couldn't show (written as "?").
 */
export async function compileScriptPdf({ meta = {}, blocks = [], sceneNumbers = {}, fonts, deflate = null, now = null, appVersion = '' }) {
  if (!fonts?.regular) throw new Error('The PDF needs Courier Prime (Regular)');
  const model = layoutScriptPdf({ meta, blocks, sceneNumbers });
  const used = new Set(['regular']);
  for (const pg of model.pages) for (const r of pg.runs) used.add(fontKey(r));
  const parsed = {};
  for (const k of used) {
    const bytes = fonts[k] || fonts.regular; // a missing style falls back to Regular
    parsed[k] = parseTTF(bytes);
    if (!parsed[k].embeddable) throw new Error(`${parsed[k].postScriptName} doesn't allow embedding`);
  }

  const pdf = createPdf({ deflate });
  const catalog = pdf.reserve();
  const pagesId = pdf.reserve();

  // Fonts: simple TrueType fonts, WinAnsiEncoding, the whole font file embedded.
  const fontRefs = {};
  for (const k of ['regular', 'bold', 'italic', 'boldItalic']) {
    if (!used.has(k)) continue;
    const f = parsed[k];
    const file = pdf.add(await pdf.stream(f.bytes, { Length1: f.bytes.length }));
    const italic = f.italicAngle !== 0;
    const desc = pdf.add({
      Type: name('FontDescriptor'),
      FontName: name(f.postScriptName),
      Flags: 1 + 32 + (italic ? 64 : 0), // FixedPitch · Nonsymbolic · Italic
      FontBBox: f.bbox.map((x) => f.pdfUnits(x)),
      ItalicAngle: f.italicAngle,
      Ascent: f.pdfUnits(f.ascender),
      Descent: f.pdfUnits(f.descender),
      CapHeight: f.pdfUnits(f.capHeight),
      StemV: f.weightClass >= 600 ? 120 : 80,
      MissingWidth: 600,
      FontFile2: ref(file),
    });
    const widths = [];
    for (let c = 32; c <= 255; c++) {
      const cp = WIN_ANSI_UNICODE.get(c);
      widths.push((cp && f.widthOf(cp)) || 600);
    }
    fontRefs[k] = pdf.add({
      Type: name('Font'),
      Subtype: name('TrueType'),
      BaseFont: name(f.postScriptName),
      FirstChar: 32,
      LastChar: 255,
      Widths: widths,
      FontDescriptor: ref(desc),
      Encoding: name('WinAnsiEncoding'),
    });
  }
  const resources = { Font: Object.fromEntries(Object.entries(fontRefs).map(([k, id]) => [RES[k], ref(id)])) };

  let missing = 0;
  const kids = [];
  for (const pg of model.pages) {
    let ops = '0 g\n';
    for (const r of pg.runs) {
      const f = parsed[fontKey(r)];
      const em = r.size / f.unitsPerEm;
      const content = (f.ascender - f.descender) * em;
      const baseline = r.top + (r.lh - content) / 2 + f.ascender * em; // CSS line box → baseline
      const y = GEOMETRY.pageHeight - baseline;
      const { bytes, missing: m } = encodeWinAnsi(r.text);
      missing += m;
      ops += `BT /${RES[fontKey(r)]} ${fmt(r.size)} Tf ${fmt(r.x)} ${fmt(y)} Td ${serialize({ $bytes: bytes })} Tj ET\n`;
      const w = Array.from(r.text).length * charWidth(r.size);
      const t = f.underlineThickness * em;
      if (r.u) ops += `${fmt(r.x)} ${fmt(y + f.underlinePosition * em - t / 2)} ${fmt(w)} ${fmt(t)} re f\n`;
      if (r.s) ops += `${fmt(r.x)} ${fmt(y + (f.capHeight * em) / 2 - t / 2)} ${fmt(w)} ${fmt(t)} re f\n`;
    }
    const contents = pdf.add(await pdf.stream(ops));
    kids.push(pdf.add({
      Type: name('Page'),
      Parent: ref(pagesId),
      MediaBox: [0, 0, GEOMETRY.pageWidth, GEOMETRY.pageHeight],
      Resources: resources,
      Contents: ref(contents),
    }));
  }
  pdf.set(pagesId, { Type: name('Pages'), Kids: kids.map(ref), Count: kids.length });
  pdf.set(catalog, { Type: name('Catalog'), Pages: ref(pagesId) });
  const info = pdf.add({
    Title: textString(meta.title?.trim() || 'Untitled'),
    ...(meta.author?.trim() ? { Author: textString(meta.author.trim()) } : {}),
    Creator: textString(`DraftLine${appVersion ? ` ${appVersion}` : ''}`),
    Producer: textString('DraftLine compiled PDF'),
    ...(now != null ? { CreationDate: textString(pdfDate(now)) } : {}),
  });
  const bytes = await pdf.finish({ root: catalog, info });
  return { bytes, pageCount: model.pages.length, scriptPages: model.scriptPages, missing };
}
