// Stage 2, Phase 0A: what the Stripboard shows for each scene, locked before Scheduling is built.
//
// The browser test (tests/browser/stripboard.browser.js, `npm run test:browser`) locks the rendered
// board: DOM, styles, geometry and pixels in both themes, desktop and phone, filtered and not. This
// one runs with `npm test` everywhere, without a browser, and locks the data behind every strip for the
// same fixture: setting (I/E), location, the heading's own time word, the resolved DAY / NIGHT
// (CONTINUOUS, MOMENTS LATER and LATER take the light of the scene before), modifiers, strip colour,
// cast numbers, the legend counts, and the Stripboard's columns and markup in the source.
// Scheduling must leave all of it exactly as it is for a project with no shooting days.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFountain } from '../src/lib/fountain.js';
import { analyzeScript, makeBlock } from '../src/lib/screenplay.js';
import { STRIP_COLORS, breakdownTotals, buildBreakdown } from '../src/lib/productionEngine.js';
import { filterPlanRows } from '../src/lib/planFilter.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// As File → Open builds it (App.jsx: parsed blocks → makeBlock, so every element has an id).
const blocks = parseFountain(read('tests/browser/stripboard-fixture.fountain')).blocks.map((b) => makeBlock(b.type, b.text, b.dual ? { dual: b.dual } : null));
const analysis = analyzeScript(blocks);
const rows = buildBreakdown({ blocks, analysis, production: null });

//  #   I/E        location                   heading's time   D/N      modifier     colour       cast
const EXPECTED = [
  [1, 'EXT', 'HARBOR', 'DAWN', 'DAY', null, 'ext-day', '1,2'],
  [2, 'INT', 'FERRY - PASSENGER DECK', 'DAY', 'DAY', null, 'int-day', '1,2'],
  [3, 'INT', 'FERRY - PASSENGER DECK', 'CONTINUOUS', 'DAY', null, 'int-day', '2,3'],
  [4, 'EXT', "HIGHWAY - MARIE'S CAR", 'NIGHT', 'NIGHT', 'MOVING', 'ext-night', '1'],
  [5, 'INT', 'CHILDHOOD HOME - KITCHEN', 'DAY', 'DAY', 'FLASHBACK', 'int-day', '4'],
  [6, 'INT/EXT', 'FERRY - WHEELHOUSE', 'NIGHT', 'NIGHT', null, 'int-night', '3'],
  [7, 'EXT/INT', 'PIER', 'MOMENTS LATER', 'NIGHT', null, 'ext-night', ''],
  [8, 'INT/EXT', 'VAN', 'DAY', 'DAY', null, 'int-day', ''],
  [9, 'EXT', 'PORT-AU-PRINCE', 'NIGHT', 'NIGHT', null, 'ext-night', ''],
  [10, null, 'FERRY BAR', 'NIGHT', 'NIGHT', null, 'unknown', '2'],
  [11, 'INT', 'LIGHTHOUSE', null, null, null, 'unknown', ''],
  [12, 'EXT', 'CROIX-DES-BOSSALES', 'NIGHT', 'NIGHT', 'DREAM', 'ext-night', ''],
  [13, 'INT', 'FERRY - CABIN', 'LATER', 'NIGHT', null, 'int-night', '1,2'],
  [14, 'EXT', 'BEACH', 'SUNSET', 'NIGHT', null, 'ext-night', '1,2,3'],
];

describe('Stripboard baseline (data): every strip as it is before Scheduling', () => {
  it('one strip per scene, in script order, with the same scene facts', () => {
    const actual = rows.map((r) => [r.number, r.setting, r.location, r.time, r.timeOfDay, r.modifier, r.color, r.cast.map((c) => c.number).join(',')]);
    assert.deepEqual(actual, EXPECTED);
  });

  it('the colour legend counts', () => {
    assert.deepEqual(breakdownTotals(rows).colors, { 'int-day': 4, 'ext-day': 1, 'int-night': 2, 'ext-night': 5, unknown: 2 });
    assert.deepEqual(Object.fromEntries(Object.entries(STRIP_COLORS).map(([k, v]) => [k, v.label])), {
      'int-day': 'INT. DAY', 'ext-day': 'EXT. DAY', 'int-night': 'INT. NIGHT', 'ext-night': 'EXT. NIGHT', unknown: 'No day / night',
    });
  });

  it('cast numbers: 1 is whoever has the most lines (live today, before any schedule)', () => {
    const byNumber = Object.fromEntries(rows.flatMap((r) => r.cast).map((c) => [c.number, c.name]));
    assert.deepEqual(byNumber, { 1: 'MARIE', 2: 'THEO', 3: 'AUGUSTIN', 4: 'GRANDMÈRE' });
  });

  it('the filter the browser baseline uses ("FERRY" · Night) keeps the same scenes', () => {
    const shown = filterPlanRows(rows, { q: 'FERRY', ie: [], dn: ['night'] });
    assert.deepEqual(shown.rows.map((r) => r.number), [6, 10, 13]);
    assert.equal(shown.total, 14);
  });

  it('the Stripboard markup: same columns, cells, classes and click in the source', () => {
    // The strips' markup lives in strips.jsx (shared by Script and Schedule views since Scheduling);
    // the Script view's table is still PlanningWorkspace's Stripboard.
    const src = read('src/components/planning/PlanningWorkspace.jsx');
    const board = src.slice(src.indexOf('function Stripboard(')) + read('src/components/planning/strips.jsx');
    for (const col of ['Sc.', 'I/E', 'Slugline', 'D/N', 'Pages']) assert.ok(board.includes(`<span role="columnheader">${col}</span>`), col);
    // Cast's heading hides with its column under 900px (it once stayed, alone on a second line)
    assert.ok(board.includes('<span role="columnheader" className="strip-cast">Cast</span>'), 'Cast');
    for (const cls of ['strip-num', 'strip-ie', 'strip-slug', 'strip-loc', 'strip-mod', 'strip-len', 'strip-cast', 'strip-legend', 'strip-key', 'strip-swatch']) {
      assert.ok(board.includes(cls), cls);
    }
    assert.match(board, /role="table" aria-label="Stripboard, in script order"/);
    assert.match(board, /onClick=\{\(\) => onOpenScene\(r\.id\)\}/);
    assert.match(board, /title=\{`\$\{STRIP_COLORS\[r\.color\]\.label\} — open scene \$\{r\.number\} in Write`\}/);
    const css = read('src/components/planning/PlanningWorkspace.css');
    assert.match(css, /grid-template-columns: 52px 76px minmax\(0, 1fr\) 110px 70px minmax\(90px, 160px\);/);
  });
});
