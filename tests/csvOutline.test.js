import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CSV_COLUMNS, csvField, csvOutlineFileName, outlineCsv, outlineRows, stripSceneNumber, titleSceneNumber,
} from '../src/lib/exportCsvOutline.js';
import { VALUE_SHIFTS, normalizeBeat, normalizeBeats, setValueShift, valueShiftInfo } from '../src/lib/beats.js';
import { serializeBackup, parseBackup } from '../src/lib/backup.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const beats = [
  { id: 'b3', act: 2, title: 'Father, at the bow', synopsis: '', tags: ['character', 'theme'], valueShift: '--' },
  { id: 'b1', act: 0, title: 'Flight at dawn', synopsis: 'Marie slips out, "quietly".', tags: ['plot'], sceneId: 's1', valueShift: '+-' },
  { id: 'b2', act: 1, title: 'The letter', synopsis: 'Line one\nline two', tags: [] },
];
const scenes = [{ id: 's1', number: 1, heading: 'EXT. HARBOR - DAWN', page: 1 }];

describe('Scene outline → Spreadsheet (.csv)', () => {
  it('the columns, in order', () => {
    assert.deepEqual(CSV_COLUMNS, ['Scene Number', 'Act', 'Heading', 'Summary', 'Tags', 'Value Shift', 'Page']);
  });
  it('one row per card, act by act; linked cards take the scene’s number, heading and page', () => {
    const rows = outlineRows(beats, { scenes, mode: 4 });
    assert.deepEqual(rows[0], CSV_COLUMNS);
    assert.deepEqual(rows.slice(1).map((r) => r[2]), ['EXT. HARBOR - DAWN', 'The letter', 'Father, at the bow'], 'board order');
    assert.deepEqual(rows[1], [1, 'Act 1: Setup', 'EXT. HARBOR - DAWN', 'Flight at dawn — Marie slips out, "quietly".', 'Plot', '+ / − (Conflict / Setback)', 1]);
    assert.deepEqual(rows[3], [3, 'Act 2B: Fall & Crisis', 'Father, at the bow', '', 'Character; Theme', '− / − (Warning: Static)', ''], 'unlinked, no number in its title: its place in the outline');
    assert.equal(outlineRows(beats, { scenes, mode: 3 })[3][1], 'Act 2: Confrontation', 'acts named for the 3-act board');
  });
  it('Scene Number falls back to the title’s leading number, then the row’s place; Heading drops a "13. " prefix', () => {
    const cards = [
      { id: 'a', act: 0, title: '13. INT. KITCHEN - NIGHT', synopsis: 'Rosa waits.', tags: [] },
      { id: 'b', act: 0, title: '26 EXT. ROOF - DAY', synopsis: '', tags: [] },
      { id: 'c', act: 1, title: 'The letter', synopsis: '', tags: [] },
      { id: 'd', act: 1, title: '31. INT. FERRY - NIGHT', synopsis: 'Storm.', tags: [], sceneId: 's9' },
      { id: 'e', act: 2, title: '1986 coup', synopsis: '', tags: [] },
    ];
    const rows = outlineRows(cards, { scenes: [{ id: 's9', number: 42, heading: 'INT. FERRY - NIGHT', page: 7 }], mode: 4 }).slice(1);
    assert.deepEqual(rows.map((r) => [r[0], r[2]]), [
      ['13', 'INT. KITCHEN - NIGHT'], ['26', 'EXT. ROOF - DAY'], [3, 'The letter'], [42, 'INT. FERRY - NIGHT'], [5, '1986 coup'],
    ]);
    assert.equal(rows[3][3], 'Storm.', 'a generated "31. …" title matching its scene isn’t repeated in Summary');
    assert.equal(titleSceneNumber('42. INT. X'), '42');
    assert.equal(titleSceneNumber('INT. X'), '');
    assert.equal(stripSceneNumber('  13.  INT. X '), 'INT. X');
    assert.equal(stripSceneNumber('Flight at dawn'), 'Flight at dawn');
    assert.equal(stripSceneNumber('1986 coup'), '1986 coup', 'a year, not a scene number');
  });
  it('proper CSV: quoting, doubled quotes, line breaks kept, CRLF rows, a BOM for Excel', () => {
    assert.equal(csvField('a,b'), '"a,b"');
    assert.equal(csvField('say "hi"'), '"say ""hi"""');
    assert.equal(csvField('x\ny'), '"x\ny"');
    assert.equal(csvField(7), '7');
    const csv = outlineCsv(beats, { scenes });
    assert.ok(csv.startsWith('﻿Scene Number,Act,Heading,Summary,Tags,Value Shift,Page\r\n'));
    assert.ok(csv.includes('"Flight at dawn — Marie slips out, ""quietly""."'));
    assert.ok(csv.includes('"Line one\nline two"'));
    assert.ok(csv.endsWith('\r\n'));
  });
  it('named "{title}_Scene_Outline.csv"', () => {
    assert.equal(csvOutlineFileName('The Last Ferry'), 'The_Last_Ferry_Scene_Outline.csv');
    assert.equal(csvOutlineFileName('What Happened to Haiti?'), 'What_Happened_to_Haiti_Scene_Outline.csv');
    assert.equal(csvOutlineFileName(''), 'Untitled_Scene_Outline.csv');
  });
  it('File ▸ the three outlines, each wired to its own exporter; and the board’s own Export Outline', () => {
    const tb = read('lib/toolbar.js');
    assert.match(tb, /\{ label: 'Spreadsheet Outline', ext: '\.csv', onSelect: onOutlineCsv,/);
    assert.match(tb, /\{ label: 'Markdown Outline', ext: '\.md', onSelect: onOutlineMd,/);
    assert.match(tb, /\{ label: 'Fountain Outline', ext: '\.fountain', onSelect: onOutlineFountain,/);
    const app = read('App.jsx');
    assert.match(app, /onOutlineCsv: \(\) => exportOutline\('csv'\),\s*onOutlineMd: \(\) => exportOutline\('md'\),\s*onOutlineFountain: \(\) => exportOutline\('fountain'\),/);
    // each kind has its own branch: an unknown kind writes nothing rather than a Fountain file
    assert.match(app, /if \(kind === 'csv'\)[\s\S]*?else if \(kind === 'md'\)[\s\S]*?else if \(kind === 'fountain'\)/);
    assert.match(read('App.jsx'), /download\(name, outlineCsv\(beats, \{ scenes: boardScenes, mode: actMode \}\), 'text\/csv;charset=utf-8'\);/);
    assert.match(read('components/BeatBoard.jsx'), /\{ label: 'Spreadsheet', hint: '\.csv', onSelect: \(\) => onExport\('csv'\) \},/);
  });
});

describe('Scene Board: Value Shift', () => {
  it('four shifts; the two that don’t turn are warnings', () => {
    assert.deepEqual(VALUE_SHIFTS.map((v) => [v.id, v.hint, v.static]), [
      ['+-', 'Conflict / Setback', false], ['-+', 'Small Win / Insight', false], ['++', 'Warning: Static', true], ['--', 'Warning: Static', true]]);
    assert.equal(valueShiftInfo('nope'), null);
  });
  it('set, change, clear (picking the same one again clears it)', () => {
    const b = { id: 'x', act: 0, title: '', synopsis: '', tags: [] };
    assert.equal(setValueShift(b, '+-').valueShift, '+-');
    assert.equal(setValueShift({ ...b, valueShift: '+-' }, '-+').valueShift, '-+');
    assert.ok(!('valueShift' in setValueShift({ ...b, valueShift: '+-' }, '+-')));
    assert.ok(!('valueShift' in setValueShift({ ...b, valueShift: '+-' }, null)));
  });
  it('kept on the card, so it travels in the .draftline file; junk is dropped', () => {
    assert.equal(normalizeBeat({ id: 'x', act: 0, title: '', synopsis: '', tags: [], valueShift: '++' }).valueShift, '++');
    assert.ok(!('valueShift' in normalizeBeat({ id: 'x', act: 0, title: '', synopsis: '', tags: [], valueShift: '?!' })));
    const [kept] = normalizeBeats([{ id: 'x', act: 0, title: '', synopsis: '', tags: ['plot'], valueShift: '-+' }]);
    assert.equal(kept.valueShift, '-+');
    const rec = { id: 'p1', title: 'T', script: [{ id: 'a', type: 'action', text: 'x' }], beats: [{ id: 'x', act: 0, title: 'Card', synopsis: '', tags: [], valueShift: '+-' }], createdAt: 1, updatedAt: 1 };
    const back = parseBackup(serializeBackup(rec, {}));
    assert.equal((back.record ?? back).beats[0].valueShift, '+-');
  });
  it('on each card: a +/− button that opens the four choices', () => {
    const ui = read('components/BeatBoard.jsx');
    assert.match(ui, /<ValueShiftPicker value=\{beat\.valueShift\} onPick=\{\(id\) => onValueShift\(beat\.id, id\)\} \/>/);
    assert.match(ui, /\{VALUE_SHIFTS\.map\(\(v\) => \(/);
    assert.match(ui, /onChange\(beatsRef\.current\.map\(\(b\) => \(b\.id === id \? setValueShift\(b, shift\) : b\)\)\);/);
  });
});
