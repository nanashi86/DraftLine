// Plan → the scene filter in the header (Breakdowns and Stripboard): narrows which scenes show,
// never changes or reorders anything.
//   q   — text: matches the heading (location included), a speaking character, or the scene
//         number (a number on its own matches that scene exactly). Case and accents don't matter.
//   ie  — ['INT'] / ['EXT'] / both / none. INT./EXT. (and EXT./INT.) scenes count as both.
//   dn  — ['day'] / ['night'] / both / none, from the resolved time of day (CONTINUOUS takes the
//         light of the scene before). Scenes with no time of day only show when this is empty.

export const EMPTY_PLAN_FILTER = Object.freeze({ q: '', ie: [], dn: [] });

const fold = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();

/** Is any part of the filter set? */
export const planFilterActive = (f) => !!(f && (f.q.trim() || f.ie.length || f.dn.length));

/** Does scene `row` (a buildBreakdown() row) pass filter `f`? */
export function matchesPlanFilter(row, f = EMPTY_PLAN_FILTER) {
  if (f.ie.length) {
    const s = row.setting || '';
    const isInt = s === 'INT' || s.includes('/');
    const isExt = s === 'EXT' || s.includes('/');
    if (!((f.ie.includes('INT') && isInt) || (f.ie.includes('EXT') && isExt))) return false;
  }
  if (f.dn.length && !f.dn.includes(row.period)) return false;
  const q = fold(f.q).trim();
  if (!q) return true;
  if (/^\d+[A-Z]?$/.test(q)) return fold(row.number) === q;
  return fold(row.heading).includes(q)
    || fold(row.location).includes(q)
    || (row.cast || []).some((c) => fold(c.name).includes(q));
}

/** The rows that pass, and how many there were: { rows, shown, total }. */
export function filterPlanRows(rows = [], f = EMPTY_PLAN_FILTER) {
  const out = planFilterActive(f) ? rows.filter((r) => matchesPlanFilter(r, f)) : rows;
  return { rows: out, shown: out.length, total: rows.length };
}

/** Turn one toggle value on or off in a list ('INT' in f.ie, 'night' in f.dn…). */
export const toggleIn = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
