// The shooting schedule (Plan → Stripboard → Schedule): which scenes are shot on which day, in order.
//
// Stored (project.production.schedule, saved in the .draftline file):
//   { days: [{ id, sceneIds: [sceneHeadingId…], date: 'YYYY-MM-DD' | null, note: '' }],
//     pagesTarget: eighths | null }
//
// That's all that's stored. Everything a strip or a day shows — scene number, heading, pages, cast,
// locations — is worked out from the script and the breakdown every time (productionEngine.js
// buildBreakdown), so it can never disagree with them. The screenplay itself is never touched: the
// schedule is an order of scene ids, separate from the script's order.
//
// Scenes on no day are "Unscheduled" (in script order); a new scene starts there. A scheduled scene
// whose heading leaves the script stays on its day, hidden, and comes back if the heading does (undo);
// scheduleModel reports it as missing so the writer can clear it on purpose (forgetMissing).
//
// No project has a schedule until its first shooting day: without one, the Stripboard is exactly as
// it always was. Removing the last day removes the schedule. Fields a newer DraftLine stores are kept.

import { addUnknownFields, jsonCopy } from './passThrough.js';

const SCHEDULE_KEYS = new Set(['days', 'pagesTarget']);
const DAY_KEYS = new Set(['id', 'sceneIds', 'date', 'note']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** "Several locations" note from this many distinct places in a day (a hint, not a company move). */
export const LOCATION_NOTE_AT = 3;

const validDate = (d) => {
  if (typeof d !== 'string' || !DATE_RE.test(d)) return null;
  const t = new Date(`${d}T00:00:00Z`);
  return Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== d ? null : d;
};

/**
 * Stored data → a clean schedule, or null when there are no days. Each scene sits on one day at most
 * (its first); day ids are unique; dates are real dates or null; the page target is a positive whole
 * number of eighths or null.
 */
export function normalizeSchedule(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Array.isArray(raw.days)) return null;
  const seenDays = new Set();
  const seenScenes = new Set();
  const days = [];
  for (const d of raw.days) {
    if (!d || typeof d !== 'object' || typeof d.id !== 'string' || !d.id || seenDays.has(d.id)) continue;
    seenDays.add(d.id);
    const sceneIds = [];
    for (const id of Array.isArray(d.sceneIds) ? d.sceneIds : []) {
      if (typeof id === 'string' && id && !seenScenes.has(id)) {
        seenScenes.add(id);
        sceneIds.push(id);
      }
    }
    const day = { id: d.id, sceneIds, date: validDate(d.date), note: typeof d.note === 'string' ? d.note : '' };
    addUnknownFields(day, d, DAY_KEYS);
    days.push(day);
  }
  if (!days.length) return null;
  const t = raw.pagesTarget;
  const out = { days, pagesTarget: Number.isInteger(t) && t > 0 && t <= 8 * 200 ? t : null };
  addUnknownFields(out, raw, SCHEDULE_KEYS);
  return out;
}

/** A schedule with no days left (or nothing at all): stored as no schedule. */
export const isEmptySchedule = (raw) => raw == null || (typeof raw === 'object' && !Array.isArray(raw) && Array.isArray(raw.days)
  && !raw.days.some((d) => d && typeof d === 'object' && typeof d.id === 'string' && d.id));

/**
 * Can this version read and edit the project's schedule? Yes when there's none, or it's in the shape
 * above. A schedule from a newer DraftLine in another shape is kept untouched and never overwritten.
 */
export const scheduleIsReadable = (raw) => raw == null || !!normalizeSchedule(raw) || isEmptySchedule(raw);

const newDayId = (days) => {
  let id;
  do id = `day-${Math.random().toString(36).slice(2, 10)}`;
  while (days.some((d) => d.id === id));
  return id;
};
const clone = (s) => normalizeSchedule(jsonCopy(s));

// ---- Actions (pure: each returns a new schedule, or null when no day is left) -------------------

/** A new, empty shooting day at the end (or after day `afterId`). → { schedule, dayId } */
export function addDay(schedule, { afterId = null } = {}) {
  const s = clone(schedule) || { days: [], pagesTarget: null };
  const id = newDayId(s.days);
  const at = afterId ? s.days.findIndex((d) => d.id === afterId) + 1 : s.days.length;
  s.days.splice(at > 0 ? at : s.days.length, 0, { id, sceneIds: [], date: null, note: '' });
  return { schedule: s, dayId: id };
}

/** Remove a day; its scenes go back to Unscheduled. The last day gone: no schedule (null). */
export function removeDay(schedule, dayId) {
  const s = clone(schedule);
  if (!s) return null;
  s.days = s.days.filter((d) => d.id !== dayId);
  return s.days.length ? s : null;
}

/** Move a day to position `index` (0-based); its scenes go with it. */
export function moveDay(schedule, dayId, index) {
  const s = clone(schedule);
  if (!s) return null;
  const from = s.days.findIndex((d) => d.id === dayId);
  if (from < 0) return s;
  const [day] = s.days.splice(from, 1);
  s.days.splice(Math.max(0, Math.min(index, s.days.length)), 0, day);
  return s;
}

/**
 * Put a scene on day `dayId` at position `index` (end when null), or back to Unscheduled with
 * dayId null. It leaves wherever it was, so a scene is never on two days.
 */
export function moveScene(schedule, sceneId, dayId, index = null) {
  const s = clone(schedule);
  if (!s) return null;
  for (const d of s.days) d.sceneIds = d.sceneIds.filter((id) => id !== sceneId);
  const day = dayId ? s.days.find((d) => d.id === dayId) : null;
  if (day) {
    const at = index == null ? day.sceneIds.length : Math.max(0, Math.min(index, day.sceneIds.length));
    day.sceneIds.splice(at, 0, sceneId);
  }
  return s;
}

/** A day's date ('YYYY-MM-DD', or null to clear it). */
export function setDayDate(schedule, dayId, date) {
  const s = clone(schedule);
  if (!s) return null;
  const day = s.days.find((d) => d.id === dayId);
  if (day) day.date = validDate(date);
  return s;
}

/** A day's note. */
export function setDayNote(schedule, dayId, note) {
  const s = clone(schedule);
  if (!s) return null;
  const day = s.days.find((d) => d.id === dayId);
  if (day) day.note = String(note ?? '');
  return s;
}

/** The page target for every day, in eighths (null: none, and no "over target" notes). */
export function setPagesTarget(schedule, eighths) {
  const s = clone(schedule);
  if (!s) return null;
  s.pagesTarget = Number.isInteger(eighths) && eighths > 0 ? eighths : null;
  return s;
}

/**
 * Dates for day `dayId` and every day after it, one calendar day apart from `start`, skipping
 * Saturdays and Sundays when asked. Days before it keep theirs.
 */
export function fillDates(schedule, dayId, start, { skipWeekends = true } = {}) {
  const s = clone(schedule);
  const first = validDate(start);
  if (!s || !first) return s;
  const from = s.days.findIndex((d) => d.id === dayId);
  if (from < 0) return s;
  const t = new Date(`${first}T00:00:00Z`);
  const weekend = () => skipWeekends && (t.getUTCDay() === 0 || t.getUTCDay() === 6);
  while (weekend()) t.setUTCDate(t.getUTCDate() + 1);
  for (let i = from; i < s.days.length; i++) {
    s.days[i].date = t.toISOString().slice(0, 10);
    do t.setUTCDate(t.getUTCDate() + 1);
    while (weekend());
  }
  return s;
}

/** Clear scheduled scenes that aren't in the script any more (on purpose: Plan → "Remove"). */
export function forgetMissing(schedule, sceneIdsInScript) {
  const s = clone(schedule);
  if (!s) return null;
  const keep = new Set(sceneIdsInScript);
  for (const d of s.days) d.sceneIds = d.sceneIds.filter((id) => keep.has(id));
  return s;
}

// ---- What the Stripboard shows (derived, never stored) -------------------------------------------

/** "Tue 12 May" in the writer's locale (the date is a calendar day: no time zone shifts). */
export function dayDateLabel(date, locale) {
  if (!validDate(date)) return '';
  const t = new Date(`${date}T12:00:00Z`);
  try {
    return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(t);
  } catch {
    return date;
  }
}

/** A scripted location's place, for the "several locations" hint: "FACTORY BUILDING - OFFICE" → "FACTORY BUILDING". */
export const basePlace = (location) => String(location || '').split(/\s+[-–—]+\s+/)[0].trim().toUpperCase();

/**
 * The schedule laid over the breakdown rows (buildBreakdown, script order):
 *   days:        [{ id, number, date, note, rows, eighths, cast: [{ name, number, code }], places,
 *                   requirements: { props, wardrobe, extras, vehicles }, notes: [{ kind, text }], missing }]
 *                code (Day-Out-of-Days): SW start · W work · WF finish · SWF one day only · H hold
 *                (between an actor's first and last day without working); cast held that day are
 *                listed too, with code H
 *   unscheduled: rows on no day, in script order
 *   dayOf:       Map sceneId → day number (Script view's D3)
 *   missing:     scheduled scene ids no longer in the script
 *   noteCount:   days with at least one note
 * Notes are advisory, never errors: over the page target (only when one is set), day and night scenes
 * together, several places (LOCATION_NOTE_AT or more distinct places; one property can hold several).
 */
export function scheduleModel(rows, schedule) {
  const s = normalizeSchedule(schedule);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out = { days: [], unscheduled: [], dayOf: new Map(), missing: [], noteCount: 0, scheduledCount: 0 };
  if (!s) {
    out.unscheduled = rows.slice();
    return out;
  }
  const placed = new Set();
  s.days.forEach((d, i) => {
    const dayRows = [];
    const missing = [];
    for (const id of d.sceneIds) {
      const r = byId.get(id);
      if (r) {
        dayRows.push(r);
        placed.add(id);
        out.dayOf.set(id, i + 1);
      } else {
        missing.push(id);
        out.missing.push(id);
      }
    }
    const eighths = dayRows.reduce((n, r) => n + (r.eighths || 0), 0);
    const castMap = new Map();
    for (const r of dayRows) for (const c of r.cast) castMap.set(c.name, c.number);
    const places = [...new Set(dayRows.map((r) => basePlace(r.location || r.heading)).filter(Boolean))];
    const requirements = {};
    for (const k of ['props', 'wardrobe', 'extras', 'vehicles']) {
      const seen = new Map();
      for (const r of dayRows) for (const item of r[k] || []) if (!seen.has(item.toLowerCase())) seen.set(item.toLowerCase(), item);
      requirements[k] = [...seen.values()];
    }
    const periods = new Set(dayRows.map((r) => r.period).filter(Boolean));
    const notes = [];
    if (s.pagesTarget && eighths > s.pagesTarget) notes.push({ kind: 'target', text: 'Over the page target' });
    if (periods.has('day') && periods.has('night')) notes.push({ kind: 'daynight', text: 'Day and night scenes on the same day' });
    if (places.length >= LOCATION_NOTE_AT) notes.push({ kind: 'places', text: `${places.length} different places: possibly more than one location` });
    if (notes.length) out.noteCount += 1;
    out.scheduledCount += dayRows.length;
    out.days.push({
      id: d.id, number: i + 1, date: d.date, note: d.note, rows: dayRows, eighths,
      cast: [...castMap].map(([name, number]) => ({ name, number })).sort((a, b) => a.number - b.number),
      places, requirements, notes, missing,
    });
  });
  out.unscheduled = rows.filter((r) => !placed.has(r.id));
  // Day-Out-of-Days codes for each day's cast, and who's on hold.
  const span = new Map(); // name → { first, last, number }
  out.days.forEach((d, i) => {
    for (const c of d.cast) {
      const sp = span.get(c.name) || { first: i, last: i, number: c.number };
      sp.last = i;
      span.set(c.name, sp);
    }
  });
  out.days.forEach((d, i) => {
    const working = new Set(d.cast.map((c) => c.name));
    d.cast = d.cast.map((c) => {
      const sp = span.get(c.name);
      const code = sp.first === sp.last ? 'SWF' : i === sp.first ? 'SW' : i === sp.last ? 'WF' : 'W';
      return { ...c, code };
    });
    d.hold = [...span].filter(([name, sp]) => !working.has(name) && i > sp.first && i < sp.last)
      .map(([name, sp]) => ({ name, number: sp.number, code: 'H' })).sort((a, b) => a.number - b.number);
  });
  return out;
}

/** Day-Out-of-Days codes (scheduleModel's `code`): the long name, and what it means for a character that day. */
export const DOOD_CODES = {
  SW: ['Start · Work', 'their first shooting day'],
  W: ['Work', 'works this day, between their first and last'],
  WF: ['Work · Finish', 'their last shooting day'],
  SWF: ['Start · Work · Finish', 'their only shooting day'],
  H: ['Hold', 'not working this day, but between their first and last, so still booked'],
};

// ---- The Script | Schedule choice: a preference on this device, per project ----------------------

export const STRIP_VIEW_KEY = 'draftline:stripView:v1';
const store = () => {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
};
/** 'script' | 'schedule' | null (not chosen yet: Schedule once there's a day). */
export function loadStripView(projectId) {
  try {
    const v = JSON.parse(store()?.getItem(STRIP_VIEW_KEY) || '{}')?.[projectId];
    return v === 'script' || v === 'schedule' ? v : null;
  } catch {
    return null;
  }
}
export function saveStripView(projectId, view) {
  if (!projectId || (view !== 'script' && view !== 'schedule')) return false;
  try {
    let all = {};
    try {
      all = JSON.parse(store()?.getItem(STRIP_VIEW_KEY) || '{}') || {};
    } catch { /* start again */ }
    const ids = Object.keys(all).filter((k) => k !== projectId).slice(-199); // keep it small
    const next = Object.fromEntries(ids.map((k) => [k, all[k]]));
    next[projectId] = view;
    store()?.setItem(STRIP_VIEW_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}
