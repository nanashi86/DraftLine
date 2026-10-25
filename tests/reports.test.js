import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBreakdown } from '../src/lib/productionEngine.js';
import { analyzeScript, buildItems, paginate } from '../src/lib/screenplay.js';
import {
  buildReports, charactersReport, locationsReport, reportCsv, scenesReport, scriptReport,
} from '../src/lib/reports.js';
import { moreMenuItems } from '../src/lib/toolbar.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const B = (id, type, text, extra = {}) => ({ id, type, text, ...extra });

const script = () => [
  B('s1', 'scene', 'EXT. HARBOR - DAWN'),
  B('a1', 'action', 'Mist over the water. A ferry waits.'),
  B('c1', 'character', 'MARIE'), B('d1', 'dialogue', 'We go now.'),
  B('c2', 'character', 'THEO'), B('d2', 'dialogue', 'Not without Manman. She will want to say goodbye, and you know it, Marie. Every word.'),
  B('s2', 'scene', 'INT. FERRY - CABIN - NIGHT'),
  B('a2', 'action', 'Benches. A radio.'),
  B('c3', 'character', 'MARIE (V.O.)'), B('d3', 'dialogue', 'Go.'),
  B('s3', 'scene', 'EXT. HARBOR - DAY'),
  B('a3', 'action', 'Empty pier.'),
];
const reportsOf = (blocks) => {
  const analysis = analyzeScript(blocks);
  const layout = paginate(buildItems(blocks));
  const rows = buildBreakdown({ blocks, analysis });
  return { reports: buildReports({ rows, blocks, analysis, layout }), rows, analysis, layout };
};

describe('Reports: Scenes', () => {
  it('one row per scene in script order, with INT/EXT, time, length and speaking cast', () => {
    const { reports } = reportsOf(script());
    assert.deepEqual(reports.scenes.map((r) => [r.number, r.heading, r.setting, r.time, r.cast.join('+')]), [
      [1, 'EXT. HARBOR - DAWN', 'EXT', 'DAY', 'MARIE+THEO'],
      [2, 'INT. FERRY - CABIN - NIGHT', 'INT', 'NIGHT', 'MARIE'],
      [3, 'EXT. HARBOR - DAY', 'EXT', 'DAY', ''],
    ]);
    assert.ok(reports.scenes.every((r) => typeof r.eighths === 'number' && r.length));
    assert.deepEqual(scenesReport([]), []);
  });
});

describe('Reports: Characters', () => {
  it('speeches, printed lines, words, scenes, pages and share of dialogue — most lines first', () => {
    const { reports } = reportsOf(script());
    const [first, second] = reports.characters;
    assert.equal(first.name, 'THEO', 'his one long speech prints on more lines');
    assert.deepEqual([first.speeches, first.lines, first.scenes, first.firstPage, first.lastPage], [1, 3, 1, 1, 1]);
    assert.equal(second.name, 'MARIE');
    assert.deepEqual([second.speeches, second.lines, second.words, second.scenes], [2, 2, 4, 2], '(V.O.) counts as MARIE');
    assert.equal(first.share + second.share, 100);
  });
  it('no one speaking: an empty report', () => {
    assert.deepEqual(charactersReport(analyzeScript([B('s', 'scene', 'INT. ROOM - DAY')])), []);
  });
});

describe('Reports: Locations', () => {
  it('scenes at the same place are grouped, with their settings, times and screen time; most time first', () => {
    const { reports } = reportsOf(script());
    const harbor = reports.locations.find((l) => l.location === 'HARBOR');
    assert.equal(harbor.count, 2);
    assert.equal(harbor.setting, 'EXT');
    assert.equal(harbor.times, 'DAY');
    assert.deepEqual(harbor.scenes.map((s) => s.number), [1, 3]);
    assert.equal(reports.locations[0].location, 'HARBOR');
    assert.ok(locationsReport([]).length === 0);
  });
});

describe('Reports: Script', () => {
  it('pages, scenes, words, speakers, dialogue vs action, interiors, nights and the longest scene', () => {
    const { reports, layout } = reportsOf(script());
    const s = reports.script;
    assert.equal(s.pages, layout.pageCount);
    assert.equal(s.scenes, 3);
    assert.equal(s.speaking, 2);
    assert.deepEqual([s.interior, s.exterior, s.day, s.night], [1, 2, 2, 1]);
    assert.equal(s.dialogueShare, Math.round((s.dialogueWords / (s.dialogueWords + s.actionWords)) * 100));
    assert.equal(s.longest.number, 1);
    assert.equal(scriptReport({}).averageLength, '—');
  });
});

describe('Reports: spreadsheets', () => {
  it('each report exports as UTF-8 CSV with a header row', () => {
    const { reports } = reportsOf(script());
    const scenes = reportCsv('scenes', reports);
    assert.ok(scenes.startsWith('\uFEFFScene,Slugline,INT/EXT,Time,Page,Length (8ths),Speaking Cast\r\n'));
    assert.match(scenes, /\r\n1,EXT\. HARBOR - DAWN,EXT,DAY,1,[^,]+,MARIE; THEO\r\n/);
    assert.match(reportCsv('characters', reports), /^\uFEFFCharacter,Speeches,Dialogue Lines,Words,Scenes,First Page,Last Page,Share of Dialogue \(%\)\r\nTHEO,1,3,/);
    assert.match(reportCsv('locations', reports), /\r\nHARBOR,EXT,DAY,2,1 3,/);
    assert.match(reportCsv('script', reports), /\r\nScenes,3\r\n/);
  });
});

describe('Reports in the app', () => {
  const app = read('src/App.jsx');
  it('a third Plan view beside Breakdowns and Stripboard', () => {
    assert.match(app, /\{ id: 'reports', label: 'Reports', title: '[^']+', Icon: ChartColumn \}/);
    assert.match(read('src/components/planning/PlanningWorkspace.jsx'), /view === 'reports' \? \(\s*<Reports /);
  });
  it('every row leads somewhere: a scene opens in Write, a character spotlights their dialogue, a location lists its scenes', () => {
    const r = read('src/components/planning/Reports.jsx');
    assert.match(r, /onClick=\{\(\) => onOpenScene\(r\.id\)\}/);
    assert.match(r, /onClick=\{\(\) => onOpenCharacter\(c\.name\)\}/);
    assert.match(r, /onClick=\{\(\) => setOpenLoc\(open \? null : l\.location\)\}/);
    assert.match(app, /const openCharacterInWrite = \(name\) => \{[\s\S]*?setCharacterTab\('dialogue'\);[\s\S]*?selectCharacter\(name\)/);
  });
  it('⋮ → Reports from Write; not repeated in Plan (it is on Plan\'s bar)', () => {
    const items = moreMenuItems({ onReports() {}, bibleOnBar: true, charactersOnBar: true });
    assert.ok(items.some((i) => i.label === 'Reports' && i.hint === 'Plan'));
    assert.ok(!moreMenuItems({ onReports: null, bibleOnBar: true, charactersOnBar: true }).some((i) => i.label === 'Reports'));
    assert.match(app, /onReports: inPlan \? null : openReports,/);
  });
});
