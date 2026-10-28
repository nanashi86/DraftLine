// Export → Story Bible (PDF): Story DNA, Story Notes and Character Bios as one printable dossier.
//
// Two steps, so what goes in can be tested apart from how it looks:
//   bibleExportPayload(project, selection) → plain data: only the sections that are switched on;
//   bibleHtml(payload)                     → a self-contained HTML document styled for print.
// The app prints that document from its own window (lib/printTitle.js), so Chrome's "Save as PDF"
// suggests "<Title> - Story Bible.pdf". No PDF library, nothing to download.

import { CHARACTER_FIELDS, NOTES_ORDER, actsFor, normalizeStoryNotes, roleSummary, treatmentActHeading, validGender } from './bible.js';
import { DNA_QUESTIONS, normalizeStoryDna, plotDeviceLayout } from './storyDna.js';
import { printDocument } from './printTitle.js';

export const BIBLE_SECTIONS = [
  { id: 'dna', label: 'Story DNA', hint: 'Genre, Theme, 8 Narrative Beats' },
  { id: 'notes', label: 'Story Notes', hint: 'Synopsis & Multi-Act Treatment' },
  { id: 'characters', label: 'Character Bios', hint: 'All characters with populated bios/descriptions' },
];
export const ALL_SECTIONS = Object.fromEntries(BIBLE_SECTIONS.map((s) => [s.id, true]));
export const DOSSIER_LABEL = 'STORY BIBLE & PROJECT DOSSIER';
/**
 * Your own note cards go in only when their title has "Note" in it ("Note: Haiti 1986", "Director's
 * notes", "Note Revisions"); research prompts, questions and brainstorms stay in DraftLine. The
 * Scratchpad never goes, whatever it's called.
 */
export const isExportableNote = (title) => /note/i.test(String(title || '')) && !/scratch\s*pad/i.test(String(title || ''));

const clean = (v) => (typeof v === 'string' ? v.trim() : '');
export const anySelected = (sel) => BIBLE_SECTIONS.some((s) => sel?.[s.id]);
export const bibleFileTitle = (title) => `${clean(title) || 'Untitled'} - Story Bible`;

/** A character worth a page: a name plus anything else filled in (a role, age, bio…). */
export function hasBio(c) {
  if (!clean(c?.name)) return false;
  return !!roleSummary(c) || !!validGender(c.gender) || CHARACTER_FIELDS.some((f) => f.key !== 'name' && clean(c[f.key]));
}

function dnaSection(rawDna) {
  const dna = normalizeStoryDna(rawDna);
  const genres = dna.genres.filter((g) => g !== 'Other');
  if (dna.genres.includes('Other') && clean(dna.genreOther)) genres.push(clean(dna.genreOther));
  const devices = plotDeviceLayout(dna).filter((d) => d.kind === 'device' && d.info)
    .map((d) => ({ label: d.info.label, on: d.on === true, notes: clean(d.notes) }))
    .filter((d) => d.on || d.notes); // "Yes", or anything written about it
  return {
    id: 'dna',
    heading: 'Story DNA',
    meta: [
      { label: 'Genre', value: genres.join(' · ') },
      { label: 'Theme', value: clean(dna.theme) },
      { label: 'Conflict', value: clean(dna.conflictType) },
    ].filter((m) => m.value),
    devices,
    beats: DNA_QUESTIONS.map((q, i) => ({ n: i + 1, label: q.label, question: q.question, text: clean(dna.answers[q.key]) })),
  };
}

function notesSection(rawNotes, actMode) {
  const notes = normalizeStoryNotes(rawNotes);
  const key = (t) => t.trim().toLowerCase();
  const standard = new Set(NOTES_ORDER.map(key));
  const byTitle = (t) => notes.sections.find((s) => key(s.title) === key(t));
  const acts = (card, value) => actsFor(card, actMode, value)
    .map((a) => ({ key: a.key, label: card === 'treatment' ? treatmentActHeading(a) : a.label, text: clean(value[a.key]) }));
  return {
    id: 'notes',
    heading: 'Story Notes',
    // Always in this order: Logline · Tone · Pitch · Timeline · Synopsis · Treatment · your "Note…" cards.
    logline: clean(byTitle('Logline')?.body),
    cards: NOTES_ORDER.slice(1).map((t) => ({ title: t, body: clean(byTitle(t)?.body) })).filter((c) => c.body),
    synopsis: acts('synopsis', notes.synopsis),
    treatment: acts('treatment', notes.treatment),
    others: notes.sections
      .filter((s) => !standard.has(key(s.title)) && isExportableNote(s.title) && clean(s.body))
      .map((s) => ({ title: clean(s.title), body: clean(s.body) })),
  };
}

function charactersSection(characters) {
  const list = (Array.isArray(characters) ? characters : []).filter(hasBio).map((c) => ({
    name: clean(c.name),
    role: roleSummary(c),
    age: clean(c.age),
    gender: validGender(c.gender),
    relationship: clean(c.relationship),
    fields: [
      { label: 'Physical Description', text: clean(c.description) },
      { label: 'Traits', text: clean(c.traits) },
      { label: 'Backstory / Motivation & Arc', text: clean(c.backstory) },
    ].filter((f) => f.text),
  }));
  return { id: 'characters', heading: 'Character Bios', characters: list };
}

/**
 * What the PDF holds — only the sections switched on in `selection` ({ dna, notes, characters }).
 *   project: { meta, storyDna, storyNotes, characters, actMode }
 */
export function bibleExportPayload({ meta = {}, storyDna, storyNotes, characters, actMode = 4 } = {}, selection = ALL_SECTIONS) {
  const title = clean(meta.title) || 'Untitled';
  const sections = [];
  if (selection?.dna) sections.push(dnaSection(storyDna));
  if (selection?.notes) sections.push(notesSection(storyNotes, actMode));
  if (selection?.characters) sections.push(charactersSection(characters));
  return { title, author: clean(meta.author), label: DOSSIER_LABEL, docTitle: bibleFileTitle(title), actMode, sections };
}

// ---- HTML ---------------------------------------------------------------------------------------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const inline = (s) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>');

/** Notes text (light Markdown) → paragraphs, bullet lists and small headings. */
export function textHtml(text) {
  const out = [];
  for (const para of clean(text).split(/\n[ \t]*\n+/)) {
    const lines = para.split('\n');
    if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
      out.push(`<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*•]\s+/, ''))}</li>`).join('')}</ul>`);
    } else if (/^#{1,6}\s+/.test(lines[0])) {
      out.push(`<h4>${inline(lines[0].replace(/^#{1,6}\s+/, ''))}</h4>`);
      if (lines.length > 1) out.push(`<p>${lines.slice(1).map(inline).join('<br>')}</p>`);
    } else if (para.trim()) {
      out.push(`<p>${lines.map(inline).join('<br>')}</p>`);
    }
  }
  return out.join('\n');
}

const empty = (what) => `<p class="empty">${esc(what)}</p>`;

function dnaHtml(s) {
  const meta = s.meta.length
    ? `<dl class="meta">${s.meta.map((m) => `<div><dt>${esc(m.label)}</dt><dd>${esc(m.value)}</dd></div>`).join('')}</dl>` : '';
  const devices = s.devices.length
    ? `<h3>Plot Devices</h3><ul class="devices">${s.devices.map((d) => `<li><strong>${esc(d.label)}</strong>${d.notes ? ` — ${inline(d.notes)}` : ''}</li>`).join('')}</ul>` : '';
  const beats = s.beats.map((b) => `
    <div class="beat">
      <div class="beat-label"><span class="beat-n">${b.n}</span>${esc(b.label)}<span class="beat-q">${esc(b.question)}</span></div>
      ${b.text ? textHtml(b.text) : empty('Not answered yet.')}
    </div>`).join('');
  return `${meta}${devices}<h3>The Eight Narrative Beats</h3>${beats}`;
}

function actsHtml(title, acts) {
  if (!acts.some((a) => a.text)) return `<h3>${esc(title)}</h3>${empty('Not written yet.')}`;
  return `<h3>${esc(title)}</h3>${acts.map((a) => `
    <div class="act"><h4 class="act-h">${esc(a.label)}</h4>${a.text ? textHtml(a.text) : empty('Not written yet.')}</div>`).join('')}`;
}

function notesHtml(s) {
  const logline = s.logline ? `<div class="logline"><div class="kicker">Logline</div>${textHtml(s.logline)}</div>` : '';
  const card = (c) => `<div class="note"><h3>${esc(c.title)}</h3>${textHtml(c.body)}</div>`;
  return `${logline}${s.cards.map(card).join('')}${actsHtml('Synopsis', s.synopsis)}<div class="break-soft"></div>${actsHtml('Treatment', s.treatment)}${s.others.map(card).join('')}`;
}

function charactersHtml(s) {
  if (!s.characters.length) return empty('No character bios yet.');
  return s.characters.map((c) => {
    const sub = [c.role, c.age && `Age: ${c.age}`, c.gender].filter(Boolean).map(esc).join(' · ');
    return `
    <div class="character">
      <h3 class="char-name">${esc(c.name)}</h3>
      ${sub ? `<div class="char-sub">${sub}</div>` : ''}
      ${c.relationship ? `<div class="char-rel">${inline(c.relationship)}</div>` : ''}
      ${c.fields.map((f) => `<div class="char-field"><div class="kicker">${esc(f.label)}</div>${textHtml(f.text)}</div>`).join('')}
    </div>`;
  }).join('');
}

const SECTION_HTML = { dna: dnaHtml, notes: notesHtml, characters: charactersHtml };

const CSS = `
@page { size: letter portrait; margin: 0.85in 0.9in 0.9in; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; color: #1d1d1f; background: #fff; font: 11pt/1.55 Georgia, 'Times New Roman', serif; }
h1, h2, h3, h4, .kicker, .cover-label, .meta dt, .beat-label, .char-sub { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
.cover { padding: 0.15in 0 0.3in; border-bottom: 3px solid #c8553d; margin-bottom: 0.3in; }
.cover-label { font-size: 9pt; font-weight: 700; letter-spacing: 0.22em; color: #c8553d; }
.cover h1 { margin: 0.12in 0 0.04in; font-size: 28pt; line-height: 1.15; font-weight: 700; letter-spacing: -0.01em; }
.cover .byline { font-size: 12pt; color: #555; font-style: italic; }
.cover .contents { margin-top: 0.14in; font: 9pt/1.4 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #777; letter-spacing: 0.04em; text-transform: uppercase; }
section.module + section.module { break-before: page; page-break-before: always; }
h2 { margin: 0 0 0.18in; padding-bottom: 0.06in; border-bottom: 1px solid #ddd; font-size: 18pt; font-weight: 700; color: #111; }
h3 { margin: 0.24in 0 0.08in; font-size: 12.5pt; font-weight: 700; color: #111; break-after: avoid; page-break-after: avoid; }
h4 { margin: 0.14in 0 0.04in; font-size: 10pt; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #333; break-after: avoid; page-break-after: avoid; }
p { margin: 0 0 0.09in; orphans: 3; widows: 3; }
ul { margin: 0 0 0.09in; padding-left: 0.22in; }
li { margin: 0 0 0.03in; }
.kicker { font-size: 8pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #8a8a8a; margin-bottom: 0.03in; }
.empty { color: #9a9a9a; font-style: italic; }
.meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.1in 0.2in; margin: 0 0 0.1in; }
.meta div { padding: 0.08in 0.1in; border-left: 3px solid #c8553d; background: #f7f5f2; }
.meta dt { font-size: 8pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #8a8a8a; }
.meta dd { margin: 0.02in 0 0; }
.devices li strong { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10pt; }
.beat { margin: 0 0 0.12in; padding: 0.1in 0.14in; border: 1px solid #e4e1dc; border-radius: 4px; break-inside: avoid; page-break-inside: avoid; }
.beat-label { font-size: 10.5pt; font-weight: 700; margin-bottom: 0.04in; }
.beat-n { display: inline-block; min-width: 0.24in; color: #c8553d; }
.beat-q { margin-left: 0.08in; font-weight: 400; font-style: italic; color: #888; }
.logline { margin: 0 0 0.12in; padding: 0.12in 0.16in; background: #f7f5f2; border-left: 3px solid #c8553d; font-size: 12pt; break-inside: avoid; }
.act { break-inside: auto; }
.act-h { color: #c8553d; }
.break-soft { height: 0.06in; }
.note { break-inside: avoid; page-break-inside: avoid; }
.character { margin: 0 0 0.22in; padding-bottom: 0.14in; border-bottom: 1px solid #eee; break-inside: avoid; page-break-inside: avoid; }
.char-name { margin-top: 0; font-size: 14pt; letter-spacing: 0.04em; text-transform: uppercase; }
.char-sub { font-size: 9.5pt; font-weight: 700; color: #c8553d; margin: -0.04in 0 0.04in; }
.char-rel { font-style: italic; color: #555; margin-bottom: 0.06in; }
.char-field { margin-top: 0.06in; }
.foot { margin-top: 0.3in; font: 8pt 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #aaa; text-align: center; }
@media screen { body { max-width: 7in; margin: 0.5in auto; } }
`;

/** The printable document for a payload (bibleExportPayload). */
export function bibleHtml(payload, { date = new Date() } = {}) {
  const contents = payload.sections.map((s) => s.heading).join(' · ');
  const when = new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const body = payload.sections.map((s) => `
  <section class="module" id="${s.id}">
    <h2>${esc(s.heading)}</h2>
    ${SECTION_HTML[s.id](s)}
  </section>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(payload.docTitle)}</title><style>${CSS}</style></head>
<body>
  <header class="cover">
    <div class="cover-label">${esc(payload.label)}</div>
    <h1>${esc(payload.title)}</h1>
    ${payload.author ? `<div class="byline">by ${esc(payload.author)}</div>` : ''}
    <div class="contents">${esc(contents)} · ${esc(when)}</div>
  </header>
  ${body}
  <div class="foot">Made with DraftLine</div>
</body></html>`;
}

/** One line per section for the export dialog: what's actually in it right now. */
export function bibleSectionSummary(project = {}) {
  const p = bibleExportPayload(project, ALL_SECTIONS);
  const [dna, notes, chars] = p.sections;
  const beats = dna.beats.filter((b) => b.text).length;
  const written = (acts) => acts.filter((a) => a.text).length;
  const parts = [notes.logline && 'Logline', ...notes.cards.map((c) => c.title), written(notes.synopsis) && 'Synopsis',
    written(notes.treatment) && `Treatment (${p.actMode} acts)`, notes.others.length && `${notes.others.length} note${notes.others.length === 1 ? '' : 's'}`].filter(Boolean);
  const n = chars.characters.length;
  return {
    dna: `${beats} of ${dna.beats.length} beats answered${dna.meta.length ? ` · ${dna.meta.map((m) => m.label).join(', ')}` : ''}`,
    notes: parts.length ? parts.join(' · ') : 'Nothing written yet',
    characters: n ? `${n} ${n === 1 ? 'character' : 'characters'} with a bio` : 'No bios yet',
  };
}

/** Export PDF: print the chosen sections of `project` (opens the print dialog; Save as PDF). */
export function exportBible(project, selection, print = printDocument) {
  const payload = bibleExportPayload(project, selection);
  return print({ html: bibleHtml(payload), title: payload.docTitle });
}
