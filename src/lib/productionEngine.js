// Production planning (the Plan workspace): the breakdown of every scene, worked out from the
// script each time — slugline parts, day or night, length in page eighths, speaking cast with cast
// numbers — joined with the asset lists stored in productionData.js. Loaded with the Plan
// workspace, not with the app.

import { ELEMENT_META, PAGE_LINES, linesToEighths, wrapOffsets } from './screenplay.js';
import { headingParts, timeOfDayPeriod } from './sluglines.js';
import { csvField } from './exportCsvOutline.js';
import { PRODUCTION_BUCKETS, sceneAssets } from './productionData.js';

export * from './productionData.js';

// ---- Sluglines ----------------------------------------------------------------------------------

const SETTING_RE = /^(?:\d+[A-Z]?[.)]?\s+)?(INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|I\s*\/\s*E\.?|E\s*\/\s*I\.?|INT\.?|EXT\.?|EST\.?)(?=[\s.\-–—:]|$)\s*/i;
const PAREN = /\s*\(([^()]*)\)\s*/g;

/**
 * A scene heading → { setting, location, time, period, modifier }:
 *   "EXT. CROIX-DES-BOSSALES - NIGHT (FLASHBACK)"
 *     → { setting: 'EXT', location: 'CROIX-DES-BOSSALES', time: 'NIGHT', period: 'night', modifier: 'FLASHBACK' }
 *   setting:  'INT' | 'EXT' | 'INT/EXT' (INT./EXT., I/E) | 'EXT/INT' (EXT./INT., E/I) | null (no prefix)
 *   time:     the heading's own words for it — "NIGHT", "NEXT DAY", "MOMENTS LATER" (null if none)
 *   period:   'day' | 'night' | 'carry' (CONTINUOUS, LATER…: the scene before's light) | null
 *   modifier: the heading's parentheticals, without their parentheses — "FLASHBACK", "MOVING" (null if none)
 * The time of day is the last part (after the location) holding a day or night word, so
 * "NIGHT - BACK TO SCENE" and "DAY - CONTINUOUS" both read; failing that, the last CONTINUOUS / LATER.
 */
export function parseSlugline(text) {
  let t = String(text || '').replace(/\s+/g, ' ').trim();
  let setting = null;
  const m = SETTING_RE.exec(t);
  if (m) {
    const p = m[1].toUpperCase().replace(/[\s.]/g, '');
    setting = p === 'INT' ? 'INT' : p === 'EXT' || p === 'EST' ? 'EXT' : /^(?:INT|I)\//.test(p) ? 'INT/EXT' : 'EXT/INT';
    t = t.slice(m[0].length);
  }
  // Parentheticals are modifiers wherever they sit — "NIGHT (FLASHBACK)", "CAR (MOVING) - NIGHT" —
  // so they never hide the time of day or end up in the location.
  const mods = [];
  t = t.replace(PAREN, (_, inner) => {
    if (inner.trim()) mods.push(inner.trim().toUpperCase());
    return ' ';
  }).replace(/\s+/g, ' ').trim();
  const parts = headingParts(t);
  const periods = parts.map((part, i) => (i > 0 ? timeOfDayPeriod(part) : null));
  let at = periods.findLastIndex((x) => x === 'day' || x === 'night');
  if (at < 0) at = periods.findLastIndex((x) => x === 'carry');
  const time = at > 0 ? parts[at].replace(/[.\s]+$/, '').toUpperCase() : null;
  return {
    setting,
    location: (at > 0 ? parts.slice(0, at) : parts).join(' - ').toUpperCase(),
    time,
    period: at > 0 ? periods[at] : null,
    modifier: mods.length ? mods.join(' · ') : null,
  };
}

/**
 * Stripboard colour: INT. DAY white · EXT. DAY yellow · INT. NIGHT blue · EXT. NIGHT green.
 * Combined settings go by the side they lead with: INT./EXT. as interior, EXT./INT. as exterior.
 * Unknown (no prefix, or no day / night) → 'unknown'.
 */
export function stripColor(setting, period) {
  if (!setting || (period !== 'day' && period !== 'night')) return 'unknown';
  return `${setting.startsWith('INT') ? 'int' : 'ext'}-${period}`;
}
export const STRIP_COLORS = {
  'int-day': { label: 'INT. DAY', name: 'White' },
  'ext-day': { label: 'EXT. DAY', name: 'Yellow' },
  'int-night': { label: 'INT. NIGHT', name: 'Blue' },
  'ext-night': { label: 'EXT. NIGHT', name: 'Green' },
  unknown: { label: 'No day / night', name: 'Grey' },
};

// ---- Page eighths -------------------------------------------------------------------------------

/** 11 eighths → "1 3/8"; 6 → "6/8"; 16 → "2". */
export function eighthsLabel(eighths) {
  const e = Math.max(0, Math.round(eighths || 0));
  const whole = Math.floor(e / 8);
  const rem = e % 8;
  if (!whole) return `${rem}/8`;
  return rem ? `${whole} ${rem}/8` : `${whole}`;
}

/**
 * Lines each scene takes on the page, from its elements (wrapped at each element's width, plus the
 * blank lines before it) → Map sceneHeadingId → lines. The app passes its own measured layout
 * instead when it has one; this is the same arithmetic for when it doesn't (and for tests).
 */
export function sceneLineCounts(blocks) {
  const out = new Map();
  let current = null;
  for (const b of blocks || []) {
    if (b.type === 'scene') {
      current = b.id;
      out.set(current, 0);
    }
    if (!current) continue;
    const meta = ELEMENT_META[b.type] || ELEMENT_META.action;
    const lines = Math.max(1, wrapOffsets(String(b.text || ''), meta.cpl).length);
    out.set(current, out.get(current) + lines + (meta.spaceBefore || 0));
  }
  return out;
}
export const linesToSceneEighths = (lines) => linesToEighths(lines);
export { PAGE_LINES };

// ---- The breakdown ------------------------------------------------------------------------------

/** Cast numbers, as on a call sheet: 1 is the character with the most lines (analysis order). */
export function castNumbers(analysis) {
  return new Map((analysis?.characterList || []).map((c, i) => [c.name, i + 1]));
}

/**
 * Every scene's breakdown, in script order:
 *   [{ id, number, heading, setting, location, time, period, color, eighths, length, page,
 *      cast: [{ name, number }], ...assets (extras, props, wardrobe, vehicles, notes) }]
 *   blocks, analysis — the script and analyzeScript(blocks)
 *   scenes          — optional measured scenes ({ id, number, heading, page, eighths }) from the app
 *   production      — the stored asset lists
 */
export function buildBreakdown({ blocks = [], analysis, scenes = null, production } = {}) {
  const measured = new Map((scenes || []).map((s) => [s.id, s]));
  const lines = scenes ? null : sceneLineCounts(blocks);
  const numbers = castNumbers(analysis);
  const castByScene = new Map();
  for (const c of analysis?.characterList || []) {
    for (const en of c.entries) {
      const sid = analysis.sceneOfBlock?.[en.cue.id];
      if (!sid) continue;
      if (!castByScene.has(sid)) castByScene.set(sid, new Set());
      castByScene.get(sid).add(c.name);
    }
  }
  const out = [];
  let lastPeriod = null;
  for (const b of blocks) {
    if (b.type !== 'scene' || !String(b.text || '').trim()) continue;
    const m = measured.get(b.id);
    const slug = parseSlugline(b.text);
    // CONTINUOUS / LATER: the same light as the scene before.
    const period = slug.period === 'carry' ? lastPeriod : slug.period;
    if (period) lastPeriod = period;
    const eighths = m?.eighths ?? linesToEighths(lines?.get(b.id) || 1);
    const cast = [...(castByScene.get(b.id) || [])]
      .map((name) => ({ name, number: numbers.get(name) ?? null }))
      .sort((x, y) => (x.number ?? 999) - (y.number ?? 999));
    out.push({
      id: b.id,
      number: m?.number ?? analysis?.sceneNumbers?.[b.id] ?? out.length + 1,
      heading: String(b.text).trim(),
      ...slug,
      period,
      timeOfDay: period ? period.toUpperCase() : null, // resolved: DAY / NIGHT, CONTINUOUS included
      color: stripColor(slug.setting, period),
      eighths,
      length: eighthsLabel(eighths),
      page: m?.page ?? null,
      cast,
      ...sceneAssets(production, b.id),
    });
  }
  return out;
}

/** Totals for the Stripboard header: scenes, pages (as eighths), and how many of each strip colour. */
export function breakdownTotals(rows) {
  const colors = Object.fromEntries(Object.keys(STRIP_COLORS).map((k) => [k, 0]));
  let eighths = 0;
  for (const r of rows) {
    eighths += r.eighths;
    colors[r.color] += 1;
  }
  return { scenes: rows.length, eighths, length: eighthsLabel(eighths), colors };
}

/** Plan → Export Breakdown (.csv): one row per scene, everything on its breakdown. */
export function breakdownCsv(rows) {
  const head = ['Scene', 'Slugline', 'INT/EXT', 'Day/Night', 'Pages (8ths)', 'Page', 'Speaking Cast',
    ...PRODUCTION_BUCKETS.map((b) => b.label), 'Production Notes'];
  const body = rows.map((r) => [
    r.number, r.heading, r.setting || '', r.timeOfDay || '', r.length, r.page ?? '',
    r.cast.map((c) => (c.number ? `${c.number}. ${c.name}` : c.name)).join('; '),
    ...PRODUCTION_BUCKETS.map((b) => r[b.id].join('; ')), r.notes.trim(),
  ]);
  return `\uFEFF${[head, ...body].map((row) => row.map(csvField).join(',')).join('\r\n')}\r\n`;
}
