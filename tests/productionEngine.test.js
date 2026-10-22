import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PRODUCTION_BUCKETS, addAsset, breakdownCsv, breakdownTotals, buildBreakdown, castNumbers, eighthsLabel,
  emptyProduction, normalizeProduction, parseSlugline, removeAsset, sceneLineCounts, setSceneNotes, stripColor,
} from '../src/lib/productionEngine.js';
import { analyzeScript, linesToEighths } from '../src/lib/screenplay.js';
import { parseBackup, serializeBackup } from '../src/lib/backup.js';
import { toDoc, toRecord, revisionToDoc } from '../src/lib/projectStorage.js';
import { createRevision, revisionRecord } from '../src/lib/revisions.js';
import { snapshotFileText, snapshotFromFileText } from '../src/lib/folderSync.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const SCRIPT = [
  { id: 's1', type: 'scene', text: 'INT. FERRY - WHEELHOUSE - NIGHT' },
  { id: 'a1', type: 'action', text: 'Rain hammers the glass.' },
  { id: 'c1', type: 'character', text: 'MARIE' },
  { id: 'd1', type: 'dialogue', text: 'We turn back.' },
  { id: 'c2', type: 'character', text: "CAPTAIN (CONT'D)" },
  { id: 'd2', type: 'dialogue', text: 'Not tonight.' },
  { id: 'c3', type: 'character', text: 'MARIE' },
  { id: 'd3', type: 'dialogue', text: 'Then I will.' },
  { id: 's2', type: 'scene', text: 'EXT. FERRY DECK - CONTINUOUS' },
  { id: 'a2', type: 'action', text: 'Marie fights the wind to the rail.' },
  { id: 's3', type: 'scene', text: 'EXT. PÉTION-VILLE - DAWN' },
  { id: 'c4', type: 'character', text: 'FITO (V.O.)' },
  { id: 'd4', type: 'dialogue', text: 'She came back at sunrise.' },
  { id: 's4', type: 'scene', text: 'INT. HOTEL ROOM - DAY' },
  { id: 'a3', type: 'action', text: 'Empty.' },
  { id: 's5', type: 'scene', text: 'INT./EXT. CAR - MOVING - NIGHT' },
  { id: 's6', type: 'scene', text: 'THE LIGHTHOUSE' },
];

describe('Slugline parsing', () => {
  const slug = (setting, location, time, period, modifier = null) => ({ setting, location, time, period, modifier });
  it('splits INT / EXT, location and time of day', () => {
    assert.deepEqual(parseSlugline('INT. FERRY - WHEELHOUSE - NIGHT'), slug('INT', 'FERRY - WHEELHOUSE', 'NIGHT', 'night'));
    assert.deepEqual(parseSlugline('ext. beach – dawn'), slug('EXT', 'BEACH', 'DAWN', 'day'));
    assert.equal(parseSlugline('EXT. ROOFTOP - DUSK').period, 'night');
    assert.equal(parseSlugline('INT. KITCHEN - MOMENTS LATER').time, 'MOMENTS LATER');
    assert.equal(parseSlugline('INT. KITCHEN - LATER').period, 'carry');
  });
  it('takes trailing (and inner) parentheticals out as the modifier, so they never hide the time of day', () => {
    assert.deepEqual(parseSlugline('EXT. CROIX-DES-BOSSALES - NIGHT (FLASHBACK)'), slug('EXT', 'CROIX-DES-BOSSALES', 'NIGHT', 'night', 'FLASHBACK'));
    assert.deepEqual(parseSlugline('INT. BEDROOM - DAY (DREAM)'), slug('INT', 'BEDROOM', 'DAY', 'day', 'DREAM'));
    assert.deepEqual(parseSlugline('INT. CAR (MOVING) - NIGHT'), slug('INT', 'CAR', 'NIGHT', 'night', 'MOVING'));
    assert.equal(parseSlugline('EXT. FIELD - NIGHT (FLASHBACK) (1986)').modifier, 'FLASHBACK · 1986');
    assert.equal(parseSlugline('INT. BEDROOM - DAY').modifier, null);
  });
  it('a time segment containing DAY or NIGHT anywhere counts ("NEXT DAY", "FOLLOWING NIGHT", "DAY - CONTINUOUS")', () => {
    assert.deepEqual(parseSlugline('INT. CINEUS RESIDENCE - NEXT DAY'), slug('INT', 'CINEUS RESIDENCE', 'NEXT DAY', 'day'));
    assert.deepEqual(parseSlugline('INT. BOUCHARD RESIDENCE - MASTER BEDROOM - FOLLOWING NIGHT'),
      slug('INT', 'BOUCHARD RESIDENCE - MASTER BEDROOM', 'FOLLOWING NIGHT', 'night'));
    assert.equal(parseSlugline('INT. KITCHEN - LATER THAT DAY').period, 'day');
    assert.equal(parseSlugline('EXT. STREET - NEXT NIGHT').period, 'night');
    assert.deepEqual(parseSlugline('EXT. ROOF - DAY - CONTINUOUS'), slug('EXT', 'ROOF', 'DAY', 'day'));
    assert.deepEqual(parseSlugline('INT. KITCHEN - NIGHT - BACK TO SCENE'), slug('INT', 'KITCHEN', 'NIGHT', 'night'));
    assert.equal(parseSlugline('INT. NIGHT MARKET').time, null, 'the location itself is never the time');
    assert.deepEqual(parseSlugline('INT. CLUB - NIGHT MARKET - NIGHT'), slug('INT', 'CLUB - NIGHT MARKET', 'NIGHT', 'night'));
    assert.equal(parseSlugline('INT. DAY CARE - DAY').location, 'DAY CARE');
  });
  it('keeps the combined prefix as written: INT/EXT (INT./EXT., INT/EXT., I/E) or EXT/INT (EXT./INT., EXT/INT., E/I)', () => {
    for (const s of ['INT./EXT. CAR - DAY', 'INT/EXT. CAR - DAY', 'INT/EXT CAR - DAY', 'I/E CAR - DAY', 'I/E. CAR - DAY']) {
      assert.equal(parseSlugline(s).setting, 'INT/EXT', s);
      assert.equal(parseSlugline(s).location, 'CAR', s);
    }
    for (const s of ['EXT./INT. CAR - DAY', 'EXT/INT. CAR - DAY', 'E/I CAR - DAY']) assert.equal(parseSlugline(s).setting, 'EXT/INT', s);
  });
  it('ignores a leading scene number and leaves headings without parts alone', () => {
    assert.equal(parseSlugline('12A INT. OFFICE - DAY').setting, 'INT');
    assert.deepEqual(parseSlugline('THE LIGHTHOUSE'), slug(null, 'THE LIGHTHOUSE', null, null));
    assert.equal(parseSlugline('INTERVIEW ROOM').setting, null, 'INT only as a whole word');
  });
  it('colours strips by setting and light; combined settings by the side they lead with', () => {
    assert.equal(stripColor('INT', 'day'), 'int-day');
    assert.equal(stripColor('EXT', 'day'), 'ext-day');
    assert.equal(stripColor('INT', 'night'), 'int-night');
    assert.equal(stripColor('EXT', 'night'), 'ext-night');
    assert.equal(stripColor('INT/EXT', 'day'), 'int-day', 'INT./EXT.: interior (white)');
    assert.equal(stripColor('INT/EXT', 'night'), 'int-night', 'INT./EXT.: interior (blue)');
    assert.equal(stripColor('EXT/INT', 'day'), 'ext-day', 'EXT./INT.: exterior (yellow)');
    assert.equal(stripColor('EXT/INT', 'night'), 'ext-night', 'EXT./INT.: exterior (green)');
    assert.equal(stripColor(null, 'day'), 'unknown');
    assert.equal(stripColor('INT', null), 'unknown');
  });
  it('MOMENTS LATER / CONTINUOUS inherit the scene before’s resolved DAY / NIGHT', () => {
    const blocks = [
      { id: 'h1', type: 'scene', text: 'INT. BOUCHARD RESIDENCE - MASTER BEDROOM - FOLLOWING NIGHT' },
      { id: 'h2', type: 'scene', text: 'INT. BOUCHARD RESIDENCE - HALLWAY - MOMENTS LATER' },
      { id: 'h3', type: 'scene', text: 'EXT/INT. PORCH - CONTINUOUS' },
      { id: 'h4', type: 'scene', text: 'INT. CINEUS RESIDENCE - NEXT DAY' },
      { id: 'h5', type: 'scene', text: 'EXT. CROIX-DES-BOSSALES - LATER (FLASHBACK)' },
    ];
    const rows = buildBreakdown({ blocks, analysis: analyzeScript(blocks) });
    assert.deepEqual(rows.map((r) => r.timeOfDay), ['NIGHT', 'NIGHT', 'NIGHT', 'DAY', 'DAY']);
    assert.deepEqual(rows.map((r) => r.color), ['int-night', 'int-night', 'ext-night', 'int-day', 'ext-day']);
    assert.deepEqual(rows.map((r) => r.time), ['FOLLOWING NIGHT', 'MOMENTS LATER', 'CONTINUOUS', 'NEXT DAY', 'LATER'], 'the heading’s own words are kept');
    assert.equal(rows[4].modifier, 'FLASHBACK');
    const first = buildBreakdown({ blocks: [{ id: 'x', type: 'scene', text: 'INT. HALL - CONTINUOUS' }], analysis: analyzeScript([]) });
    assert.equal(first[0].timeOfDay, null, 'nothing before it to inherit from');
  });
});

describe('Page eighths', () => {
  it('labels eighths the industry way', () => {
    assert.equal(eighthsLabel(1), '1/8');
    assert.equal(eighthsLabel(6), '6/8');
    assert.equal(eighthsLabel(8), '1');
    assert.equal(eighthsLabel(10), '1 2/8');
    assert.equal(eighthsLabel(0), '0/8');
  });
  it('counts each scene’s lines from its elements (wrapping, blank lines before)', () => {
    const lines = sceneLineCounts(SCRIPT);
    assert.equal(lines.size, 6);
    assert.ok(lines.get('s1') > lines.get('s4'), 'the dialogue scene is longer than a one-line scene');
    const long = [{ id: 'x', type: 'scene', text: 'INT. A - DAY' }, { id: 'y', type: 'action', text: 'word '.repeat(400) }];
    assert.ok(sceneLineCounts(long).get('x') > 20, 'long action wraps onto many lines');
  });
  it('uses the app’s measured eighths when it has them, else works them out', () => {
    const analysis = analyzeScript(SCRIPT);
    const rows = buildBreakdown({ blocks: SCRIPT, analysis, production: emptyProduction() });
    const lines = sceneLineCounts(SCRIPT);
    assert.equal(rows[0].eighths, linesToEighths(lines.get('s1')));
    assert.ok(rows.every((r) => r.eighths >= 1), 'every scene is at least 1/8');
    const measured = buildBreakdown({ blocks: SCRIPT, analysis, scenes: [{ id: 's1', number: 1, page: 3, eighths: 10 }] });
    assert.equal(measured[0].length, '1 2/8');
    assert.equal(measured[0].page, 3);
  });
});

describe('Breakdown: scenes and speaking cast', () => {
  const analysis = analyzeScript(SCRIPT);
  const rows = buildBreakdown({ blocks: SCRIPT, analysis, production: emptyProduction() });
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

  it('has one row per scene heading, numbered in script order', () => {
    assert.deepEqual(rows.map((r) => r.number), [1, 2, 3, 4, 5, 6]);
    assert.equal(byId.s1.heading, 'INT. FERRY - WHEELHOUSE - NIGHT');
    assert.equal(byId.s1.color, 'int-night');
  });
  it('gives CONTINUOUS / LATER scenes the light of the scene before', () => {
    assert.equal(byId.s2.period, 'night');
    assert.equal(byId.s2.color, 'ext-night');
    assert.equal(byId.s2.time, 'CONTINUOUS', 'the heading’s own wording is kept');
  });
  it('tags everyone who speaks in a scene, once, without extensions', () => {
    assert.deepEqual(byId.s1.cast.map((c) => c.name), ['MARIE', 'CAPTAIN']);
    assert.deepEqual(byId.s3.cast.map((c) => c.name), ['FITO'], 'V.O. counts as speaking');
    assert.deepEqual(byId.s2.cast, [], 'action-only scene: no cast');
  });
  it('numbers the cast like a call sheet (most lines first) and sorts pills by number', () => {
    const nums = castNumbers(analysis);
    assert.equal(nums.get('MARIE'), 1);
    assert.deepEqual(byId.s1.cast, [{ name: 'MARIE', number: 1 }, { name: 'CAPTAIN', number: nums.get('CAPTAIN') }]);
  });
  it('follows the script when it changes (nothing about the script is stored)', () => {
    const edited = SCRIPT.map((b) => (b.id === 'c2' ? { ...b, text: 'FITO' } : b));
    const again = buildBreakdown({ blocks: edited, analysis: analyzeScript(edited) });
    assert.deepEqual(again[0].cast.map((c) => c.name).sort(), ['FITO', 'MARIE']);
  });
  it('flags headings without INT / EXT or a time as unknown strips', () => {
    assert.equal(byId.s6.setting, null);
    assert.equal(byId.s6.color, 'unknown');
    assert.equal(byId.s5.color, 'int-night', 'INT./EXT. leads with the interior');
  });
  it('totals scenes, pages and strip colours', () => {
    const t = breakdownTotals(rows);
    assert.equal(t.scenes, 6);
    assert.equal(t.eighths, rows.reduce((n, r) => n + r.eighths, 0));
    assert.equal(t.colors['int-night'], 2);
    assert.equal(t.colors['ext-night'], 1);
    assert.equal(t.colors['int-day'], 1);
    assert.equal(t.colors['ext-day'], 1);
    assert.equal(t.colors.unknown, 1);
  });
});

describe('Manual asset buckets', () => {
  it('has the four tag lists plus notes', () => {
    assert.deepEqual(PRODUCTION_BUCKETS.map((b) => b.label),
      ['Background / Extras', 'Props & Set Dressing', 'Wardrobe & SFX', 'Vehicles & Stunts']);
  });
  it('adds, dedupes (any case), removes, and drops scenes left empty', () => {
    let p = emptyProduction();
    p = addAsset(p, 's1', 'props', '  Marie’s   suitcase ');
    p = addAsset(p, 's1', 'props', 'MARIE’S SUITCASE');
    p = addAsset(p, 's1', 'props', '   ');
    p = addAsset(p, 's1', 'nonsense', 'x');
    assert.deepEqual(p.scenes.s1.props, ['Marie’s suitcase']);
    p = setSceneNotes(p, 's1', 'Permit for the harbour');
    p = removeAsset(p, 's1', 'props', 'Marie’s suitcase');
    assert.equal(p.scenes.s1.notes, 'Permit for the harbour');
    p = setSceneNotes(p, 's1', '');
    assert.deepEqual(p.scenes, {}, 'nothing left: the scene is dropped');
  });
  it('never mutates what it was given', () => {
    const p = emptyProduction();
    const q = addAsset(p, 's1', 'extras', 'Ferry passengers (12)');
    assert.deepEqual(p.scenes, {});
    assert.deepEqual(q.scenes.s1.extras, ['Ferry passengers (12)']);
  });
  it('reads anything stored without throwing', () => {
    for (const bad of [undefined, null, 'x', 42, [], { scenes: [] }, { scenes: { s1: 'nope' } }]) {
      assert.deepEqual(normalizeProduction(bad), emptyProduction());
    }
    const n = normalizeProduction({ scenes: { s1: { props: ['Gun', 7, 'gun', ''], notes: 5 } } });
    assert.deepEqual(n.scenes.s1, { extras: [], props: ['Gun'], wardrobe: [], vehicles: [], notes: '' });
  });
  it('joins stored assets onto the breakdown by scene heading id', () => {
    const p = addAsset(emptyProduction(), 's3', 'vehicles', 'Tap-tap');
    const rows = buildBreakdown({ blocks: SCRIPT, analysis: analyzeScript(SCRIPT), production: p });
    assert.deepEqual(rows.find((r) => r.id === 's3').vehicles, ['Tap-tap']);
    assert.deepEqual(rows.find((r) => r.id === 's1').vehicles, []);
  });
  it('exports the breakdown as CSV (one row per scene, Excel-safe)', () => {
    const p = addAsset(addAsset(emptyProduction(), 's1', 'props', 'Flare gun'), 's1', 'props', 'Life jacket, orange');
    const csv = breakdownCsv(buildBreakdown({ blocks: SCRIPT, analysis: analyzeScript(SCRIPT), production: p }));
    assert.ok(csv.startsWith('﻿Scene,Slugline,INT/EXT,Day/Night,Pages (8ths),Page,Speaking Cast,Background / Extras'));
    const lines = csv.trim().split('\r\n');
    assert.equal(lines.length, 7);
    assert.match(lines[1], /^1,INT\. FERRY - WHEELHOUSE - NIGHT,INT,NIGHT,/);
    assert.match(lines[1], /1\. MARIE; \d\. CAPTAIN/);
    assert.match(lines[1], /"Flare gun; Life jacket, orange"/);
  });
});

describe('.draftline files keep planning data (and older files still open)', () => {
  const production = setSceneNotes(addAsset(emptyProduction(), 's1', 'wardrobe', 'Rain-soaked coat'), 's1', 'Night shoot, harbour permit');
  const doc = { id: 'p1', meta: { title: 'Ferry' }, blocks: SCRIPT, production };

  it('saves and loads production with the project', () => {
    const rec = toRecord(doc, 1000);
    assert.deepEqual(rec.production, production);
    assert.deepEqual(toDoc(rec).production, production);
  });
  it('round-trips through a backup file', () => {
    const text = serializeBackup(toRecord(doc, 1000));
    assert.match(text, /"production"/);
    const { record } = parseBackup(text);
    assert.deepEqual(toDoc(record).production, production);
  });
  it('opens backups and projects from before Plan existed, with empty breakdowns', () => {
    const rec = toRecord(doc, 1000);
    delete rec.production;
    const text = serializeBackup(rec);
    assert.doesNotMatch(text, /"production"/);
    const { record } = parseBackup(text);
    assert.deepEqual(toDoc(record).production, emptyProduction());
    assert.equal(toDoc(record).blocks.length, SCRIPT.length, 'the script is untouched');
  });
  it('shrugs off a damaged production block instead of refusing the backup', () => {
    const rec = { ...toRecord(doc, 1000), production: 'garbage' };
    const { record } = parseBackup(serializeBackup(rec));
    assert.deepEqual(toDoc(record).production, emptyProduction());
  });
  it('snapshots carry production, and older snapshots restore with none', () => {
    const rev = createRevision({ ...doc, production }, { label: 'Before notes', now: 5000 });
    production.scenes.s1.wardrobe.push('later edit');
    assert.deepEqual(rev.production.scenes.s1.wardrobe, ['Rain-soaked coat'], 'deep-copied');
    production.scenes.s1.wardrobe.pop();
    assert.deepEqual(revisionToDoc(rev).production, production);
    const { production: _drop, ...old } = rev; // eslint-disable-line no-unused-vars
    assert.equal(revisionRecord(old).production, undefined);
    assert.deepEqual(revisionToDoc(old).production, emptyProduction());
  });
  it('snapshot files written to a folder keep production too', () => {
    const rev = createRevision({ ...doc, production }, { label: 'Lock', now: 5000 });
    const text = snapshotFileText(rev, { id: 'p1', title: 'Ferry', createdAt: 1 });
    assert.deepEqual(snapshotFromFileText(text).rev.production, production);
  });
});

describe('Stripboard and Breakdowns show the parsed heading', () => {
  const pw = read('src/components/planning/PlanningWorkspace.jsx');
  it('stripboard: I/E as written, the location with a modifier pill, D/N resolved', () => {
    assert.match(pw, /<span role="cell" className="strip-ie">\{r\.setting \|\| '–'\}<\/span>/);
    assert.match(pw, /<span className="strip-loc">\{r\.location \|\| r\.heading\}<\/span>\s*\{r\.modifier && <span className="strip-mod">\{r\.modifier\}<\/span>\}/);
    assert.match(pw, /\{r\.timeOfDay \|\| '–'\}/);
  });
  it('breakdown cards: the modifier beside the INT / EXT and time pills', () => {
    assert.match(pw, /\{row\.modifier && <span className="plan-badge plan-modifier"[^>]*>\{row\.modifier\}<\/span>\}/);
  });
  it('the CSV’s Day/Night column is the resolved DAY / NIGHT', () => {
    assert.match(read('src/lib/productionEngine.js'), /r\.setting \|\| '', r\.timeOfDay \|\| ''/);
  });
});

describe('App wiring: [ Write | Plan ]', () => {
  const app = read('src/App.jsx');
  it('defaults to Write, and the Plan workspace loads on demand', () => {
    assert.match(app, /useState\('write'\)/);
    assert.match(app, /lazy\(\(\) => import\('\.\/components\/planning\/PlanningWorkspace\.jsx'\)\)/);
    assert.doesNotMatch(app, /^import .*productionEngine/m, 'breakdown arithmetic is not in the main bundle');
    assert.match(app, /import\('\.\/lib\/productionEngine\.js'\)/, 'Export Breakdown loads it when used');
  });
  it('one header for both: the left cluster is shared; the right swaps Write’s tools for Plan’s in the same slots', () => {
    const header = app.slice(app.indexOf('<header className="bar"'), app.indexOf('</header>'));
    const left = header.slice(header.indexOf('zone-left'), header.indexOf('<div className="bar-zone zone-middle">'));
    const at = (k) => left.indexOf(k);
    const order = [at('className={`brand'), at('doc-title'), at('className="seg ws-switch"'), at('<Menu label="File" items={fileItems}')];
    assert.ok(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), `D · title · Write|Plan · File: ${JSON.stringify(order)}`);
    const right = header.slice(header.indexOf('bar-zone zone-right'));
    assert.match(right, /\{inPlan \? \(\s*<div className="seg plan-seg" role="radiogroup" aria-label="Plan view"/);
    assert.match(right, /<div className="seg view-seg" role="radiogroup" aria-label="Workspace view/);
    assert.match(right, /\{inPlan && planView === 'breakdowns' && \(\s*<button\s*ref=\{planFoldBtnRef\}/);
    assert.match(right, /\{planAllFolded \? 'Expand All' : 'Collapse All'\}/);
    assert.match(right, /onClick=\{exportBreakdown\}/);
    for (const b of ['btn-focus', 'btn-bible', 'btn btn-accent']) assert.match(right, new RegExp(`${b}[^>]*\\n?[^>]*hidden=\\{inPlan\\}|hidden=\\{inPlan\\}[\\s\\S]{0,80}${b}`), b);
  });
  it('Plan has no toolbar row of its own: the summary line, then the cards or strips', () => {
    const pw = read('src/components/planning/PlanningWorkspace.jsx');
    assert.doesNotMatch(pw, /className="plan-bar"|plan-toolbar|setCollapsed|onExport/);
    assert.match(pw, /className="plan-summary" role="status"[\s\S]*cast, sluglines and lengths come from the script/);
    assert.match(app, /view=\{planView\}\s*fold=\{planFold\}\s*onToggleCard=\{togglePlanCard\}/);
    assert.match(pw, /const isOpen = fold\.closed === fold\.except\.has\(r\.id\);/);
  });
  it('Collapse All folds every card; a card toggled by hand is the exception either way', () => {
    // the same arithmetic as App (planFold) and PlanningWorkspace (isOpen)
    const open = (f, id) => f.closed === f.except.has(id);
    let f = { closed: false, except: new Set() };
    assert.ok(open(f, 'a'));
    f = { ...f, except: new Set(['a']) };
    assert.ok(!open(f, 'a') && open(f, 'b'));
    f = { closed: true, except: new Set() }; // Collapse All
    assert.ok(!open(f, 'a') && !open(f, 'b'));
    f = { ...f, except: new Set(['b']) };
    assert.ok(!open(f, 'a') && open(f, 'b'));
    assert.match(app, /const foldAllPlan = \(\) => setPlanFold\(\{ closed: !planAllFolded, except: new Set\(\) \}\);/);
  });
  it('keeps the editor and board mounted (hidden) so nothing unsaved or scrolled is lost', () => {
    assert.match(app, /const showEditor = \(view !== 'board' \|\| focusMode\) && !inPlan;/);
    assert.match(app, /<BeatBoard[\s\S]{0,1200}hidden=\{inPlan\}/);
    assert.match(app, /writeScroll\.current = scrollerEl\.current\?\.scrollTop/);
    assert.match(app, /boardScroll\.current/);
  });
  it('saves production with the project, backups and snapshots', () => {
    assert.match(app, /production: s\.production/);
    assert.match(app, /setProduction\(/);
  });
  it('uses line icons, not emoji, for the switch', () => {
    assert.match(app, /PenLine/);
    assert.match(app, /Clapperboard/);
    assert.doesNotMatch(app, /✍️|🎬/);
  });
});
