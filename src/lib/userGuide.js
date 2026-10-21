// The in-app User Guide (⋮ → User Guide, F1). Its text is one Markdown file —
// src/content/userGuide.md — the single source of truth; this module turns it into data the
// modal renders (React elements, never raw HTML), searches it, and builds the printable copy.
//
// Markdown read here: # / ## / ### headings, paragraphs, "- " and "1. " lists, and inline
// **bold**, *italic* and `code` (keyboard shortcuts).

const fold = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** "Folder Sync (Google Drive / Local Disk)" → "folder-sync-google-drive-local-disk". */
export const slug = (s) => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Inline Markdown → [{ t: 'text' | 'b' | 'i' | 'code', v }]. Unclosed markers stay as text. */
export function inlineTokens(text) {
  const out = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*?)\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) });
    if (m[1] != null) out.push({ t: 'code', v: m[1] });
    else if (m[2] != null) out.push({ t: 'b', v: m[2] });
    else out.push({ t: 'i', v: m[3] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}

/** Plain text of an inline string (for search). */
export const plainText = (text) => inlineTokens(text).map((x) => x.v).join('');

/** Body lines → [{ type: 'p', text } | { type: 'ul' | 'ol', items, start? }]. */
function bodyBlocks(lines) {
  const blocks = [];
  let para = [];
  let list = null;
  const flush = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join(' ') });
    para = [];
    if (list) blocks.push(list);
    list = null;
  };
  for (const raw of lines) {
    const l = raw.trim();
    let m;
    if (!l) {
      flush();
    } else if ((m = /^[-*]\s+(.*)$/.exec(l))) {
      if (para.length || list?.type !== 'ul') flush();
      list ??= { type: 'ul', items: [] };
      list.items.push(m[1]);
    } else if ((m = /^(\d+)[.)]\s+(.*)$/.exec(l))) {
      if (para.length || list?.type !== 'ol') flush();
      list ??= { type: 'ol', start: Number(m[1]), items: [] };
      list.items.push(m[2]);
    } else if (list) {
      list.items[list.items.length - 1] += ` ${l}`; // a wrapped list item
    } else {
      para.push(l);
    }
  }
  flush();
  return blocks;
}

/**
 * The guide → { title, intro, chapters }:
 *   title    — the "# " heading
 *   intro    — blocks before the first "## "
 *   chapters — [{ id, title, blocks, topics: [{ id, title, blocks }] }] for each "## " and its "### "
 */
export function parseGuide(md) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  let title = '';
  const intro = [];
  const chapters = [];
  let buf = intro;
  let chapter = null;
  const used = new Set();
  const uniqueId = (s) => {
    let id = slug(s) || 'section';
    for (let n = 2; used.has(id); n += 1) id = `${slug(s)}-${n}`;
    used.add(id);
    return id;
  };
  const close = () => {
    if (buf.target) buf.target.blocks = bodyBlocks(buf);
  };
  for (const line of lines) {
    const h = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!h) {
      buf.push(line);
      continue;
    }
    const level = h[1].length;
    const text = h[2].trim();
    close();
    if (level === 1) {
      title = text;
      buf = intro;
    } else if (level === 2) {
      chapter = { id: uniqueId(text), title: text, blocks: [], topics: [] };
      chapters.push(chapter);
      buf = [];
      buf.target = chapter;
    } else {
      const topic = { id: uniqueId(text), title: text, blocks: [] };
      if (!chapter) {
        chapter = { id: uniqueId('General'), title: 'General', blocks: [], topics: [] };
        chapters.push(chapter);
      }
      chapter.topics.push(topic);
      buf = [];
      buf.target = topic;
    }
  }
  close();
  return { title, intro: bodyBlocks(intro.target ? [] : intro), chapters };
}

const blockText = (b) => (b.type === 'p' ? plainText(b.text) : b.items.map(plainText).join(' '));

/**
 * Filter the guide: every word of `query` must appear in a topic's heading or text (or in its
 * chapter's heading). Returns chapters with only the matching topics, a chapter's own intro kept
 * when it matches, plus `count` (matching topics + chapter intros). Empty query → everything.
 */
export function searchGuide(guide, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return { chapters: guide.chapters, count: null };
  const has = (text) => words.every((w) => text.includes(w));
  let count = 0;
  const chapters = [];
  for (const ch of guide.chapters) {
    const chText = fold(`${ch.title} ${ch.blocks.map(blockText).join(' ')}`);
    const chTitle = fold(ch.title);
    const topics = ch.topics.filter((t) => has(fold(`${chTitle} ${t.title} ${t.blocks.map(blockText).join(' ')}`)));
    const introHit = ch.blocks.length > 0 && has(chText);
    if (!topics.length && !introHit) continue;
    count += topics.length + (introHit ? 1 : 0);
    chapters.push({ ...ch, blocks: introHit ? ch.blocks : [], topics });
  }
  return { chapters, count };
}

/** Split text around the query's words, for <mark>: [{ v, hit }]. */
export function highlight(text, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length || !text) return [{ v: text, hit: false }];
  // Fold character by character so positions in the folded text match the original.
  const chars = [...text];
  const folded = chars.map((c) => fold(c));
  const flat = folded.join('');
  const map = [];
  folded.forEach((f, i) => { for (let k = 0; k < f.length; k += 1) map.push(i); });
  const marks = new Array(chars.length).fill(false);
  for (const w of words) {
    let at = flat.indexOf(w);
    while (at >= 0) {
      for (let k = at; k < at + w.length; k += 1) marks[map[k]] = true;
      at = flat.indexOf(w, at + w.length);
    }
  }
  const out = [];
  chars.forEach((c, i) => {
    const last = out[out.length - 1];
    if (last && last.hit === marks[i]) last.v += c;
    else out.push({ v: c, hit: marks[i] });
  });
  return out;
}

// ---- Printable copy ----------------------------------------------------------------------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inlineHtml = (text) => inlineTokens(text).map(({ t, v }) => (
  t === 'b' ? `<strong>${esc(v)}</strong>` : t === 'i' ? `<em>${esc(v)}</em>` : t === 'code' ? `<code>${esc(v)}</code>` : esc(v)
)).join('');
const blocksHtml = (blocks) => blocks.map((b) => (b.type === 'p'
  ? `<p>${inlineHtml(b.text)}</p>`
  : `<${b.type}${b.type === 'ol' && b.start !== 1 ? ` start="${b.start}"` : ''}>${b.items.map((i) => `<li>${inlineHtml(i)}</li>`).join('')}</${b.type}>`)).join('\n');

/** The whole guide as a standalone, escaped HTML document — what Print / Save PDF prints. */
export function guideHtml(guide, { version = '' } = {}) {
  const body = [
    `<h1>${esc(guide.title)}</h1>`,
    version ? `<p class="ver">DraftLine ${esc(version)}</p>` : '',
    blocksHtml(guide.intro),
    `<nav><ol>${guide.chapters.map((c) => `<li>${esc(c.title)}</li>`).join('')}</ol></nav>`,
    ...guide.chapters.map((c) => [
      `<h2>${esc(c.title)}</h2>`,
      blocksHtml(c.blocks),
      ...c.topics.map((t) => `<h3>${esc(t.title)}</h3>\n${blocksHtml(t.blocks)}`),
    ].join('\n')),
  ].join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(guide.title)}</title>
<style>
  @page { margin: 0.8in; }
  body { font: 11pt/1.5 -apple-system, "Segoe UI", Inter, Helvetica, Arial, sans-serif; color: #111; max-width: 7in; margin: 0 auto; }
  h1 { font-size: 22pt; margin: 0 0 4pt; }
  .ver { color: #666; margin-top: 0; }
  h2 { font-size: 15pt; margin: 22pt 0 6pt; padding-bottom: 3pt; border-bottom: 1px solid #ccc; break-after: avoid; }
  h3 { font-size: 12pt; margin: 14pt 0 4pt; break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  ul, ol { padding-left: 20pt; }
  code { font: 10pt "Courier Prime", "Courier New", monospace; background: #f1f1f1; padding: 0 3px; border-radius: 3px; }
  nav ol { columns: 2; }
</style></head><body>
${body}
</body></html>`;
}
