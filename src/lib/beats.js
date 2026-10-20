// Beat Board model: index cards in act columns, plus outline exporters.
//
// Every card stores one of four underlying acts (0 = Act 1, 1 = Act 2A, 2 = Act 2B,
// 3 = Act 3). The 3-Act and 4-Act structures are only two ways of *displaying* those
// acts, so switching between them never changes or loses a card. In 3-Act mode the
// "Act 2" column shows 2A then 2B with a midpoint divider between them; where a card
// is dropped relative to that divider decides whether it is 2A or 2B.

export const ACTS = [
  { label: 'Act 1', name: 'Setup' },
  { label: 'Act 2A', name: 'Escalation to Midpoint' },
  { label: 'Act 2B', name: 'Fall & Crisis' },
  { label: 'Act 3', name: 'Climax & Resolution' },
];

export const STRUCTURES = {
  4: [
    { label: 'Act 1', name: 'Setup', acts: [0] },
    { label: 'Act 2A', name: 'Escalation to Midpoint', acts: [1] },
    { label: 'Act 2B', name: 'Fall & Crisis', acts: [2] },
    { label: 'Act 3', name: 'Climax & Resolution', acts: [3] },
  ],
  3: [
    { label: 'Act 1', name: 'Setup', acts: [0] },
    { label: 'Act 2', name: 'Confrontation', acts: [1, 2] },
    { label: 'Act 3', name: 'Climax & Resolution', acts: [3] },
  ],
};

export function structureFor(mode) {
  return STRUCTURES[mode] || STRUCTURES[4];
}

export const TAGS = [
  { id: 'plot', label: 'Plot' },
  { id: 'subplot', label: 'Subplot' },
  { id: 'character', label: 'Character' },
  { id: 'theme', label: 'Theme' },
];

let counter = 0;
const seed = Math.random().toString(36).slice(2, 6);
export function newBeat(act, extra = {}) {
  counter += 1;
  return { id: `beat${seed}${counter.toString(36)}`, act, title: '', synopsis: '', tag: 'plot', ...extra };
}

export function validBeats(beats) {
  return Array.isArray(beats)
    && beats.every((b) => b && typeof b.id === 'string' && Number.isInteger(b.act) && b.act >= 0 && b.act < ACTS.length);
}

/**
 * Move `id` into column `act` at position `index` (counted among that column's
 * cards with the moved card excluded). Returns a new array.
 */
export function moveBeat(beats, id, act, index) {
  const card = beats.find((b) => b.id === id);
  if (!card) return beats;
  const rest = beats.filter((b) => b.id !== id);
  const moved = { ...card, act };
  const column = rest.filter((b) => b.act === act);
  let at;
  if (index < column.length) {
    at = rest.indexOf(column[Math.max(0, index)]);
  } else if (column.length) {
    at = rest.indexOf(column[column.length - 1]) + 1;
  } else {
    at = rest.length;
  }
  rest.splice(at, 0, moved);
  return rest;
}

export function byAct(beats) {
  const cols = ACTS.map(() => []);
  for (const b of beats) cols[b.act]?.push(b);
  return cols;
}

const tagLabel = (id) => TAGS.find((t) => t.id === id)?.label || '';

/** Fountain outline: acts as # sections, beats as ## sections with = synopses. */
export function beatsToFountain(beats, title, mode = 4) {
  const out = [];
  if (title) out.push(`Title: ${title}`, '');
  const acts = byAct(beats);
  for (const col of structureFor(mode)) {
    out.push(`# ${col.label}: ${col.name}`, '');
    col.acts.forEach((a, i) => {
      if (i > 0 && acts[col.acts[0]].length && acts[a].length) out.push('[[Midpoint]]', '');
      for (const b of acts[a]) {
        out.push(`## ${b.title.trim() || 'Untitled beat'}`);
        const syn = b.synopsis.trim();
        if (syn) for (const line of syn.split('\n')) if (line.trim()) out.push(`= ${line.trim()}`);
        if (b.tag) out.push(`[[${tagLabel(b.tag)}]]`);
        out.push('');
      }
    });
  }
  return `${out.join('\n').trim()}\n`;
}

/** Markdown outline. */
export function beatsToMarkdown(beats, title, mode = 4) {
  const out = [`# ${title || 'Untitled'} — Beat Outline`, ''];
  const acts = byAct(beats);
  let n = 0;
  for (const col of structureFor(mode)) {
    out.push(`## ${col.label}: ${col.name}`, '');
    if (col.acts.every((a) => !acts[a].length)) out.push('_No beats yet._', '');
    col.acts.forEach((a, i) => {
      if (i > 0 && acts[col.acts[0]].length && acts[a].length) out.push('*— Midpoint —*', '');
      for (const b of acts[a]) {
        n += 1;
        out.push(`### ${n}. ${b.title.trim() || 'Untitled beat'}${b.tag ? ` · *${tagLabel(b.tag)}*` : ''}`);
        if (b.synopsis.trim()) out.push('', b.synopsis.trim());
        out.push('');
      }
    });
  }
  return `${out.join('\n').trim()}\n`;
}

/** Starter beats for the sample script. */
export function sampleBeats() {
  return [
    newBeat(0, { title: 'Flight at dawn', synopsis: 'Marie slips out before sunrise. Theo catches her at the pier, barefoot.', tag: 'plot' }),
    newBeat(0, { title: 'Tickets or goodbyes', synopsis: 'Augustin forces the choice: get on the last ferry or let her go.', tag: 'character' }),
    newBeat(1, { title: 'The letter', synopsis: 'Marie left Manman a letter nobody can read — Theo will have to.', tag: 'subplot' }),
    newBeat(1, { title: 'The pier slides away', synopsis: 'Point of no return. Both of them are on the boat now.', tag: 'plot' }),
    newBeat(2, { title: 'Father at the bow', synopsis: 'Augustin: "Like the sea owed him money." Marie is her father’s daughter.', tag: 'character' }),
    newBeat(2, { title: '"Don’t come after me"', synopsis: 'Theo reads the one line she didn’t cross out. All is lost between them.', tag: 'subplot' }),
    newBeat(3, { title: 'Turn us around', synopsis: 'Marie chooses to go back — into the storm, toward home.', tag: 'plot' }),
    newBeat(3, { title: 'Their father’s laugh', synopsis: 'Theo laughs, and it’s their father’s laugh. Something healed.', tag: 'theme' }),
  ];
}

// ---- Populate from Script --------------------------------------------------------------
//
// Scene cards: one beat per scene heading, titled "12. INT. HOTEL BALLROOM - NIGHT", with
// the first sentence of the scene's first action as its synopsis and a `sceneId` link
// back to the heading. They are placed into act columns either by page targets or by
// scene ranges the writer types in.
//
// Page targets are proportional to the script's length (a 96-page script: Act 1 ends on
// p. 24, i.e. 25%). A scene is never split: it belongs wholly to the act its first page
// falls in.
//
// Act 2 lane memory: every card stores its underlying act — 1 = Act 2A, 2 = Act 2B — so
// the 3-Act view (one Act 2 column with a Midpoint divider) and the 4-Act view are just
// two displays of the same placement. Toggling never moves a card. When cards are placed
// in the 3-Act view, Act 2 scenes take their lane from the 50% midpoint page.

/** Upper bound (fraction of the script) of each column except the last. */
export const PAGE_PERCENTS = {
  3: [0.25, 0.75],
  4: [0.25, 0.5, 0.75],
};

const MIDPOINT = 0.5;

/** Last page of each column but the last, for a script of `totalPages`. Always increasing. */
export function pageBounds(mode, totalPages) {
  const pcts = PAGE_PERCENTS[mode] || PAGE_PERCENTS[4];
  const total = Math.max(1, Math.floor(totalPages) || 1);
  const out = [];
  for (const pct of pcts) out.push(Math.max((out[out.length - 1] ?? 0) + 1, Math.floor(total * pct)));
  return out;
}

/** [{ from, to }] per visible column (the last is open-ended). */
export function pageTargetsFor(mode, totalPages) {
  const b = pageBounds(mode, totalPages);
  return [...b.map((to, i) => ({ from: i ? b[i - 1] + 1 : 1, to })), { from: b[b.length - 1] + 1, to: Infinity }];
}

/** "pp. 1–24 · 25–72 · 73+" for the menu. */
export function formatPageTargets(mode, totalPages) {
  const t = pageTargetsFor(mode, totalPages)
    .map(({ from, to }) => (to === Infinity ? `${from}+` : from === to ? `${from}` : `${from}–${to}`));
  return `pp. ${t.join(' · ')}`;
}

/** Visible column (0-based, in `mode`) for a scene starting on `page`. */
export function columnForPage(page, mode, totalPages) {
  const b = pageBounds(mode, totalPages);
  const i = b.findIndex((to) => page <= to);
  return i < 0 ? b.length : i;
}

/** Act 2 lane for a scene starting on `page`: 1 (2A) up to the midpoint page, else 2 (2B). */
export function act2Lane(page, totalPages) {
  return page <= Math.max(1, Math.floor(Math.max(1, totalPages) * MIDPOINT)) ? 1 : 2;
}

/** "The market is empty. Nobody stays." → "The market is empty." (capped for long run-ons). */
export function firstSentence(text, max = 180) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const m = t.match(/^.*?[.!?…]+["'”’)]*(?=\s|$)/);
  const s = m ? m[0] : t;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export const sceneCardTitle = (scene) => `${scene.number}. ${scene.heading.toUpperCase()}`;

const flatten = (cols) => cols.flat();

/**
 * Build the board from scene cards placed in visible columns.
 *   scenes     — [{ id, number, heading, page, snippet }] in script order
 *   columnOf   — (scene, index) → visible column in `mode`
 * Cards already linked to a scene keep their id and your edits (title, synopsis, tag) and
 * just move; new scenes get new cards; your own (unlinked) cards stay in their acts,
 * after the scene cards. Cards whose scene was deleted become ordinary cards.
 */
export function populateBeats(beats, scenes, mode, columnOf, totalPages) {
  const total = totalPages || Math.max(1, ...scenes.map((sc) => sc.page || 1));
  const live = new Set(scenes.map((s) => s.id));
  const linked = new Map(beats.filter((b) => b.sceneId && live.has(b.sceneId)).map((b) => [b.sceneId, b]));
  const visible = structureFor(mode).map(() => []);
  const pageOf = new Map(scenes.map((sc) => [sc.id, sc.page]));
  let created = 0;
  scenes.forEach((s, i) => {
    const col = Math.max(0, Math.min(visible.length - 1, columnOf(s, i)));
    const prev = linked.get(s.id);
    if (!prev) created += 1;
    visible[col].push(prev || newBeat(0, {
      title: sceneCardTitle(s), synopsis: firstSentence(s.snippet), tag: 'plot', sceneId: s.id,
    }));
  });

  // Visible columns → underlying acts.
  const acts = [[], [], [], []];
  structureFor(mode).forEach((colDef, ci) => {
    if (colDef.acts.length === 1) acts[colDef.acts[0]] = visible[ci].map((c) => ({ ...c, act: colDef.acts[0] }));
    else {
      // 3-Act "Act 2": each card's lane (2A / 2B) comes from its scene's page vs the midpoint.
      for (const c of visible[ci]) {
        const lane = act2Lane(pageOf.get(c.sceneId) ?? 1, total);
        acts[lane].push({ ...c, act: lane });
      }
    }
  });

  // Your own cards (and ones whose scene is gone) stay where they were, after the scene cards.
  let kept = 0;
  for (const b of beats) {
    if (b.sceneId && live.has(b.sceneId)) continue;
    kept += 1;
    const { sceneId, ...rest } = b;
    acts[b.act].push(sceneId ? rest : b);
  }
  return { beats: flatten(acts), created, updated: scenes.length - created, kept };
}

/** Place scenes by the page each one starts on, against targets for a `totalPages` script. */
export function populateByPages(beats, scenes, mode, totalPages) {
  return populateBeats(beats, scenes, mode, (s) => columnForPage(s.page, mode, totalPages), totalPages);
}

// ---- Scene ranges ("1-12, 15") ---------------------------------------------------------

/** Parse "1-12, 15, 20–22" into scene numbers. Returns { numbers, error }. */
export function parseSceneRanges(input) {
  const numbers = [];
  const text = (input || '').trim();
  if (!text) return { numbers };
  for (const part of text.split(/[,;]+/)) {
    const p = part.trim();
    if (!p) continue;
    const m = p.match(/^(\d+)\s*(?:[-–—]|to|\.\.)\s*(\d+)$/i) || p.match(/^(\d+)$/);
    if (!m) return { numbers, error: `“${p}” isn’t a scene number or range (use e.g. 1-12, 15)` };
    const a = Number(m[1]);
    const b = Number(m[2] ?? m[1]);
    if (b < a) return { numbers, error: `“${p}” runs backwards` };
    for (let n = a; n <= b; n++) numbers.push(n);
  }
  return { numbers };
}

const listNums = (ns) => {
  const out = [];
  for (let i = 0; i < ns.length; i++) {
    let j = i;
    while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++;
    out.push(j > i ? `${ns[i]}–${ns[j]}` : `${ns[i]}`);
    i = j;
  }
  return out.join(', ');
};

/**
 * Check one range input per visible column against a script with `total` scenes.
 * Every scene 1…total must be in exactly one column. Returns
 * { ok, columnOfScene: Map(number → column), errors: [string], counts: [n per column] }.
 */
export function validateSceneRanges(inputs, total, mode) {
  const labels = structureFor(mode).map((c) => c.label);
  const errors = [];
  const columnOfScene = new Map();
  const counts = inputs.map(() => 0);
  const dupes = [];
  const outside = [];
  inputs.forEach((input, ci) => {
    const { numbers, error } = parseSceneRanges(input);
    if (error) errors.push(`${labels[ci]}: ${error}`);
    for (const n of numbers) {
      if (n < 1 || n > total) outside.push(n);
      else if (columnOfScene.has(n)) dupes.push(`${n} (${labels[columnOfScene.get(n)]} and ${labels[ci]})`);
      else {
        columnOfScene.set(n, ci);
        counts[ci] += 1;
      }
    }
  });
  if (inputs.length !== labels.length) errors.push(`Expected ${labels.length} ranges for ${mode} acts`);
  if (outside.length) errors.push(`No such scene${outside.length > 1 ? 's' : ''}: ${listNums([...new Set(outside)].sort((a, b) => a - b))} (the script has ${total})`);
  if (dupes.length) errors.push(`In two acts: scene ${dupes.slice(0, 3).join(', ')}${dupes.length > 3 ? '…' : ''}`);
  const missing = [];
  for (let n = 1; n <= total; n++) if (!columnOfScene.has(n)) missing.push(n);
  if (missing.length) errors.push(`Not assigned yet: scene${missing.length > 1 ? 's' : ''} ${listNums(missing)}`);
  return { ok: errors.length === 0, columnOfScene, errors, counts };
}

/** The page-target placement written as scene ranges, one per visible column (modal defaults). */
export function rangesFromPageTargets(scenes, mode, totalPages) {
  const cols = structureFor(mode).map(() => []);
  for (const s of scenes) cols[columnForPage(s.page, mode, totalPages)].push(s.number);
  return cols.map((ns) => listNums(ns).replace(/–/g, '-'));
}

/** Place scenes by validated ranges. */
export function populateByRanges(beats, scenes, mode, inputs, totalPages) {
  const v = validateSceneRanges(inputs, scenes.length, mode);
  if (!v.ok) return { error: v.errors.join(' · ') };
  return populateBeats(beats, scenes, mode, (s) => v.columnOfScene.get(s.number), totalPages);
}

// ---- Act pacing ----------------------------------------------------------------------------
//
// Each column's badge: how many pages its scene cards add up to, and what share of the
// script that is ("24 pgs · 25%"). A scene's length runs from its heading to the next one,
// in eighths of a page. Guidelines: 3 acts ≈ 25 / 50 / 25 %, 4 acts ≈ 25 % each; a column
// more than PACING_TOLERANCE points away from its share gets a status dot.

export const PACING_TARGETS = { 3: [25, 50, 25], 4: [25, 25, 25, 25] };
export const PACING_TOLERANCE = 7; // percentage points — e.g. Act 1 above 32 % is flagged

/** "24 pgs", "1 pg", "1.5 pgs", "6/8 pg" for a length in eighths. */
export function formatPacingPages(eighths) {
  if (eighths < 8) return `${eighths}/8 pg`;
  const pages = Math.round((eighths / 8) * 10) / 10;
  return `${pages} ${pages === 1 ? 'pg' : 'pgs'}`;
}

/**
 * Per visible column: { pages, eighths, pct, target, scenes, status, label, note }.
 *   scenes — [{ id, eighths }] in script order (every scene, so the % is of the whole script)
 * status: 'none' (no scene cards here), 'ok', 'long' or 'short'. Returns [] while the board
 * has no scene cards at all — there's nothing to pace yet.
 */
export function actPacing(beats, scenes, mode = 4) {
  const len = new Map(scenes.map((s) => [s.id, Math.max(0, s.eighths || 0)]));
  const total = [...len.values()].reduce((a, b) => a + b, 0);
  const cols = structureFor(mode);
  const linked = beats.filter((b) => b.sceneId && len.has(b.sceneId));
  if (!linked.length || !total) return [];
  const targets = PACING_TARGETS[mode] || PACING_TARGETS[4];
  return cols.map((col, i) => {
    const seen = new Set();
    let eighths = 0;
    for (const b of linked) {
      if (!col.acts.includes(b.act) || seen.has(b.sceneId)) continue;
      seen.add(b.sceneId);
      eighths += len.get(b.sceneId);
    }
    const pct = Math.round((eighths / total) * 100);
    const target = targets[i];
    const status = !seen.size ? 'none' : pct > target + PACING_TOLERANCE ? 'long' : pct < target - PACING_TOLERANCE ? 'short' : 'ok';
    const note = status === 'long'
      ? `${col.label} runs ${pct}% of the script — the usual share is about ${target}%`
      : status === 'short'
        ? `${col.label} is ${pct}% of the script — the usual share is about ${target}%`
        : status === 'ok' ? `${col.label}: ${pct}% of the script (guideline ≈ ${target}%)` : `No scene cards in ${col.label} yet`;
    return { pages: eighths / 8, eighths, pct, target, scenes: seen.size, status, label: `${formatPacingPages(eighths)} · ${pct}%`, note };
  });
}
