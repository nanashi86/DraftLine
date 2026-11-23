// Table Read (Write → ⋮ → Table Read…) and the Scenes sidebar's act labels.
//
// The Scene Board is the only place acts are set: the sidebar's labels and Table Read's Act range
// are read from the cards (lib/sceneActs.js), never stored. Table Read speaks one element at a time
// from the editor's blocks (lib/tableRead.js) and keeps voice choices on this device only
// (lib/tableReadPrefs.js), so the project, its backups and snapshots never change because of it.
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { actHeaders, actLabelFor, actRunOf, sceneActs } from '../src/lib/sceneActs.js';
import { moveCardAndScene } from '../src/lib/sceneSync.js';
import { analyzeScript } from '../src/lib/screenplay.js';
import {
  CHUNK_CHARS, NARRATOR, RATES, REUSE_PITCH, SCOPES, assignVoices, isGoogleVoice, chunkText, clean, headingSpeech, nextStep,
  parentheticalSpeech, prevStep, rangeIndices, scopeRange, speakerAt, stepAt, usableVoices, voiceGender,
} from '../src/lib/tableRead.js';
import {
  MAX_PROJECTS, TABLE_READ_KEY, loadPrefs, loadVoices, renameVoice, savePrefs, saveVoices,
} from '../src/lib/tableReadPrefs.js';
import { toDoc, toRecord } from '../src/lib/projectStorage.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const B = (id, type, text, extra = {}) => ({ id, type, text, ...extra });

function script() {
  return [
    B('fi', 'transition', 'FADE IN:'),
    B('s1', 'scene', 'EXT. HARBOR - DAWN'),
    B('a1', 'action', 'Mist over the water.'),
    B('c1', 'character', 'MARIE'),
    B('p1', 'parenthetical', '(low)'),
    B('d1', 'dialogue', 'We go now.'),
    B('s2', 'scene', 'INT. FERRY - DAY'),
    B('a2', 'action', 'Benches. A radio.'),
    B('c2', 'character', 'THEO (V.O.)'),
    B('d2', 'dialogue', 'You left a letter...'),
    B('c3', 'character', 'MARIE (CONT\'D)'),
    B('d3', 'dialogue', 'I did.'),
    B('s3', 'scene', 'EXT. BOW - LATER'),
    B('a3', 'action', 'Wind. Spray.'),
    B('s4', 'scene', 'INT. WHEELHOUSE - NIGHT'),
    B('c4', 'character', 'AUGUSTIN (O.S.)'),
    B('d4', 'dialogue', 'Hold on!'),
    B('t4', 'transition', 'CUT TO:'),
    B('s5', 'scene', 'EXT. PIER - DAY'),
    B('a5', 'action', 'Home.'),
    B('en', 'centered', 'THE END'),
  ];
}
const ids = ['s1', 's2', 's3', 's4', 's5'];
// Cards: s1 Act 1, s2 2A, s3 2B, s4 has no card, s5 Act 3.
const board = () => [
  { id: 'b1', act: 0, title: '1. EXT. HARBOR - DAWN', sceneId: 's1', tags: [] },
  { id: 'b2', act: 1, title: '2. INT. FERRY - DAY', sceneId: 's2', tags: [] },
  { id: 'b3', act: 2, title: '3. EXT. BOW - LATER', sceneId: 's3', tags: [] },
  { id: 'n1', act: 2, title: 'A note card', tags: [] }, // not a scene card: ignored
  { id: 'b5', act: 3, title: '5. EXT. PIER - DAY', sceneId: 's5', tags: [] },
];
const labels = (acts) => acts.map((a) => a.label);

describe('Scenes sidebar: act labels from the Scene Board', () => {
  it('4-Act: ACT 1, ACT 2A, ACT 2B, ACT 3', () => {
    assert.deepEqual(labels(sceneActs(ids, board(), 4)), ['Act 1', 'Act 2A', 'Act 2B', 'Act 2B', 'Act 3']);
    assert.deepEqual([...actHeaders(sceneActs(ids, board(), 4), ids)], [['s1', 'Act 1'], ['s2', 'Act 2A'], ['s3', 'Act 2B'], ['s5', 'Act 3']]);
  });
  it('3-Act: 2A and 2B are both ACT 2, one label', () => {
    const acts = sceneActs(ids, board(), 3);
    assert.deepEqual(labels(acts), ['Act 1', 'Act 2', 'Act 2', 'Act 2', 'Act 3']);
    assert.deepEqual([...actHeaders(acts, ids)], [['s1', 'Act 1'], ['s2', 'Act 2'], ['s5', 'Act 3']]);
  });
  it('switching structure and back keeps every placement (the cards are never touched)', () => {
    const beats = board();
    const before = JSON.stringify(beats);
    const four = labels(sceneActs(ids, beats, 4));
    sceneActs(ids, beats, 3);
    assert.deepEqual(labels(sceneActs(ids, beats, 4)), four);
    assert.equal(JSON.stringify(beats), before);
    assert.equal(actLabelFor(1, 3), 'Act 2');
    assert.equal(actLabelFor(2, 4), 'Act 2B');
  });
  it('a card moved on the board moves its label at once', () => {
    const r = moveCardAndScene(board(), script(), 'b2', 0, 1); // scene 2 into Act 1, after scene 1
    assert.deepEqual(labels(sceneActs(ids, r.beats, 4)).slice(0, 2), ['Act 1', 'Act 1']);
    assert.deepEqual([...actHeaders(sceneActs(ids, r.beats, 4), ids)].map(([, l]) => l), ['Act 1', 'Act 2B', 'Act 3']);
  });
  it('a scene with no card stays under the act above it: no boundary is invented', () => {
    const acts = sceneActs(ids, board(), 4);
    assert.equal(acts[3].label, 'Act 2B');
    assert.equal(acts[3].own, false);
    assert.equal(acts[2].own, true);
  });
  it('no scene cards, or scenes before the first carded one: no labels at all', () => {
    assert.equal(actHeaders(sceneActs(ids, [], 4), ids).size, 0);
    assert.equal(actHeaders(sceneActs(ids, undefined, 4), ids).size, 0);
    const late = sceneActs(ids, [{ id: 'x', act: 3, sceneId: 's4', title: '' }], 4);
    assert.deepEqual(labels(late), [null, null, null, 'Act 3', 'Act 3']);
  });
  it('the scene order is the script’s: an act that comes back is labelled again, never regrouped', () => {
    const beats = [{ id: 'a', act: 0, sceneId: 's1' }, { id: 'b', act: 3, sceneId: 's2' }, { id: 'c', act: 0, sceneId: 's3' }];
    assert.deepEqual([...actHeaders(sceneActs(['s1', 's2', 's3'], beats, 4), ['s1', 's2', 's3'])].map(([, l]) => l), ['Act 1', 'Act 3', 'Act 1']);
  });
  it('search: a label sits above the first match in its act; acts with no match show nothing', () => {
    const acts = sceneActs(ids, board(), 4);
    assert.deepEqual([...actHeaders(acts, ['s3', 's4'])], [['s3', 'Act 2B']]);
    assert.deepEqual([...actHeaders(acts, ['s1', 's5'])], [['s1', 'Act 1'], ['s5', 'Act 3']]);
    assert.equal(actHeaders(acts, []).size, 0);
  });
  it('the sidebar only adds labels: Title Page first, scenes, numbers and pages as before, no new controls', () => {
    const nav = read('src/components/Navigator.jsx');
    const css = read('src/components/Navigator.css');
    assert.ok(nav.indexOf('nav-cover-row') < nav.indexOf('nav-act'), 'Title Page above ACT 1');
    assert.match(nav, /<li className="nav-act">\{headers\.get\(s\.id\)\.toUpperCase\(\)\}<\/li>/);
    assert.match(nav, /onClick=\{\(\) => onJump\(s\.id\)\}/);
    assert.match(nav, /<span className="nav-num">\{s\.number\}<\/span>/);
    const rule = css.slice(css.indexOf('.nav-act {'));
    assert.match(rule, /border-top: 1px dashed var\(--line-soft\)/);
    assert.match(rule, /border-bottom: 1px dashed var\(--line-soft\)/);
    assert.doesNotMatch(rule, /background|cursor: pointer|border-radius/);
    assert.match(read('src/App.jsx'), /const acts = useMemo\(\(\) => sceneActs\(scenes\.map\(\(sc\) => sc\.id\), beats, actMode\), \[scenes, beats, actMode\]\);/);
  });
});

describe('Table Read: ranges', () => {
  const bl = script();
  const actRun = (sid) => actRunOf(sceneActs(ids, board(), 4), sid);
  const opts = { readAction: true, readParens: false };
  const first = (r) => nextStep(bl, ...rangeIndices(bl, r), opts)?.blockId;
  it('Scene (the default) reads the caret’s scene from its heading to the next', () => {
    assert.equal(SCOPES[0].id, 'scene');
    const r = scopeRange(bl, { scope: 'scene', anchorId: 'd2' });
    assert.deepEqual(r, { startId: 's2', endId: 's3' });
    assert.equal(first(r), 's2');
    assert.deepEqual(rangeIndices(bl, r), [6, 12]);
  });
  it('Act reads the act run the sidebar shows (manual placements included); none without an act', () => {
    assert.deepEqual(scopeRange(bl, { scope: 'act', anchorId: 'a3', actRun }), { startId: 's3', endId: 's5' }, '2B: scenes 3 and 4 (no card)');
    assert.deepEqual(scopeRange(bl, { scope: 'act', anchorId: 'd1', actRun }), { startId: 's1', endId: 's2' });
    assert.deepEqual(scopeRange(bl, { scope: 'act', anchorId: 'a5', actRun }), { startId: 's5', endId: null });
    assert.equal(scopeRange(bl, { scope: 'act', anchorId: 'd1', actRun: () => null }), null);
    const three = (sid) => actRunOf(sceneActs(ids, board(), 3), sid);
    assert.deepEqual(scopeRange(bl, { scope: 'act', anchorId: 'a2', actRun: three }), { startId: 's2', endId: 's5' }, '3-Act: Act 2 is 2A + 2B');
  });
  it('Script reads from the top, or from the caret with From here', () => {
    assert.deepEqual(scopeRange(bl, { scope: 'script', anchorId: 'd2' }), { startId: null, endId: null });
    assert.deepEqual(scopeRange(bl, { scope: 'script', anchorId: 'd2', fromHere: true }), { startId: 'd2', endId: null });
    assert.equal(first(scopeRange(bl, { scope: 'script', anchorId: 'd2', fromHere: true })), 'd2');
  });
  it('a stale or vanished target never reads a stale place: the first scene', () => {
    assert.deepEqual(scopeRange(bl, { scope: 'scene', anchorId: 'deleted-block' }), { startId: 's1', endId: 's2' });
    assert.deepEqual(scopeRange(bl, { scope: 'script', anchorId: 'deleted-block', fromHere: true }), { startId: null, endId: null });
    assert.deepEqual(scopeRange(bl, { scope: 'scene', anchorId: 'fi' }), { startId: 's1', endId: 's2' }, 'FADE IN: reads scene 1');
    assert.deepEqual(scopeRange([B('x', 'action', 'Nothing yet.')], { scope: 'scene', anchorId: null }), { startId: null, endId: null });
  });
  it('From here: the latest target, every time it’s asked', () => {
    assert.equal(scopeRange(bl, { scope: 'script', anchorId: 'a3', fromHere: true }).startId, 'a3');
    assert.equal(scopeRange(bl, { scope: 'script', anchorId: 'd1', fromHere: true }).startId, 'd1');
    assert.equal(scopeRange(bl, { scope: 'script', anchorId: 'd1', fromHere: false }).startId, null);
  });
  it('no caret (the Title Page): the first scene (and its act)', () => {
    assert.deepEqual(scopeRange(bl, { scope: 'scene', anchorId: null }), { startId: 's1', endId: 's2' });
    assert.deepEqual(scopeRange(bl, { scope: 'act', anchorId: null, actRun }), { startId: 's1', endId: 's2' });
    assert.deepEqual(scopeRange(bl, { scope: 'act', anchorId: 'fi', actRun }), { startId: 's1', endId: 's2' }, 'FADE IN: reads Act 1');
  });
  it('edits never leave a range pointing at nothing', () => {
    const r = scopeRange(bl, { scope: 'scene', anchorId: 'd2' });
    const edited = bl.filter((b) => b.id !== 's3'); // the next heading deleted: reads to the end
    assert.deepEqual(rangeIndices(edited, r), [6, edited.length]);
    const gone = bl.filter((b) => b.id !== 's2');
    assert.equal(rangeIndices(gone, r)[0], 0);
    assert.deepEqual(rangeIndices([], r), [0, 0]);
  });
});

describe('Table Read: what is read, and how', () => {
  const bl = script();
  it('narrator for headings and action, the character for dialogue; cues, transitions and THE END never', () => {
    const all = [];
    for (let s = nextStep(bl, 0, bl.length, {}); s; s = nextStep(bl, s.index + 1, bl.length, {})) all.push(s);
    assert.deepEqual(all.map((s) => [s.blockId, s.voiceKey]), [
      ['s1', NARRATOR], ['a1', NARRATOR], ['d1', 'MARIE'], ['s2', NARRATOR], ['a2', NARRATOR], ['d2', 'THEO'], ['d3', 'MARIE'],
      ['s3', NARRATOR], ['a3', NARRATOR], ['s4', NARRATOR], ['d4', 'AUGUSTIN'], ['s5', NARRATOR], ['a5', NARRATOR],
    ]);
  });
  it('(V.O.), (O.S.) and (CONT’D) only say whose line it is', () => {
    assert.equal(speakerAt(bl, 9), 'THEO');
    assert.equal(speakerAt(bl, 11), 'MARIE');
    assert.equal(speakerAt(bl, 16), 'AUGUSTIN');
    assert.equal(speakerAt(bl, 2), null);
    const names = analyzeScript(bl).characterList.map((c) => c.name);
    assert.deepEqual([...names].sort(), ['AUGUSTIN', 'MARIE', 'THEO'], 'the same names the Characters panel shows');
  });
  it('dialogue only (Read Action & Headings off), and parentheticals when asked', () => {
    const o = { readAction: false };
    assert.equal(nextStep(bl, 0, bl.length, o).blockId, 'd1');
    assert.equal(stepAt(bl, 4, { readParens: true }).text, 'low');
    assert.equal(stepAt(bl, 4, { readParens: true }).voiceKey, 'MARIE');
    assert.equal(stepAt(bl, 4, {}), null);
    assert.equal(prevStep(bl, 9, 6, o)?.blockId, undefined, 'no dialogue between s2 and d2');
    assert.equal(prevStep(bl, 11, 0, o).blockId, 'd2');
  });
  it('heard naturally: headings expanded, no screenplay symbols', () => {
    assert.equal(headingSpeech('INT. FERRY - PASSENGER DECK - CONTINUOUS'), 'Interior. Ferry, Passenger Deck, Continuous.');
    assert.equal(headingSpeech('EXT. HARBOR - DAWN'), 'Exterior. Harbor, Dawn.');
    assert.equal(headingSpeech('INT./EXT. CAR - NIGHT'), 'Interior, exterior. Car, Night.');
    assert.equal(headingSpeech('I/E VAN - DAY #12#'), 'Interior, exterior. Van, Day.');
    assert.equal(clean('Wait -- what? *Now* (MORE)'), 'Wait, what? Now');
    assert.equal(clean('You left a letter...'), 'You left a letter…');
    assert.equal(clean('Go [[a note]] now ^'), 'Go now');
    assert.equal(parentheticalSpeech('(beat)'), 'beat');
    assert.equal(stepAt([B('x', 'action', '***')], 0), null, 'nothing to say');
  });
  it('long speeches go to the engine in pieces of at most CHUNK_CHARS, at sentence ends first', () => {
    assert.deepEqual(chunkText('Short.'), ['Short.']);
    assert.deepEqual(chunkText(''), []);
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} goes here.`).join(' ');
    const pieces = chunkText(long);
    assert.ok(pieces.length > 1);
    assert.ok(pieces.every((p) => p.length <= CHUNK_CHARS));
    assert.equal(pieces.join(' '), long);
    assert.ok(pieces.every((p) => p.endsWith('.')));
    const runOn = Array.from({ length: 120 }, () => 'word').join(' ');
    assert.ok(chunkText(runOn).every((p) => p.length <= CHUNK_CHARS));
    assert.ok(chunkText('x'.repeat(450)).every((p) => p.length <= CHUNK_CHARS));
  });
  it('a 120-page script: each step is found without reading ahead', () => {
    const big = [];
    for (let i = 0; i < 1500; i++) {
      big.push(B(`s${i}`, 'scene', `INT. ROOM ${i} - DAY`), B(`a${i}`, 'action', 'A beat.'), B(`c${i}`, 'character', i % 2 ? 'ANA' : 'BEN'), B(`d${i}`, 'dialogue', 'Line.'));
    }
    const t = performance.now();
    let n = 0;
    for (let s = nextStep(big, 0, big.length, {}); s; s = nextStep(big, s.index + 1, big.length, {})) n += 1;
    assert.equal(n, 4500);
    assert.ok(performance.now() - t < 1500);
    assert.deepEqual(rangeIndices(big, scopeRange(big, { scope: 'scene', anchorId: 'd700' })), [2800, 2804]);
  });
});

describe('Table Read: voices', () => {
  const V = (uri, name, local = true, lang = 'en-US', def = false) => ({ voiceURI: uri, name, lang, localService: local, default: def });
  // Chrome on Windows: Microsoft voices on the device, Google voices online.
  const ms = [V('aria', 'Microsoft Aria', true, 'en-US', true), V('guy', 'Microsoft Guy'), V('sonia', 'Microsoft Sonia', true, 'en-GB')];
  const google = [V('g-us', 'Google US English', false), V('g-ukf', 'Google UK English Female', false, 'en-GB'), V('g-ukm', 'Google UK English Male', false, 'en-GB')];
  const chrome = [...ms, ...google, V('g-fr', 'Google français', false, 'fr-FR'), V('amelie', 'Amélie', true, 'fr-CA')];
  const uris = (a, names) => names.map((n) => a[n]?.voiceURI);

  it('Google voices first: the narrator in the script’s language, characters on the others', () => {
    assert.ok(isGoogleVoice(google[0]) && !isGoogleVoice(ms[0]));
    const a = assignVoices({ speakers: ['MARIE', 'THEO'], voices: chrome, lang: 'en-US' });
    assert.equal(a[NARRATOR].voiceURI, 'g-us');
    assert.deepEqual(uris(a, ['MARIE', 'THEO']), ['g-ukf', 'g-ukm']);
  });
  it('more characters than Google voices: Google voices again at a modest pitch, never Microsoft to fill in', () => {
    const a = assignVoices({ speakers: ['A', 'B', 'C', 'D', 'E'], voices: chrome, lang: 'en-US' });
    assert.deepEqual(uris(a, ['A', 'B', 'C', 'D', 'E']), ['g-ukf', 'g-ukm', 'g-ukf', 'g-ukm', 'g-us'], 'the narrator’s voice last');
    assert.ok(Object.values(a).every((x) => x.voiceURI.startsWith('g-')), 'no Microsoft voice to fill in');
    assert.deepEqual(['A', 'C'].map((n) => a[n].pitch), [REUSE_PITCH[0], REUSE_PITCH[1]]);
    assert.ok(REUSE_PITCH.every((p) => p >= 0.85 && p <= 1.15), 'modest');
    assert.notEqual(a.E.pitch, a[NARRATOR].pitch, 'sharing the narrator’s voice still sounds different');
  });
  it('stable: the same speakers and voices always give the same voices', () => {
    const args = { speakers: ['MARIE', 'THEO', 'AUGUSTIN'], voices: chrome, lang: 'en-US' };
    assert.deepEqual(assignVoices(args), assignVoices(args));
  });
  it('no Google voices (Edge, Safari, Firefox): on-device voices, the system default narrating', () => {
    const a = assignVoices({ speakers: ['MARIE', 'THEO', 'AUGUSTIN'], voices: ms });
    assert.equal(a[NARRATOR].voiceURI, 'aria');
    assert.deepEqual(uris(a, ['MARIE', 'THEO', 'AUGUSTIN']), ['guy', 'sonia', 'guy']);
    const onlyOtherOnline = assignVoices({ speakers: ['A'], voices: [V('x', 'Some Online Voice', false)] });
    assert.deepEqual(onlyOtherOnline, {}, 'other online voices are never chosen automatically');
  });
  it('offline (or after an online voice fails): on-device voices only, choices kept for later', () => {
    const overrides = { MARIE: 'g-ukm', THEO: 'sonia' };
    const off = assignVoices({ speakers: ['MARIE', 'THEO'], voices: chrome, overrides, lang: 'en-US', online: false });
    assert.equal(off[NARRATOR].voiceURI, 'aria');
    assert.ok(Object.values(off).every((x) => ms.some((v) => v.voiceURI === x.voiceURI)));
    assert.deepEqual([off.THEO.voiceURI, off.THEO.auto], ['sonia', false], 'an on-device choice still applies');
    assert.equal(off.MARIE.auto, true);
    const on = assignVoices({ speakers: ['MARIE', 'THEO'], voices: chrome, overrides, lang: 'en-US' });
    assert.deepEqual([on.MARIE.voiceURI, on.MARIE.auto], ['g-ukm', false], 'back online: the choice is back');
    assert.deepEqual(assignVoices({ speakers: ['A'], voices: google, online: false }), {}, 'nothing on the device: nothing to read with');
  });
  it('the writer’s choices win (any voice, Microsoft included); a voice missing on this device falls back to automatic', () => {
    const a = assignVoices({ speakers: ['MARIE', 'THEO'], voices: chrome, lang: 'en-US', overrides: { MARIE: 'guy', [NARRATOR]: 'aria', THEO: 'gone-voice' } });
    assert.deepEqual([a[NARRATOR].voiceURI, a[NARRATOR].auto], ['aria', false]);
    assert.deepEqual([a.MARIE.voiceURI, a.MARIE.auto], ['guy', false]);
    assert.equal(a.THEO.auto, true);
    assert.ok(isGoogleVoice({ name: a.THEO.voiceURI === 'g-us' ? 'Google US English' : 'Google UK' }));
  });
  it('no voices (or none loaded yet): nothing assigned, nothing invented', () => {
    assert.deepEqual(assignVoices({ speakers: ['A'], voices: [] }), {});
    assert.deepEqual(assignVoices({}), {});
  });
  it('the script’s language first, on-device first in the list; another language only when there’s nothing else', () => {
    const list = [...ms, V('g-us', 'Google US English', false), V('amelie', 'Amélie', true, 'fr-CA')];
    assert.deepEqual(usableVoices(list, 'en-US').map((v) => v.voiceURI), ['aria', 'guy', 'sonia', 'g-us']);
    assert.deepEqual(usableVoices(list, 'fr').map((v) => v.voiceURI), ['amelie']);
    assert.equal(usableVoices(list, 'de').length, 5);
    assert.deepEqual(uris(assignVoices({ speakers: ['A'], voices: chrome, lang: 'fr-FR' }), [NARRATOR, 'A']), ['g-fr', 'g-fr']);
  });
  it('Bio gender is only a hint, used when a voice’s name says something', () => {
    assert.equal(voiceGender({ name: 'Microsoft Zira - English' }), 'Female');
    assert.equal(voiceGender({ name: 'Google UK English Male' }), 'Male');
    assert.equal(voiceGender({ name: 'Google US English' }), null);
    const a = assignVoices({ speakers: ['MARIE', 'THEO'], voices: chrome, lang: 'en-US', genders: { MARIE: 'Male', THEO: 'Female' } });
    assert.deepEqual(uris(a, ['MARIE', 'THEO']), ['g-ukm', 'g-ukf']);
    const b = assignVoices({ speakers: ['MARIE'], voices: [V('n', 'Narrator X', true, 'en-US', true), V('g1', 'Local A'), V('g2', 'Local B')], genders: { MARIE: 'Female' } });
    assert.equal(b.MARIE.voiceURI, 'g1', 'no hint in the names: the usual order');
  });
});

describe('Table Read: voice choices stay on this device', () => {
  let mem;
  beforeEach(() => {
    mem = new Map();
    globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  });
  it('per project, by character name, reopened as they were', () => {
    saveVoices('p1', { MARIE: 'sonia', [NARRATOR]: 'aria' });
    saveVoices('p2', { MARIE: 'guy' });
    assert.deepEqual(loadVoices('p1'), { MARIE: 'sonia', [NARRATOR]: 'aria' });
    assert.deepEqual(loadVoices('p2'), { MARIE: 'guy' });
    assert.deepEqual(loadVoices('p3'), {});
    saveVoices('p2', {});
    assert.deepEqual(loadVoices('p2'), {});
    assert.ok(!JSON.parse(mem.get(TABLE_READ_KEY)).projects.p2, 'Auto-Assign forgets the project');
  });
  it('characters without Bios work the same (names, not Bio ids)', () => {
    saveVoices('p1', { 'WAITER #2': 'guy' });
    assert.deepEqual(loadVoices('p1'), { 'WAITER #2': 'guy' });
  });
  it('a rename carries the voice to the new name', () => {
    saveVoices('p1', { MARIE: 'sonia' });
    renameVoice('p1', 'Marie', 'marie-claire');
    assert.deepEqual(loadVoices('p1'), { 'MARIE-CLAIRE': 'sonia' });
    assert.equal(renameVoice('p1', 'NOBODY', 'X'), false);
  });
  it('speed and reading options, with safe defaults for anything odd', () => {
    assert.deepEqual(loadPrefs(), { rate: 1, readAction: true, readParens: false, onlineConsent: null });
    savePrefs({ rate: 1.25, readParens: true });
    assert.deepEqual(loadPrefs(), { rate: 1.25, readAction: true, readParens: true, onlineConsent: null });
    mem.set(TABLE_READ_KEY, JSON.stringify({ rate: 9, readAction: 'yes' }));
    assert.deepEqual(loadPrefs(), { rate: 1, readAction: true, readParens: false, onlineConsent: null });
    mem.set(TABLE_READ_KEY, '{oops');
    assert.deepEqual(loadVoices('p1'), {});
    assert.deepEqual(RATES, [1, 1.25, 1.5]);
  });
  it('the online-voice answer is remembered on this device, and only a real answer counts', () => {
    assert.equal(loadPrefs().onlineConsent, null, 'not asked yet');
    savePrefs({ onlineConsent: 'device' });
    assert.equal(loadPrefs().onlineConsent, 'device');
    savePrefs({ rate: 1.5 });
    assert.equal(loadPrefs().onlineConsent, 'device', 'other settings leave it alone');
    savePrefs({ onlineConsent: 'online' });
    assert.equal(loadPrefs().onlineConsent, 'online');
    savePrefs({ onlineConsent: 'sure' });
    assert.equal(loadPrefs().onlineConsent, 'online', 'nonsense is ignored');
    savePrefs({ onlineConsent: null });
    assert.equal(loadPrefs().onlineConsent, null, 'cleared: asked again');
    mem.set(TABLE_READ_KEY, JSON.stringify({ onlineConsent: true }));
    assert.equal(loadPrefs().onlineConsent, null);
  });
  it('answering never touches the saved voice choices', () => {
    saveVoices('p1', { MARIE: 'Google UK English Male', THEO: 'guy' });
    savePrefs({ onlineConsent: 'device' });
    assert.deepEqual(loadVoices('p1'), { MARIE: 'Google UK English Male', THEO: 'guy' });
  });
  it('blocked storage just means nothing is remembered', () => {
    globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    assert.deepEqual(loadVoices('p1'), {});
    assert.equal(saveVoices('p1', { A: 'b' }), false);
    assert.deepEqual(loadPrefs(), { rate: 1, readAction: true, readParens: false, onlineConsent: null });
  });
  it('keeps at most MAX_PROJECTS projects, the least recently used dropped first', () => {
    for (let i = 0; i <= MAX_PROJECTS; i++) saveVoices(`p${i}`, { A: 'v' }, 1000 + i);
    const kept = Object.keys(JSON.parse(mem.get(TABLE_READ_KEY)).projects);
    assert.equal(kept.length, MAX_PROJECTS);
    assert.ok(!kept.includes('p0'));
  });
  it('the project itself never changes: no Table Read field in the record, Bios untouched', () => {
    const doc = { id: 'p1', meta: {}, blocks: script(), beats: board(), characters: [{ id: 'ch1', name: 'MARIE', gender: 'Female' }] };
    const rec = toRecord(doc, 1);
    assert.equal(JSON.stringify(rec).includes('voice'), false);
    assert.deepEqual(toDoc(rec).characters.map((c) => Object.keys(c).includes('voice')), [false]);
    assert.doesNotMatch(read('src/lib/projectStorage.js'), /tableRead/);
    assert.doesNotMatch(read('src/lib/tableReadPrefs.js'), /indexedDB|setCharacters|projects\.save/);
  });
});

describe('Table Read: the player', () => {
  const ui = read('src/components/TableRead.jsx');
  const css = read('src/components/TableRead.css');
  const app = read('src/App.jsx');
  const editorCss = read('src/components/Editor.css');
  it('opens from Write → ⋮, never in Plan, and closes when the project changes', () => {
    assert.match(app, /onTableRead: inPlan \? null : openTableRead,/);
    assert.match(app, /if \(inPlan\) setTableRead\(null\);/);
    assert.match(app, /setTableRead\(null\); \/\/ another script/);
    assert.match(app, /<TableRead\s+key=\{projectId\}/);
  });
  it('never autoplays: opening only moves focus to Play', () => {
    assert.doesNotMatch(ui.slice(0, ui.indexOf('// ---- Settings')), /useEffect\(\(\) => \{\s*(play|speak)\(\)/);
    assert.match(ui, /const \[status, setStatus\] = useState\('idle'\)/);
    assert.match(ui, /setTimeout\(\(\) => playRef\.current\?\.focus\(\{ preventScroll: true \}\), 0\)/);
  });
  it('Scene, Act and Script, Scene first; previous, play / pause, next, speed, Voices…, close', () => {
    assert.deepEqual(SCOPES.map((s) => s.label), ['Scene', 'Act', 'Script']);
    assert.match(ui, /useState\('scene'\)/);
    for (const label of ['Previous element', 'Next element', 'Close Table Read']) assert.ok(ui.includes(`aria-label="${label}"`), label);
    assert.match(ui, /aria-label=\{playing \? 'Pause' : 'Play'\}/);
    assert.match(ui, /Voices…/);
    assert.match(ui, /RATES\.map\(\(r\) => \(\{ value: r, label: `\$\{r\}×` \}\)\)/);
    assert.match(ui, /import \{ Pause, Play, SkipBack, SkipForward, Volume2, X \} from 'lucide-react';/);
    assert.match(ui, /import Select from '\.\/Select\.jsx';/);
  });
  it('one element (in pieces) at a time, cancellable; stale speech events are ignored', () => {
    assert.match(ui, /const pieces = chunkText\(step\.text\);/);
    assert.match(ui, /if \(my !== e\.session\) return;/);
    assert.match(ui, /e\.session \+= 1;/);
    assert.match(ui, /synth\?\.cancel\(\)/);
    assert.equal((ui.match(/synth\.speak\(u\)/g) || []).length, 2, 'the step and the voice preview: nothing is queued ahead');
    assert.match(ui, /if \(e\.failures >= 3\)/, 'a failing engine never leaves the player stuck');
    assert.match(ui, /addEventListener\?\.\('voiceschanged', load\)/);
  });
  it('keys: Space only on the player itself, Esc closes an open list first, then the question or Voices…, then the player', () => {
    assert.match(ui, /\(e\.key === ' ' \|\| e\.code === 'Space'\) && e\.target === rootRef\.current\)/);
    assert.match(ui, /\[role="combobox"\]\[aria-expanded="true"\]/);
    assert.match(ui, /e\.stopPropagation\(\);\s*if \(asking\) \{[\s\S]*?\} else if \(voicesOpen\)/);
    assert.doesNotMatch(ui, /window\.addEventListener\('keydown'|document\.addEventListener\('keydown'/);
    assert.match(ui, /if \(returnFocus\?\.isConnected\) returnFocus\.focus\(\{ preventScroll: true \}\);/);
  });
  it('the target: caret moves, sidebar picks (even the same scene again) and the Title Page', () => {
    assert.match(app, /const \[readTarget, setReadTarget\] = useState\(\{ id: null, n: 0 \}\);/);
    assert.match(app, /setReadTarget\(\(t\) => \(!again && t\.id === id \? t : \{ id, n: t\.n \+ 1 \}\)\);/);
    assert.match(app, /const onActiveChange = useCallback\(\(id\) => \{\s*setActiveId\(id\);\s*if \(id\) aimRead\(id\);/);
    assert.match(app, /onActiveChange=\{onActiveChange\}/);
    assert.match(app, /const jumpTo = useCallback\(\(id\) => \{\s*aimRead\(id, true\);/);
    assert.match(app, /const showCover = useCallback\(\(\) => \{\s*aimRead\(null, true\);/);
    assert.match(app, /target=\{readTarget\}/);
  });
  it('a new target while stopped or paused is where Play starts; while playing nothing is interrupted', () => {
    assert.match(ui, /if \(seenTarget\.current === target\?\.n\) return;\s*seenTarget\.current = target\?\.n;\s*if \(eng\.current\.status !== 'playing'\) resetTo\(\);/);
    const reset = ui.slice(ui.indexOf('const resetTo = () => {'), ui.indexOf('const resetTo = () => {') + 200);
    assert.match(reset, /stopSpeech\(\);\s*eng\.current\.range = null;\s*eng\.current\.chunk = 0;\s*show\(null, 'idle'\);/, 'paused place forgotten: Play recalculates');
    assert.match(ui, /setScope\(s\.id\);\s*resetTo\(\);/, 'a new scope recalculates');
    assert.match(ui, /setFromHere\(e\.target\.checked\); resetTo\(\);/);
    assert.match(ui, /const range = scopeRange\(bl, \{ scope: sc, anchorId: an, fromHere: fh, actRun: ar \}\);/, 'resolved when Play is pressed');
    assert.match(ui, /`Ready · \$\{targetText\}`/, 'the player names its target');
  });
  it('online voices: marked, and an online voice that fails falls back to on-device voices in place', () => {
    assert.match(ui, /curRemote \? ' · Online voice'/);
    assert.match(ui, /v\.localService === false \? ' · online' : ''/);
    assert.match(ui, /if \(fallBack\(\)\) return;/);
    assert.match(ui, /window\.addEventListener\('offline', down\)/);
    assert.match(ui, /online: useOnline/);
    assert.doesNotMatch(ui, /saveVoices\(projectId, [^)]*assigned/, 'automatic voices are never saved over the writer’s choices');
  });
  it('consent: no online voice speaks (playback or a sample) before the writer says yes', () => {
    const speak = ui.slice(ui.indexOf('  const speak = () => {'), ui.indexOf('  const startRange = () => {'));
    const gate = speak.indexOf("if (voice.localService === false && consentRef.current !== 'online')");
    assert.ok(gate > 0 && gate < speak.indexOf('new window.SpeechSynthesisUtterance'), 'checked before any utterance exists');
    assert.ok(speak.indexOf('askConsent(\'play\')') > gate);
    const preview = ui.slice(ui.indexOf('  const preview = (key) => {'), ui.indexOf('  // ---- Keys ----'));
    assert.ok(preview.indexOf("voice.localService === false && consentRef.current !== 'online'") < preview.indexOf('new window.SpeechSynthesisUtterance'));
    assert.match(ui, /const askConsent = \(after\) => \{\s*stopSpeech\(\);/);
    assert.match(ui, /const useOnline = online && !remoteDown && consent !== 'device';/);
  });
  it('consent: one minimal question, two answers, remembered; Esc answers nothing', () => {
    assert.match(ui, />Use Online Voice<\/button>/);
    assert.match(ui, />Use On-Device Voice<\/button>/);
    assert.match(ui, /role="alertdialog"/);
    assert.match(ui, /send the screenplay text being read to \{providerOf\(assigned, byUri\)\} for speech synthesis/);
    assert.match(ui, /savePrefs\(\{ onlineConsent: choice \}\);/);
    assert.match(ui, /useState\(prefs0\.onlineConsent\)/, 'asked once per device, not every time');
    assert.match(ui, /if \(asking\) \{\s*dismissConsent\(\);/);
    const decide = ui.slice(ui.indexOf('const decide = (choice) => {'), ui.indexOf('const dismissConsent'));
    assert.doesNotMatch(decide, /saveVoices|setOverrides/, 'on-device keeps the saved voice choices');
  });
  it('pauses when the script is hidden or the tab goes to the background; silent on close', () => {
    assert.match(ui, /if \(hidden && eng\.current\.status === 'playing'\) pause\(\);/);
    assert.match(ui, /visibilitychange/);
    assert.match(app, /hidden=\{!showEditor\}/);
  });
  it('the highlight follows the spoken element, never while the writer types, and never prints', () => {
    assert.match(app, /readingId=\{tableRead \? readingId : null\}/);
    assert.match(ui, /if \(focused && scroller\.contains\(focused\) && focused\.tagName === 'TEXTAREA'\) return;/);
    assert.match(editorCss, /\.sheet \.el\.is-reading \{/);
    assert.match(editorCss, /@media print \{ \.sheet \.el\.is-reading \{ background: none; box-shadow: none; \}/);
    assert.match(css, /@media print \{ \.tr-player \{ display: none !important; \} \}/);
    assert.doesNotMatch(read('src/components/PrintView.jsx'), /is-reading|readingId/);
  });
  it('themed from the shared tokens (Editorial Light and Espresso Noir alike)', () => {
    for (const t of ['--card', '--line-soft', '--muted', '--accent', '--hover-bg', '--chip']) assert.ok(css.includes(`var(${t})`), t);
    assert.doesNotMatch(css.replace(/rgba\(0, 0, 0, 0\.35\)/g, ''), /#[0-9a-f]{3,6}\b/i, 'no colours of its own');
    const index = read('src/index.css');
    assert.match(index, /:root\[data-theme='light'\] \{[\s\S]*--accent:/);
  });
  it('clear messages when speech or voices are missing; no silent switch to an online voice', () => {
    assert.match(ui, /Read-aloud isn’t available in this browser\./);
    assert.match(ui, /No voices are installed for read-aloud in this browser\./);
    assert.match(ui, /Online · text is sent to the provider/);
  });
  it('no network, no AI, no new dependency', () => {
    assert.doesNotMatch(ui + read('src/lib/tableRead.js') + read('src/lib/tableReadPrefs.js'), /fetch\(|XMLHttpRequest|WebSocket|indexedDB/);
    const pkg = JSON.parse(read('package.json'));
    assert.ok(!Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some((d) => /speech|tts|voice/i.test(d)));
  });
});
