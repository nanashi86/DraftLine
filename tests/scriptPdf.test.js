import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import { GEOMETRY, compileScriptPdf, hasTitlePage, layoutScriptPdf } from '../src/lib/pdf/scriptPdf.js';
import { parseTTF } from '../src/lib/pdf/ttf.js';
import { encodeWinAnsi } from '../src/lib/pdf/winAnsi.js';
import { PAGE_LINES, buildItems, paginate } from '../src/lib/screenplay.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const FONTS = {
  regular: read('src/assets/fonts/CourierPrime-Regular.ttf'),
  bold: read('src/assets/fonts/CourierPrime-Bold.ttf'),
  italic: read('src/assets/fonts/CourierPrime-Italic.ttf'),
  boldItalic: read('src/assets/fonts/CourierPrime-BoldItalic.ttf'),
};
const B = (id, type, text, extra = {}) => ({ id, type, text, ...extra });
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

  it('embeds Courier Prime — only the styles the script uses — as WinAnsi TrueType fonts', async () => {
    const plain = latin1((await compileScriptPdf({ blocks: [B('a', 'action', 'Rain.')], fonts: FONTS })).bytes);
    assert.deepEqual([...plain.matchAll(/\/BaseFont \/([\w-]+)/g)].map((m) => m[1]), ['CourierPrime-Regular']);
    const styled = latin1((await compileScriptPdf({ blocks: sample(), fonts: FONTS })).bytes);
    assert.deepEqual([...styled.matchAll(/\/BaseFont \/([\w-]+)/g)].map((m) => m[1]).sort(), ['CourierPrime-Bold', 'CourierPrime-Italic', 'CourierPrime-Regular']);
    assert.match(styled, /\/Subtype \/TrueType/);
    assert.match(styled, /\/Encoding \/WinAnsiEncoding/);
    assert.match(styled, /\/FontFile2 \d+ 0 R/);
    assert.match(styled, new RegExp(`/Length1 ${FONTS.regular.length}\\b`), 'the whole font file');
    const widths = /\/FirstChar 32 \/LastChar 255 \/Widths \[([^\]]+)\]/.exec(styled)[1].trim().split(/\s+/);
    assert.equal(widths.length, 224);
    assert.ok(widths.every((w) => Math.abs(Number(w) - 600) < 0.5), 'monospaced: every advance 0.1 in at 12 pt (600 for the five codes WinAnsi leaves unused)');
  });

  it('draws the text it laid out, with curly quotes, dashes and accents in WinAnsi', async () => {
    const { bytes } = await compileScriptPdf({ blocks: sample(), fonts: FONTS });
    const s = latin1(bytes);
    assert.match(s, /BT \/F2 12 Tf 108 [\d.]+ Td \(EXT\. HARBOR - DAWN\) Tj ET/, 'bold heading at 1.5 in');
    assert.ok(s.includes('\\223over\\224'), 'curly quotes as WinAnsi 0x93 / 0x94');
    assert.ok(s.includes('\\227'), 'em dash 0x97');
    assert.ok(s.includes('caf\\351'), 'é');
    assert.match(s, /re f\n/, 'the underline is drawn');
    assert.deepEqual(encodeWinAnsi('漢 a').missing, 1, 'outside the font: written as ? and counted');
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
    assert.ok(texts.some((t) => t.includes('(EXT. HARBOR - DAWN) Tj')));
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
    assert.deepEqual(section.map((i) => [i.label, i.ext || i.hint]), [['PDF', '.pdf'], ['Final Draft', '.fdx'], ['Fountain', '.fountain'], ['Print Script…', 'Ctrl+P']]);
    assert.ok(section.every((i) => !i.divider && !i.heading));
    assert.match(app, /onCompiledPdf: exportCompiledPdf,/);
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
