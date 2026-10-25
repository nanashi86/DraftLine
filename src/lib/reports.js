// Plan → Reports: the script read as numbers — Scenes, Characters, Locations and the Script as a
// whole. Worked out each time from the script (no stored data), using the same scene breakdown as
// Breakdowns and Stripboard (productionEngine.js buildBreakdown) and the character analysis
// (screenplay.js analyzeScript). Pure, and loaded with the Plan workspace.

import { eighthsLabel } from './productionEngine.js';
import { csvField } from './exportCsvOutline.js';
import { printedLines } from './voice.js';

const words = (t) => (String(t || '').match(/\S+/g) || []).length;
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

/** One row per scene, in script order (pages from the rows, else from the pagination). */
export function scenesReport(rows, pageOfBlock = {}) {
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    heading: r.heading,
    setting: r.setting || '',
    location: r.location || '',
    time: r.timeOfDay || r.time || '',
    page: r.page ?? pageOfBlock[r.id] ?? null,
    eighths: r.eighths,
    length: r.length,
    cast: r.cast.map((c) => c.name),
  }));
}

/**
 * One row per speaking character, most printed dialogue lines first: speeches (cues), dialogue lines as printed,
 * words, scenes they speak in, first and last page, and their share of all dialogue words.
 */
export function charactersReport(analysis, pageOfBlock = {}) {
  const list = analysis?.characterList || [];
  const total = list.reduce((n, c) => n + c.words, 0);
  const rows = list.map((c) => {
    const pages = c.entries.map((e) => pageOfBlock[e.cue.id]).filter((p) => p != null);
    return {
      name: c.name,
      speeches: c.entries.length,
      lines: c.entries.reduce((n, e) => n + e.parts.filter((p) => p.type === 'dialogue').reduce((m, p) => m + printedLines(p.text), 0), 0),
      words: c.words,
      scenes: c.scenes.size,
      firstPage: pages.length ? Math.min(...pages) : null,
      lastPage: pages.length ? Math.max(...pages) : null,
      share: pct(c.words, total),
    };
  });
  // Most printed lines first (the column the table shows), then most words, then A–Z.
  return rows.sort((a, b) => b.lines - a.lines || b.words - a.words || a.name.localeCompare(b.name));
}

/** One row per place (setting + location), most screen time first, with the scenes set there. */
export function locationsReport(rows) {
  const by = new Map();
  for (const r of rows) {
    const name = r.location || r.heading || '(no location)';
    if (!by.has(name)) by.set(name, { location: name, settings: new Set(), times: new Set(), scenes: [], eighths: 0 });
    const l = by.get(name);
    if (r.setting) l.settings.add(r.setting);
    if (r.timeOfDay || r.time) l.times.add(r.timeOfDay || r.time);
    l.scenes.push({ id: r.id, number: r.number });
    l.eighths += r.eighths;
  }
  return [...by.values()]
    .map((l) => ({
      location: l.location,
      setting: [...l.settings].join(' · '),
      times: [...l.times].join(' · '),
      count: l.scenes.length,
      scenes: l.scenes,
      eighths: l.eighths,
      length: eighthsLabel(l.eighths),
    }))
    .sort((a, b) => b.eighths - a.eighths || b.count - a.count || a.location.localeCompare(b.location));
}

/** The script at a glance. */
export function scriptReport({ blocks = [], rows = [], analysis, pageCount = 0 }) {
  let dialogue = 0;
  let action = 0;
  for (const b of blocks) {
    if (b.type === 'dialogue') dialogue += words(b.text);
    else if (b.type === 'action') action += words(b.text);
  }
  const eighths = rows.reduce((n, r) => n + r.eighths, 0);
  const longest = rows.reduce((m, r) => (!m || r.eighths > m.eighths ? r : m), null);
  const count = (pred) => rows.filter(pred).length;
  return {
    pages: pageCount,
    scenes: rows.length,
    words: analysis?.words ?? blocks.reduce((n, b) => n + words(b.text), 0),
    speaking: analysis?.characterList?.length || 0,
    dialogueWords: dialogue,
    actionWords: action,
    dialogueShare: pct(dialogue, dialogue + action),
    interior: count((r) => r.setting === 'INT' || r.setting === 'INT/EXT'),
    exterior: count((r) => r.setting === 'EXT' || r.setting === 'EXT/INT'),
    day: count((r) => r.period === 'day'),
    night: count((r) => r.period === 'night'),
    averageLength: rows.length ? eighthsLabel(Math.round(eighths / rows.length)) : '—',
    longest: longest ? { id: longest.id, number: longest.number, heading: longest.heading, length: longest.length } : null,
  };
}

/** Every report from the breakdown rows (buildBreakdown) and the script. */
export function buildReports({ rows, blocks, analysis, layout }) {
  return {
    scenes: scenesReport(rows, layout?.pageOfBlock),
    characters: charactersReport(analysis, layout?.pageOfBlock),
    locations: locationsReport(rows),
    script: scriptReport({ blocks, rows, analysis, pageCount: layout?.pageCount ?? 0 }),
  };
}

const csv = (head, body) => `\uFEFF${[head, ...body].map((row) => row.map(csvField).join(',')).join('\r\n')}\r\n`;

/** Each report as a spreadsheet (.csv, UTF-8 with BOM so Excel reads accents). */
export function reportCsv(kind, reports) {
  if (kind === 'scenes') {
    return csv(['Scene', 'Slugline', 'INT/EXT', 'Time', 'Page', 'Length (8ths)', 'Speaking Cast'],
      reports.scenes.map((r) => [r.number, r.heading, r.setting, r.time, r.page ?? '', r.length, r.cast.join('; ')]));
  }
  if (kind === 'characters') {
    return csv(['Character', 'Speeches', 'Dialogue Lines', 'Words', 'Scenes', 'First Page', 'Last Page', 'Share of Dialogue (%)'],
      reports.characters.map((c) => [c.name, c.speeches, c.lines, c.words, c.scenes, c.firstPage ?? '', c.lastPage ?? '', c.share]));
  }
  if (kind === 'locations') {
    return csv(['Location', 'INT/EXT', 'Times', 'Scenes', 'Scene Numbers', 'Screen Time (8ths)'],
      reports.locations.map((l) => [l.location, l.setting, l.times, l.count, l.scenes.map((s) => s.number).join(' '), l.length]));
  }
  const s = reports.script;
  return csv(['Measure', 'Value'], [
    ['Pages', s.pages], ['Scenes', s.scenes], ['Words', s.words], ['Speaking characters', s.speaking],
    ['Dialogue words', s.dialogueWords], ['Action words', s.actionWords], ['Dialogue share (%)', s.dialogueShare],
    ['Interior scenes', s.interior], ['Exterior scenes', s.exterior], ['Day scenes', s.day], ['Night scenes', s.night],
    ['Average scene length (8ths)', s.averageLength], ['Longest scene', s.longest ? `${s.longest.number}. ${s.longest.heading} (${s.longest.length})` : ''],
  ]);
}
