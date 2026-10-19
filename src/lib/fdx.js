// Final Draft XML (.fdx) import/export.
//
// Dual dialogue uses Final Draft's own structure: both speeches nested inside
//   <Paragraph><DualDialogue> … </DualDialogue></Paragraph>
// which is what Final Draft writes and reads.

import { buildItems } from './screenplay.js';
import { END_RE } from './sluglines.js';
import { basedOnLine } from './fountain.js';
import { draftLines, splitDraftInfo, titleTypography } from './titleFonts.js';
import { STYLES, STYLE_INFO, normalizeMarks, parseInline, segments, shiftMarks } from './formatting.js';

const TO_FDX = {
  scene: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  // Final Draft's catch-all element; DraftLine writes format cues as bold, all-caps General.
  format_cue: 'General',
  // Final Draft has no centered element: Action with Alignment="Center" (read back as Centered).
  centered: 'Action',
};

const FROM_FDX = {
  'Scene Heading': 'scene',
  Action: 'action',
  General: 'format_cue',
  Shot: 'action',
  Character: 'character',
  Parenthetical: 'parenthetical',
  Dialogue: 'dialogue',
  Transition: 'transition',
};

function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let noteId = 0;

/** Final Draft ScriptNote: anchored inside the element's <Paragraph>, holding its own paragraphs. */
function scriptNote(note, indent) {
  if (!note?.trim()) return '';
  noteId += 1;
  const paras = note.trim().split('\n')
    .map((l) => `${indent}    <Paragraph>\n${indent}      <Text>${esc(l)}</Text>\n${indent}    </Paragraph>`)
    .join('\n');
  return `\n${indent}  <ScriptNote ID="${noteId}">\n${paras}\n${indent}  </ScriptNote>`;
}

/**
 * `content` is a string or a list of runs [{ text, b, i, u, s }]. Each run becomes its own
 * <Text> with Final Draft's Style="Bold+Italic+Underline+Strikeout" (any combination);
 * `style` is a base style for the whole paragraph (format cues are Bold).
 */
const runStyle = (run, base) => {
  const st = base ? base.split('+') : [];
  for (const k of STYLES) if (run[k] && !st.includes(STYLE_INFO[k].fdx)) st.push(STYLE_INFO[k].fdx);
  return st.join('+');
};

function paragraph(type, content, attrs = '', indent = '    ', textAttrs = '', note = '', style = '') {
  const runs = typeof content === 'string' ? [{ text: content }] : content;
  const xml = runs.map((run) => {
    const { text } = run;
    const st = runStyle(run, style);
    return `<Text${textAttrs}${st ? ` Style="${st}"` : ''}>${esc(text)}</Text>`;
  }).join(`\n${indent}  `);
  return `${indent}<Paragraph${attrs} Type="${type}">\n${indent}  ${xml}${scriptNote(note, indent)}\n${indent}</Paragraph>`;
}

const CAPS = new Set(['scene', 'character', 'transition', 'format_cue']);

/** The element's export text as runs, with its marks moved along with any trimming. */
function cleanRuns(b) {
  let text = b.text.replace(/\s+$/, '');
  let ranges = b.marks;
  const lead = (t) => t.length - t.trimStart().length;
  if (CAPS.has(b.type) || b.type === 'parenthetical') {
    ranges = shiftMarks(ranges, -lead(text));
    text = text.trim();
  }
  if (CAPS.has(b.type)) text = text.toUpperCase();
  if (b.type === 'character') text = text.replace(/\s*\^$/, '');
  if (b.type === 'parenthetical') {
    if (!text.startsWith('(')) {
      text = `(${text}`;
      ranges = shiftMarks(ranges, 1);
    }
    if (!text.endsWith(')')) text = `${text})`;
  }
  return segments(text, ranges);
}

const styleOf = (b) => (b.type === 'format_cue' ? 'Bold' : '');

export function toFDX({ meta = {}, blocks }) {
  noteId = 0;
  const kept = blocks.filter((b) => (b.text.trim() !== '' && b.text.trim() !== '()') || b.note?.trim());
  let sceneNo = 0;
  const body = buildItems(kept)
    .map((it) => {
      if (it.kind === 'dual') {
        const inner = it.blocks.map((b) => paragraph(TO_FDX[b.type], cleanRuns(b), '', '        ', '', b.note)).join('\n');
        return `    <Paragraph>\n      <DualDialogue>\n${inner}\n      </DualDialogue>\n    </Paragraph>`;
      }
      const b = it.block;
      const attrs = b.type === 'scene' ? ` Number="${++sceneNo}"` : b.type === 'centered' ? ' Alignment="Center"' : '';
      return paragraph(TO_FDX[b.type], cleanRuns(b), attrs, '    ', '', b.note, styleOf(b));
    })
    .join('\n');

  // Title page fields may carry Markdown emphasis; it becomes styled runs.
  const rich = (t) => {
    const { text, marks } = parseInline(t);
    return segments(text, marks);
  };
  const C = ' Alignment="Center"';
  const L = ' Alignment="Left"';
  const blank = (n) => Array.from({ length: n }, () => paragraph('Action', '', C, '      '));
  const tp = [];
  if (meta.title?.trim()) {
    tp.push(...blank(18));
    // Final Draft reads font, size and style straight off the <Text> run.
    const { font, size, bold } = titleTypography(meta);
    const style = [bold && 'Bold', font.id === 'courier-prime' && 'Underline'].filter(Boolean).join('+');
    const fontAttrs = ` Font="${font.label}" Size="${size}"`;
    const titleText = font.upper ? meta.title.trim().toUpperCase() : meta.title.trim();
    tp.push(paragraph('Action', rich(titleText), C, '      ', fontAttrs, '', style));
    if (meta.author?.trim()) {
      const credit = (meta.credit ?? 'Written by').trim();
      tp.push(...blank(1));
      if (credit) tp.push(paragraph('Action', rich(credit), C, '      '), ...blank(1));
      tp.push(paragraph('Action', rich(meta.author.trim()), C, '      '));
    }
    if (meta.basedOn?.trim()) tp.push(...blank(1), paragraph('Action', rich(basedOnLine(meta.basedOn)), C, '      '));
    const draft = draftLines(meta);
    if (meta.contact?.trim() || draft.length) {
      tp.push(...blank(16));
      for (const line of (meta.contact || '').split('\n').filter((l) => l.trim())) {
        tp.push(paragraph('Action', rich(line.trim()), L, '      '));
      }
      // Bottom-right revision block: version, then date.
      for (const line of draft) tp.push(paragraph('Action', rich(line), ' Alignment="Right"', '      '));
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="5">
  <Content>
${body}
  </Content>
  <TitlePage>
    <Content>
${tp.join('\n')}
    </Content>
  </TitlePage>
</FinalDraft>
`;
}

/** The paragraph's own text runs only — not the text inside any ScriptNote it holds. */
function paragraphText(p) {
  return [...p.children].filter((n) => n.tagName === 'Text').map((t) => t.textContent).join('');
}

const FROM_STYLE = Object.fromEntries(STYLES.map((k) => [STYLE_INFO[k].fdx.toLowerCase(), k]));

/** Text plus marks from the paragraph's runs (Style="Bold", "Italic+Underline", "Strikeout" …). */
function paragraphRuns(p) {
  let text = '';
  const ranges = {};
  for (const t of p.children) {
    if (t.tagName !== 'Text') continue;
    const s = t.textContent;
    for (const name of (t.getAttribute('Style') || '').split('+')) {
      const k = FROM_STYLE[name.trim().toLowerCase()];
      if (k && s) (ranges[k] ??= []).push([text.length, text.length + s.length]);
    }
    text += s;
  }
  return { text, marks: normalizeMarks(ranges, text.length) };
}

/** An imported element with its inline formatting (if any). */
function element(type, p, extra = null) {
  const { text, marks } = paragraphRuns(p);
  const b = { type, text, ...extra };
  // Format cues are bold by definition, so their Bold isn't an inline mark.
  if (marks && type === 'format_cue') delete marks.b;
  if (marks && Object.keys(marks).length) b.marks = marks;
  return b;
}

function paragraphNote(p) {
  return [...p.children]
    .filter((n) => n.tagName === 'ScriptNote')
    .map((n) => [...n.getElementsByTagName('Text')].map((t) => t.textContent).join('\n').trim())
    .filter(Boolean)
    .join('\n');
}

function withNote(block, p) {
  const note = paragraphNote(p);
  return note ? { ...block, note } : block;
}

/** Parses .fdx text into { meta, blocks: [{type, text, dual?}] }. Browser-only (DOMParser). */
export function parseFDX(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('This .fdx file is not valid XML.');
  const root = doc.documentElement;
  const content = [...root.children].find((n) => n.tagName === 'Content');
  const blocks = [];

  for (const p of content ? [...content.children] : []) {
    if (p.tagName !== 'Paragraph') continue;
    const dual = [...p.children].find((n) => n.tagName === 'DualDialogue');
    if (dual) {
      let cues = 0;
      for (const q of dual.children) {
        if (q.tagName !== 'Paragraph') continue;
        const type = FROM_FDX[q.getAttribute('Type')] || 'dialogue';
        const b = element(type, q);
        if (!b.text.trim()) continue;
        if (type === 'character') cues += 1;
        if (type === 'character' && cues === 2) b.dual = true;
        blocks.push(withNote(b, q));
      }
      continue;
    }
    let type = FROM_FDX[p.getAttribute('Type')] || 'action';
    if ((type === 'action' || type === 'format_cue') && p.getAttribute('Alignment') === 'Center') type = 'centered';
    const b = element(type, p);
    // THE END typed as left-aligned Action or a Transition: centered ("FADE OUT. THE END" splits).
    const end = ['action', 'transition', 'format_cue'].includes(type) && END_RE.exec(b.text.trim());
    if (end) {
      if (end[1]) blocks.push({ type: 'transition', text: end[1].toUpperCase().replace(/\.?$/, '.') });
      blocks.push(withNote({ type: 'centered', text: (end[1] ? end[2] : b.text.trim()).toUpperCase() }, p));
      continue;
    }
    if (b.text.trim() || paragraphNote(p)) blocks.push(withNote(b, p));
  }

  // Title page: best-effort read of the usual layout.
  const meta = { title: '', credit: 'Written by', author: '', basedOn: '', contact: '', draftVersion: '', draftDate: '' };
  const titlePage = [...root.children].find((n) => n.tagName === 'TitlePage');
  if (titlePage) {
    const paras = [...titlePage.getElementsByTagName('Paragraph')]
      .map((p) => ({ text: paragraphText(p).trim(), align: p.getAttribute('Alignment') }))
      .filter((p) => p.text);
    const centered = paras.filter((p) => p.align !== 'Left' && p.align !== 'Right');
    meta.title = centered[0]?.text || '';
    // The credit line ("Written by", "Screenplay by", …) sits directly above the author.
    const by = centered.findIndex((p, i) => i > 0 && /\bby:?$/i.test(p.text));
    if (by >= 0) {
      meta.credit = centered[by].text;
      if (centered[by + 1]) meta.author = centered[by + 1].text;
    }
    const based = centered.find((p) => /^based on\b/i.test(p.text));
    if (based) meta.basedOn = based.text.replace(/^based on\s+/i, '');
    meta.contact = paras.filter((p) => p.align === 'Left').map((p) => p.text).join('\n');
    Object.assign(meta, splitDraftInfo(paras.filter((p) => p.align === 'Right').map((p) => p.text).join('\n')));
  }
  return { meta, blocks };
}
