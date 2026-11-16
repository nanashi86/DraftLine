import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import { GEOMETRY, compileScriptPdf, hasTitlePage, layoutScriptPdf } from '../src/lib/pdf/scriptPdf.js';
import { parseTTF } from '../src/lib/pdf/ttf.js';
import { PAGE_LINES, buildItems, paginate } from '../src/lib/screenplay.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const FONTS = {
  regular: read('src/assets/fonts/CourierPrime-Regular.ttf'),
  bold: read('src/assets/fonts/CourierPrime-Bold.ttf'),
  italic: read('src/assets/fonts/CourierPrime-Italic.ttf'),
  boldItalic: read('src/assets/fonts/CourierPrime-BoldItalic.ttf'),
};
const B = (id, type, text, extra = {}) => ({ id, type, text, ...extra });

/**
 * What an uncompressed PDF draws, read back the way a PDF viewer does: each text-showing operator's
 * glyph ids, through its font's ToUnicode map, with the font's BaseFont and the x / y it's drawn at.
 * → [{ res, font, x, y, gids, text }]
 */
function drawnText(bytes) {
  const s = latin1(bytes);
  const obj = (id) => { const m = new RegExp(`\\n${id} 0 obj\\n([\\s\\S]*?)\\nendobj`).exec(s); return m ? m[1] : ''; };
  const fonts = {};
  for (const [, res, id] of s.matchAll(/\/(F\d) (\d+) 0 R/g)) {
    if (fonts[res]) continue;
    const dict = obj(id);
    const cmap = obj(/\/ToUnicode (\d+) 0 R/.exec(dict)[1]);
    const map = new Map();
    for (const [, g, u] of cmap.matchAll(/<([0-9A-F]{4})> <([0-9A-F]+)>/g)) {
      map.set(parseInt(g, 16), String.fromCharCode(...u.match(/.{4}/g).map((h) => parseInt(h, 16))));
    }
    fonts[res] = { font: /\/BaseFont \/([\w-]+)/.exec(dict)[1], map, dict, w: obj(/\/DescendantFonts \[(\d+) 0 R\]/.exec(dict)[1]) };
  }
  return [...s.matchAll(/BT \/(F\d) [\d.]+ Tf ([\d.]+) ([\d.]+) Td <([0-9A-F]*)> Tj ET/g)].map(([, res, x, y, hex]) => {
    const gids = (hex.match(/.{4}/g) || []).map((h) => parseInt(h, 16));
    return { res, font: fonts[res].font, x: Number(x), y: Number(y), gids, text: gids.map((g) => fonts[res].map.get(g) ?? '\u0000').join(''), fonts };
  });
}
const COUSINE = {
  regular: read('src/assets/fonts/Cousine-Regular.ttf'),
  bold: read('src/assets/fonts/Cousine-Bold.ttf'),
  italic: read('src/assets/fonts/Cousine-Italic.ttf'),
  boldItalic: read('src/assets/fonts/Cousine-BoldItalic.ttf'),
};
const ALL_FONTS = { ...FONTS, fallback: COUSINE };
const IN = 72;
const latin1 = (u8) => Buffer.from(u8).toString('latin1');

/** A script whose lines are known: an action of `n` lines is n × 60 characters. */
const action = (id, n) => B(id, 'action', Array.from({ length: n }, (_, i) => `${String(i).padStart(2, '0')}${'x'.repeat(57)}`).join(' '));
const runsOn = (model, p) => model.pages[p].runs;
const textOn = (model, p) => runsOn(model, p).map((r) => r.text).join('\n');

describe('Compiled PDF: geometry', () => {
  it('US Letter, margins 1.5 / 1 / 1 / 1 in, Courier 12 pt at 6 lines an inch', () => {
    assert.deepEqual(
      [GEOMETRY.pageWidth, GEOMETRY.pageHeight, GEOMETRY.left, GEOMETRY.right, GEOMETRY.top, GEOMETRY.bottom, GEOMETRY.fontSize, GEOMETRY.line],
      [8.5 * IN, 11 * IN, 1.5 * IN, 1 * IN, 1 * IN, 1 * IN, 12, 12],
    );
    assert.equal(PAGE_LINES, 54, '9 in of text at 6 lines an inch: 54 lines, within the 55-line maximum');
  });

  it('indents from the page edge: Character 3.7 in, Parenthetical 3.1 in, Dialogue 2.5 in, Action 1.5 in, Transition flush right at 7.5 in', () => {
    const m = layoutScriptPdf({ blocks: [
      B('s', 'scene', 'INT. FERRY - NIGHT'), B('a', 'action', 'Rain.'),
      B('c', 'character', 'marie'), B('p', 'parenthetical', '(low)'), B('d', 'dialogue', 'Go.'),
      B('t', 'transition', 'cut to:'),
    ] });
    const at = (t) => runsOn(m, 0).find((r) => r.text === t);
    assert.equal(at('INT. FERRY - NIGHT').x, 1.5 * IN);
    assert.equal(at('Rain.').x, 1.5 * IN);
    assert.ok(Math.abs(at('MARIE').x - 3.7 * IN) < 1e-9, 'cue uppercased, at 3.7 in');
    assert.ok(Math.abs(at('(low)').x - 3.1 * IN) < 1e-9);
    assert.ok(Math.abs(at('Go.').x - 2.5 * IN) < 1e-9);
    const t = at('CUT TO:');
    assert.ok(Math.abs(t.x + 7 * (1228 / 2048) * 12 - 7.5 * IN) < 1e-6, 'right edge on the right margin');
    assert.equal(at('INT. FERRY - NIGHT').b, true, 'headings bold');
  });

  it('dialogue wraps at 3.5 in (35 characters); text never runs past 54 lines or into the margins', () => {
    const long = 'word '.repeat(60).trim();
    const m = layoutScriptPdf({ blocks: [B('c', 'character', 'A'), B('d', 'dialogue', long), action('x', 200)] });
    for (const r of runsOn(m, 0).filter((x) => x.top >= GEOMETRY.top && x.text.startsWith('word'))) {
      assert.ok(r.text.length <= 35);
      assert.ok(r.x + r.text.length * 7.2 <= 6 * IN + 1e-6, 'within 2.5 in + 3.5 in');
    }
    m.pages.forEach((pg, p) => {
      for (const r of pg.runs) {
        if (p > 0 && r.top === GEOMETRY.pageNumberTop) continue; // the page number, in the top margin
        assert.ok(r.top >= GEOMETRY.top, 'below the top margin');
        assert.ok(r.top + r.lh <= GEOMETRY.pageHeight - GEOMETRY.bottom + 1e-9, `page ${p + 1}: above the bottom margin`);
        assert.ok(r.x >= 1 * IN && r.x + Array.from(r.text).length * 7.2 <= 8 * IN, 'inside the paper');
      }
    });
  });

  it('page numbers: none on page 1, then "2." … top right, 0.5 in down, flush with the right margin', () => {
    const m = layoutScriptPdf({ blocks: [action('a', 50), action('b', 50), action('c', 50)] });
    assert.equal(m.pages.length, 3);
    assert.ok(!runsOn(m, 0).some((r) => r.top === GEOMETRY.pageNumberTop));
    for (const p of [1, 2]) {
      const n = runsOn(m, p).find((r) => r.top === GEOMETRY.pageNumberTop);
      assert.equal(n.text, `${p + 1}.`);
      assert.ok(Math.abs(n.x + n.text.length * 7.2 - 7.5 * IN) < 0.01);
    }
  });
});

describe('Compiled PDF: page breaks follow the editor’s pagination', () => {
  it('pages and line positions come from the same paginate() as the editor', () => {
    const blocks = [action('a', 30), B('s', 'scene', 'EXT. DOCK - DAY'), action('b', 40)];
    const layout = paginate(buildItems(blocks));
    const m = layoutScriptPdf({ blocks });
    assert.equal(m.scriptPages, layout.pageCount);
    const heading = m.pages.findIndex((pg) => pg.runs.some((r) => r.text === 'EXT. DOCK - DAY'));
    assert.equal(heading, layout.place[1].page);
    assert.equal(runsOn(m, heading).find((r) => r.text === 'EXT. DOCK - DAY').top, GEOMETRY.top + layout.place[1].topLine * 12);
  });

  it('a scene heading is never stranded: with fewer than 2 lines after it on the page, it opens the next', () => {
    // 49 lines used; the heading would sit on line 51 with one line of action under it.
    const blocks = [action('a', 49), B('s', 'scene', 'EXT. DOCK - DAY'), action('b', 6)];
    const m = layoutScriptPdf({ blocks });
    assert.ok(!textOn(m, 0).includes('EXT. DOCK - DAY'));
    const top = runsOn(m, 1).filter((r) => r.top >= GEOMETRY.top).sort((x, y) => x.top - y.top)[0];
    assert.equal(top.text, 'EXT. DOCK - DAY');
    assert.equal(top.top, GEOMETRY.top, 'at the top of page 2');
  });

  it('a long speech splits with (MORE) at the foot of the page and NAME (CONT\'D) at the top of the next', () => {
    const speech = Array.from({ length: 12 }, (_, i) => `Line ${String(i).padStart(2, '0')} of what she says, word for word.`).join(' ');
    const blocks = [action('a', 41), B('c', 'character', 'Fitoh (V.O.)'), B('d', 'dialogue', speech)];
    const layout = paginate(buildItems(blocks));
    const pcs = layout.place[2].pieces;
    assert.equal(pcs.length, 2, 'the editor splits it');
    const m = layoutScriptPdf({ blocks });
    const more = runsOn(m, 0).find((r) => r.text === '(MORE)');
    assert.ok(more, '(MORE) on page 1');
    assert.equal(more.top, GEOMETRY.top + (pcs[0].topLine + pcs[0].to - pcs[0].from) * 12, 'right under the last line');
    assert.ok(Math.abs(more.x - 3.7 * IN) < 1e-9);
    const cont = runsOn(m, 1).find((r) => r.text === "FITOH (V.O.) (CONT'D)");
    assert.ok(cont, 'NAME (CONT\'D) on page 2, keeping the extension');
    assert.equal(cont.top, GEOMETRY.top + (pcs[1].topLine - 1) * 12);
    const lines = (p) => runsOn(m, p).filter((r) => r.text.startsWith('Line') || /^of |word/.test(r.text)).length;
    assert.ok(lines(0) >= 2 && lines(1) >= 2, 'at least 2 dialogue lines each side');
  });

  it('the seam lines are layout only: the script blocks are unchanged', () => {
    const blocks = [action('a', 41), B('c', 'character', 'FITOH'), B('d', 'dialogue', 'Words. '.repeat(70).trim())];
    const before = JSON.stringify(blocks);
    layoutScriptPdf({ blocks });
    assert.equal(JSON.stringify(blocks), before);
  });

  it('dual dialogue: two 3 in columns, cues centred in each', () => {
    const m = layoutScriptPdf({ blocks: [
      B('c1', 'character', 'AUGUSTIN'), B('d1', 'dialogue', 'In this?'),
      B('c2', 'character', 'THEO', { dual: true }), B('d2', 'dialogue', 'Are you out of your mind?'),
    ] });
    const at = (t) => runsOn(m, 0).find((r) => r.text === t);
    assert.equal(at('In this?').x, 1.5 * IN);
    assert.equal(at('Are you out of your mind?').x, 4.5 * IN);
    assert.equal(at('AUGUSTIN').top, at('THEO').top, 'side by side');
    assert.ok(Math.abs(at('THEO').x - (4.5 * IN + (2.7 * IN - 4 * 7.2) / 2)) < 0.01);
  });

  it('the title page comes first, unnumbered, only when there is one', () => {
    assert.equal(hasTitlePage({}), false);
    const blocks = [action('a', 3)];
    assert.equal(layoutScriptPdf({ blocks }).pages.length, 1);
    const m = layoutScriptPdf({ meta: { title: 'The Last Ferry', author: 'Eric Lemaire Jr.', contact: 'eric@example.com', draftDate: 'October 2026' }, blocks });
    assert.equal(m.pages.length, 2);
    assert.equal(m.pages[0].title, true);
    const t = m.pages[0].runs.map((r) => r.text);
    for (const s of ['THE LAST FERRY', 'Written by', 'Eric Lemaire Jr.', 'eric@example.com', 'October 2026']) assert.ok(t.includes(s), s);
    assert.equal(m.pages[1].label, '', 'the first script page is still unnumbered');
  });
});

describe('Compiled PDF: the file', () => {
  const sample = () => [
    B('s', 'scene', 'EXT. HARBOR - DAWN'),
    B('a', 'action', 'Mist “over” the water — Marie’s café.', { marks: { i: [[0, 4]], u: [[5, 11]] } }),
    B('c', 'character', 'MARIE'), B('d', 'dialogue', 'We go now.'),
  ];

  it('is a well-formed PDF: every object where the cross-reference table says it is', async () => {
    const { bytes, pageCount } = await compileScriptPdf({ meta: { title: 'Ferry' }, blocks: sample(), fonts: FONTS });
    const s = latin1(bytes);
    assert.ok(s.startsWith('%PDF-1.4\n'));
    assert.ok(s.endsWith('%%EOF\n'));
    const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(s)[1]);
    assert.ok(s.slice(startxref).startsWith('xref\n0 '));
    const [, count] = /xref\n0 (\d+)\n/.exec(s.slice(startxref));
    const rows = s.slice(startxref).split('\n').slice(3, 2 + Number(count));
    rows.forEach((row, i) => {
      const off = Number(row.slice(0, 10));
      assert.ok(s.startsWith(`${i + 1} 0 obj\n`, off), `object ${i + 1} at ${off}`);
    });
    assert.equal(pageCount, 2, 'title page + 1');
    assert.equal((s.match(/\/Type \/Page\b/g) || []).length, 2);
    assert.match(s, /\/MediaBox \[0 0 612 792\]/);
  });

  it('embeds Courier Prime — only the styles the script uses — as Unicode (Type 0, Identity-H) fonts', async () => {
    const plain = latin1((await compileScriptPdf({ blocks: [B('a', 'action', 'Rain.')], fonts: ALL_FONTS })).bytes);
    assert.deepEqual([...new Set([...plain.matchAll(/\/BaseFont \/([\w-]+)/g)].map((m) => m[1]))], ['CourierPrime-Regular'], 'no Cousine when nothing needs it');
    const styled = latin1((await compileScriptPdf({ blocks: sample(), fonts: FONTS })).bytes);
    assert.deepEqual([...new Set([...styled.matchAll(/\/BaseFont \/([\w-]+)/g)].map((m) => m[1]))].sort(), ['CourierPrime-Bold', 'CourierPrime-Italic', 'CourierPrime-Regular']);
    assert.match(styled, /\/Subtype \/Type0 \/BaseFont \/CourierPrime-Regular \/Encoding \/Identity-H \/DescendantFonts \[\d+ 0 R\] \/ToUnicode \d+ 0 R/);
    assert.match(styled, /\/Subtype \/CIDFontType2/);
    assert.match(styled, /\/CIDToGIDMap \/Identity/);
    assert.match(styled, /\/FontFile2 \d+ 0 R/);
    assert.match(styled, new RegExp(`/Length1 ${FONTS.regular.length}\\b`), 'the whole font file');
    const widths = [...styled.matchAll(/\/W \[(.*?)\]\]/g)].flatMap((m) => [...m[1].matchAll(/\[([\d.]+)/g)].map((x) => Number(x[1])));
    assert.ok(widths.length > 10 && widths.every((w) => Math.abs(w - 599.61) < 0.01), 'monospaced: every advance 0.1 in at 12 pt');
  });

  it('draws the text it laid out, read back exactly as written: curly quotes, dashes, accents', async () => {
    const drawn = drawnText((await compileScriptPdf({ blocks: sample(), fonts: FONTS })).bytes);
    const heading = drawn.find((d) => d.text === 'EXT. HARBOR - DAWN');
    assert.ok(heading, 'the heading');
    assert.equal(heading.font, 'CourierPrime-Bold');
    assert.equal(heading.x, 108, 'at 1.5 in');
    const all = drawn.map((d) => d.text).join('');
    for (const t of ['“over”', '—', 'Marie’s café.']) assert.ok(all.includes(t), t);
    assert.ok(drawn.every((d) => d.gids.every((g) => g > 0)), 'every character a real glyph');
    assert.match(latin1((await compileScriptPdf({ blocks: sample(), fonts: FONTS })).bytes), /re f\n/, 'the underline is drawn');
  });

  it('the same script always compiles to the same bytes; the date only goes in when given', async () => {
    const a = await compileScriptPdf({ meta: { title: 'Ferry' }, blocks: sample(), fonts: FONTS });
    const b = await compileScriptPdf({ meta: { title: 'Ferry' }, blocks: sample(), fonts: FONTS });
    assert.deepEqual(a.bytes, b.bytes);
    assert.ok(!latin1(a.bytes).includes('CreationDate'));
    const c = await compileScriptPdf({ meta: { title: 'Ferry' }, blocks: sample(), fonts: FONTS, now: Date.UTC(2026, 9, 25, 9, 30) });
    assert.match(latin1(c.bytes), /\/CreationDate \(D:20261025093000Z\)/);
  });

  it('compressed streams inflate back to the same drawing', async () => {
    const plain = await compileScriptPdf({ blocks: sample(), fonts: FONTS });
    const packed = await compileScriptPdf({ blocks: sample(), fonts: FONTS, deflate: async (u) => new Uint8Array(deflateSync(u)) });
    assert.ok(packed.bytes.length < plain.bytes.length * 0.75, 'fonts and drawing compressed');
    const s = latin1(packed.bytes);
    const streams = [...s.matchAll(/\/Filter \/FlateDecode \/Length (\d+)>>\nstream\n/g)];
    const texts = streams.map((m) => inflateSync(Buffer.from(s.slice(m.index + m[0].length, m.index + m[0].length + Number(m[1])), 'latin1')).toString('latin1'));
    const plainDrawing = /stream\n(0 g\n[\s\S]*?)\nendstream/.exec(latin1(plain.bytes))[1];
    assert.ok(texts.includes(plainDrawing), 'the same drawing');
  });

  it('a 110-page script compiles in well under a few seconds', async () => {
    const blocks = [];
    for (let i = 0; blocks.length < 3300; i++) {
      blocks.push(B(`s${i}`, 'scene', `INT. ROOM ${i} - DAY`), action(`a${i}`, 2),
        B(`c${i}`, 'character', i % 2 ? 'MARIE' : 'THEO'), B(`d${i}`, 'dialogue', 'A line of dialogue that runs on for a while to wrap.'));
    }
    const t0 = performance.now();
    const r = await compileScriptPdf({ blocks, fonts: FONTS });
    assert.ok(r.scriptPages >= 110, `${r.scriptPages} pages`);
    assert.ok(performance.now() - t0 < 5000);
  });

  it('the font reader agrees with the font: 2048 units/em, 1228 advance, embeddable', () => {
    const f = parseTTF(FONTS.regular);
    assert.equal(f.unitsPerEm, 2048);
    assert.equal(f.widthOf(65), 599.61);
    assert.equal(f.embeddable, true);
    assert.equal(f.postScriptName, 'CourierPrime-Regular');
    assert.equal(parseTTF(FONTS.italic).italicAngle, -10);
  });
});

describe('Compiled PDF: export flow', () => {
  const app = read('src/App.jsx').toString();
  it('File → Export Script: PDF (compiled) · Final Draft · Fountain · Print Script…, no dividers between them', async () => {
    const { fileMenuItems } = await import('../src/lib/toolbar.js');
    const items = fileMenuItems({ onCompiledPdf() {}, onFdx() {}, onFountain() {}, onPrint() {}, snapshotCount: 0 });
    const at = items.findIndex((i) => i.heading === 'Export Script');
    const section = items.slice(at + 1, items.findIndex((i, n) => n > at && i.divider));
    assert.deepEqual(section.map((i) => [i.label, i.ext || i.hint]), [['PDF', '.pdf'], ['Final Draft', '.fdx'], ['Fountain', '.fountain'], ['Print Script…', 'Ctrl+P']], 'exactly four actions, no toggles');
    assert.ok(section.every((i) => !i.divider && !i.heading));
    assert.match(app, /onCompiledPdf: \(\) => setPdfOpen\(true\),/, 'File → PDF opens Export PDF first');
    assert.match(app, /onPrint: printScript,/);
  });
  it('compiles off the main thread and downloads <title>.pdf', () => {
    const asyncSrc = read('src/lib/pdf/compilePdfAsync.js').toString();
    assert.match(asyncSrc, /new Worker\(new URL\('\.\/pdf\.worker\.js', import\.meta\.url\), \{ type: 'module' \}\)/);
    assert.match(read('src/lib/pdf/pdf.worker.js').toString(), /self\.postMessage\(r, \[r\.bytes\.buffer\]\)/, 'the bytes are transferred, not copied');
    assert.match(app, /download\(name, r\.bytes, 'application\/pdf'\);\s*if \(r\.missing\)[^\n]*\n\s*showExportToast\(name\);/);
    assert.match(app, /const name = `\$\{slugify\(s\.meta\.title\)\}\.pdf`;/);
  });
  it('the fonts ship with the app (and its offline cache), under their licence', () => {
    for (const f of ['Regular', 'Bold', 'Italic', 'BoldItalic']) assert.ok(read(`src/assets/fonts/CourierPrime-${f}.ttf`).length > 50000);
    assert.match(read('src/assets/fonts/CourierPrime-OFL.txt').toString(), /SIL OPEN FONT LICENSE Version 1\.1/i);
  });
});

describe('Compiled PDF: Scene Numbers setting (spec by default)', () => {
  const app = read('src/App.jsx').toString();
  const blocks = [B('s1', 'scene', 'EXT. HARBOR - DAWN'), action('a1', 2), B('s2', 'scene', 'INT. FERRY - NIGHT'), action('a2', 2)];
  const sceneNumbers = { s1: 1, s2: 2 };
  const numberRuns = (m) => runsOn(m, 0).filter((r) => /^\d+$/.test(r.text));

  it('on: both margins of every scene heading, as before', () => {
    const m = layoutScriptPdf({ blocks, sceneNumbers, showSceneNumbers: true });
    assert.deepEqual(numberRuns(m).map((r) => r.text), ['1', '1', '2', '2']);
    assert.deepEqual(numberRuns(layoutScriptPdf({ blocks, sceneNumbers })).length, 4, 'the engine on its own still numbers what it is given');
  });
  it('off: no scene numbers anywhere, and nothing else on the page moves', () => {
    const on = layoutScriptPdf({ blocks, sceneNumbers, showSceneNumbers: true });
    const off = layoutScriptPdf({ blocks, sceneNumbers, showSceneNumbers: false });
    assert.deepEqual(numberRuns(off), []);
    assert.deepEqual(runsOn(off, 0), runsOn(on, 0).filter((r) => !/^\d+$/.test(r.text)));
  });
  it('off compiles to a valid PDF without the numbers', async () => {
    const r = await compileScriptPdf({ blocks, sceneNumbers, showSceneNumbers: false, fonts: FONTS, now: 0 });
    assert.equal(r.pageCount, 1);
    assert.ok(latin1(r.bytes).startsWith('%PDF-'));
  });
  it('a per-script setting, off for new and older scripts, saved with the project and in backups', async () => {
    const { EMPTY_META, META_FIELDS } = await import('../src/lib/projectStorage.js');
    assert.equal(EMPTY_META.showSceneNumbers, false);
    assert.ok(META_FIELDS.includes('showSceneNumbers'));
    assert.match(read('src/lib/folderSync.js').toString(), /'titleBold', 'showSceneNumbers'[,\]]/, 'kept in snapshot files too');
  });
  it('File → PDF opens Export PDF: the scene-numbers checkbox, Download PDF, Cancel / Esc / backdrop close', () => {
    const modal = read('src/components/ExportPdfModal.jsx').toString();
    assert.match(modal, /<h2 id="xp-title" className="xp-title">Export PDF<\/h2>/);
    assert.match(modal, /<input type="checkbox" checked=\{showSceneNumbers\} onChange=\{\(e\) => onChange\(e\.target\.checked\)\} \/>/);
    assert.match(modal, /<b>Include Scene Numbers \(Production Draft\)<\/b>\s*<small>Leave unchecked for spec script and competition submissions\.<\/small>/);
    assert.match(modal, /<button type="submit" className="btn xp-download" autoFocus>\s*<Download \{\.\.\.ICON\} \/>\s*Download PDF/);
    assert.match(modal, /onSubmit=\{\(e\) => \{\s*e\.preventDefault\(\);\s*onDownload\(\);/, 'Enter downloads');
    assert.match(modal, /onCancel=\{\(e\) => \{\s*e\.preventDefault\(\);\s*onClose\(\);/, 'Esc closes');
    assert.match(modal, /if \(e\.target === dialogRef\.current\) onClose\(\);/, 'clicking the backdrop closes');
    assert.match(modal, /onClick=\{onClose\}>Cancel<\/button>/);
  });
  it('the choice is saved with the script and the PDF compiles with it', () => {
    assert.match(app, /const setSceneNumbers = \(on\) => setMeta\(\(m\) => \(\{ \.\.\.m, showSceneNumbers: on \}\)\);/);
    assert.match(app, /<ExportPdfModal\s*showSceneNumbers=\{!!meta\.showSceneNumbers\}\s*onChange=\{setSceneNumbers\}\s*onClose=\{\(\) => setPdfOpen\(false\)\}\s*onDownload=\{\(\) => \{\s*setPdfOpen\(false\);\s*exportCompiledPdf\(\{ showSceneNumbers: !!meta\.showSceneNumbers \}\);/);
    assert.match(app, /sceneNumbers: analysis\.sceneNumbers, showSceneNumbers, appVersion/);
    assert.match(read('src/lib/pdf/compilePdfAsync.js').toString(), /sceneNumbers: \{ \.\.\.sceneNumbers \}, showSceneNumbers, now/, 'the option reaches the worker');
  });
  it('Print Script… (Ctrl+P) has no dialog and follows the setting through the print stylesheet', () => {
    assert.match(app, /<PrintView meta=\{meta\} items=\{items\} layout=\{layout\} sceneNumbers=\{analysis\.sceneNumbers\} showSceneNumbers=\{!!meta\.showSceneNumbers\} \/>/);
    assert.match(app, /onPrint: printScript,/);
    assert.doesNotMatch(app.slice(app.indexOf('const printScript = () => {'), app.indexOf('const printScript = () => {') + 200), /setPdfOpen/);
    assert.match(read('src/components/PrintView.jsx').toString(), /className=\{`print-root\$\{showSceneNumbers \? '' : ' hide-print-scene-numbers'\}`\}/);
    const css = read('src/components/PrintView.css').toString();
    const print = css.slice(css.indexOf('@media print'));
    assert.match(print, /\.hide-print-scene-numbers \.scene-no \{ display: none !important; \}/);
    assert.match(app, /sceneNumbers=\{analysis\.sceneNumbers\}\n/, 'the editor keeps its numbers');
  });
});

describe('Compiled PDF: Unicode text', () => {
  const compile = (text, fonts = ALL_FONTS, type = 'action') => compileScriptPdf({ blocks: [B('a', type, text)], fonts });
  const drawn = async (text, fonts, type) => {
    const r = await compile(text, fonts, type);
    const d = drawnText(r.bytes);
    return { r, d, text: d.map((x) => x.text).join(''), fontsUsed: [...new Set(d.map((x) => x.font))] };
  };
  const shows = async (text, expectFonts) => {
    const { r, text: got, fontsUsed, d } = await drawn(text);
    assert.equal(r.missing, 0, `${text}: nothing missing`);
    assert.equal(got.replace(/\s+/g, ' ').trim(), text, 'copy / search give back the same text');
    assert.ok(d.every((x) => x.gids.every((g) => g > 0)), 'every character a real glyph');
    assert.deepEqual(fontsUsed.sort(), expectFonts.sort());
  };

  it('Latin accents and typographic punctuation: Courier Prime', async () => {
    await shows('Café naïve façade Ångström São Kraków', ['CourierPrime-Regular']);
    await shows('“quoted” ‘single’ — – … € £ ™ ©', ['CourierPrime-Regular']);
  });
  it('Latin Extended-A (Polish, Czech, Turkish, Hungarian): Courier Prime, which already had them', () => shows('Łódź Dvořák İstanbul ğış Őrület žluťoučký', ['CourierPrime-Regular']));
  it('Latin Extended-B and Vietnamese: Cousine for the letters Courier Prime lacks', () => shows('București ș ț Tiếng Việt Hội An ǎ', ['CourierPrime-Regular', 'Cousine-Regular']));
  it('Greek and Cyrillic', async () => {
    await shows('Γειά σου, κόσμε!', ['CourierPrime-Regular', 'Cousine-Regular']);
    await shows('Привет, мир! Київ Ђорђе', ['CourierPrime-Regular', 'Cousine-Regular']);
  });
  it('bold, italic and capitals keep their style in the fallback too (a Cyrillic scene heading is bold)', async () => {
    const { d } = await drawn('INT. МОСКВА - NIGHT', ALL_FONTS, 'scene');
    assert.deepEqual([...new Set(d.map((x) => x.font))].sort(), ['CourierPrime-Bold', 'Cousine-Bold']);
    assert.equal(d.map((x) => x.text).join(''), 'INT. МОСКВА - NIGHT');
  });
  it('mixed-language dialogue keeps every character in its Courier cell: the page layout is unchanged', async () => {
    const text = 'Hello / Γειά / Привет / Łódź';
    const { d } = await drawn(text, ALL_FONTS, 'dialogue');
    const cw = (1228 / 2048) * 12;
    const start = d[0].x;
    let cell = 0;
    for (const piece of d) {
      assert.ok(Math.abs(piece.x - (start + cell * cw)) < 0.01, `“${piece.text}” at cell ${cell}`);
      cell += Array.from(piece.text).length;
    }
    assert.equal(cell, Array.from(text).length);
    const fallbackW = [...new Set(d.filter((x) => x.font.startsWith('Cousine')).map((x) => x.fonts[x.res].w))][0];
    assert.ok([...fallbackW.matchAll(/\[([\d.]+)\]/g)].every((m) => m[1] === '599.61'), 'Cousine drawn at Courier Prime’s exact advance');
  });
  it('combining accents are composed: e + ´ prints as é', () => shows('Café Zoë ñ'.normalize('NFC'), ['CourierPrime-Regular']));
  it('an accent with no composed form is left off and reported, never drawn out of place', async () => {
    const { r, text } = await drawn('q́ ok');
    assert.equal(text, 'q ok');
    assert.equal(r.missing, 1);
    assert.deepEqual(r.unsupported, ['́']);
  });
  it('CJK, Hebrew, Arabic, Devanagari and emoji aren’t in either font: drawn as "?" and reported by name', async () => {
    const { r, text } = await drawn('你好 שלום مرحبا नमस्ते 🎬');
    assert.equal(r.missing, 2 + 4 + 5 + 6 + 1);
    assert.equal(text, '?? ???? ????? ???? ?', 'one "?" per character; Devanagari\'s two vowel signs are accents, left off');
    assert.deepEqual(r.unsupported.slice(0, 3), ['你', '好', 'ש']);
    assert.ok(r.unsupported.includes('🎬'));
  });
  it('the export message names the characters and points to Print Script…', async () => {
    const { unsupportedMessage } = await import('../src/lib/pdf/glyphs.js');
    assert.equal(unsupportedMessage({ missing: 3, unsupported: ['你', '好'] }), 'The PDF can’t show 3 characters: 你, 好. They print as “?”. Print Script… keeps them, in your computer’s fonts.');
    assert.equal(unsupportedMessage({ missing: 1, unsupported: ['́'] }), 'The PDF can’t show 1 character: ◌́. Those accents are left off. Print Script… keeps them, in your computer’s fonts.');
    assert.match(unsupportedMessage({ missing: 20, unsupported: [...'abcdefghij'] }), /: a, b, c, d, e, f, g, h, …\./);
    assert.match(read('src/App.jsx').toString(), /if \(r\.missing\) notify\(pdfUnsupportedMessage\(r\), 9000\);/);
  });
  it('without the fallback fonts it still compiles, and reports Greek as unsupported rather than guessing', async () => {
    const { r, text } = await drawn('Γειά ok', FONTS);
    assert.equal(text, '???? ok');
    assert.deepEqual(r.unsupported, ['Γ', 'ε', 'ι', 'ά']);
  });
  it('invisible layout characters (joiners, direction marks, variation selectors) are skipped, not reported', async () => {
    const { r, text } = await drawn('a​b‎c️');
    assert.equal(text, 'abc');
    assert.equal(r.missing, 0);
  });
  it('the script itself is never changed by compiling', async () => {
    const blocks = [B('a', 'action', 'Café 你好 Γειά')];
    const before = JSON.stringify(blocks);
    await compileScriptPdf({ blocks, fonts: ALL_FONTS });
    assert.equal(JSON.stringify(blocks), before);
  });
  it('Cousine ships beside Courier Prime under the same licence (OFL), loaded by the PDF worker', () => {
    for (const f of ['Regular', 'Bold', 'Italic', 'BoldItalic']) {
      const t = parseTTF(COUSINE[f.charAt(0).toLowerCase() + f.slice(1)]);
      assert.equal(t.embeddable, true);
      assert.equal(t.widthOf(0x0416), 600.1, 'Ж: Cousine’s own advance (the PDF draws it at Courier Prime’s)');
      assert.ok(!t.glyphOf(0x05d0), 'no Hebrew: it needs right-to-left layout');
      assert.ok(!t.glyphOf(0x0041), 'only what Courier Prime lacks');
    }
    assert.match(read('src/assets/fonts/Cousine-OFL.txt').toString(), /SIL Open Font License, Version 1\.1/);
    assert.match(read('src/lib/pdf/pdf.worker.js').toString(), /const fonts = await loadPdfFonts\(\);/);
  });
});
