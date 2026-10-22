// Export → Scene outline → Spreadsheet (.csv): the Scene Board as a spreadsheet, one row per card
// in board order (act by act), for Excel, Numbers or Google Sheets.

import { ACTS, TAGS, beatTags, byAct, structureFor, valueShiftInfo } from './beats.js';

export const CSV_COLUMNS = ['Scene Number', 'Act', 'Heading', 'Summary', 'Tags', 'Value Shift', 'Page'];

/** One CSV field: quoted when it holds a comma, quote or line break (quotes doubled). */
export function csvField(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** "The Last Ferry" → "The_Last_Ferry_Scene_Outline.csv" (only characters safe in a file name). */
export function csvOutlineFileName(title) {
  const stem = String(title || '').trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, '_').replace(/^_+|_+$/g, '') || 'Untitled';
  return `${stem}_Scene_Outline.csv`;
}

/**
 * The rows: [CSV_COLUMNS, ...one per card]. A card linked to a scene takes its number, heading and
 * page from the script (`scenes`: [{ id, number, heading, page }]); otherwise its own headline.
 * Acts are named for the board's current structure (3 or 4 acts).
 */
export function outlineRows(beats, { scenes = [], mode = 4 } = {}) {
  const byId = new Map(scenes.map((s) => [s.id, s]));
  const actName = new Map();
  for (const col of structureFor(mode)) for (const a of col.acts) actName.set(a, `${col.label}: ${col.name}`);
  const rows = [CSV_COLUMNS];
  const cols = byAct(beats || []);
  ACTS.forEach((_, a) => {
    for (const b of cols[a]) {
      const sc = b.sceneId ? byId.get(b.sceneId) : null;
      const title = String(b.title || '').trim();
      const synopsis = String(b.synopsis || '').trim();
      const heading = sc?.heading || title;
      const summary = sc && title && title !== sc.heading ? [title, synopsis].filter(Boolean).join(' — ') : synopsis;
      const tags = beatTags(b).map((id) => TAGS.find((t) => t.id === id)?.label).filter(Boolean).join('; ');
      const shift = valueShiftInfo(b.valueShift);
      rows.push([sc?.number ?? '', actName.get(a) ?? '', heading, summary, tags, shift ? `${shift.label} (${shift.hint})` : '', sc?.page ?? '']);
    }
  });
  return rows;
}

/** The file's text: CRLF lines (what spreadsheets expect) with a UTF-8 BOM so accents survive Excel. */
export function outlineCsv(beats, opts) {
  return `\uFEFF${outlineRows(beats, opts).map((r) => r.map(csvField).join(',')).join('\r\n')}\r\n`;
}
