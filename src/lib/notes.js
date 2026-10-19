// Script notes use Fountain's [[ … ]] syntax in text. In DraftLine a note belongs to an
// element (block.note) and is shown in the margin — it never counts toward page length
// and never prints.

const NOTE_RE = /\[\[([\s\S]*?)\]\]/g;

/** Pull [[notes]] out of a line/paragraph. Returns the cleaned text and the notes found. */
export function extractNotes(text) {
  const notes = [];
  const clean = (text || '').replace(NOTE_RE, (_, n) => {
    if (n.trim()) notes.push(n.trim());
    return '';
  });
  return { text: notes.length ? clean.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/gm, '') : clean, notes };
}

/** Attach notes to a block (appending to any note it already has). Mutates and returns the block. */
export function addNotes(block, notes) {
  const list = (Array.isArray(notes) ? notes : [notes]).map((n) => (n || '').trim()).filter(Boolean);
  if (!block || !list.length) return block;
  block.note = [block.note, ...list].filter(Boolean).join('\n');
  return block;
}

/** Fountain form of a block's note, ready to append to its last line ("" when none). */
export function fountainNote(block) {
  const n = (block.note || '').trim();
  // Blank lines would end the note's paragraph in Fountain; keep them as two spaces.
  return n ? ` [[${n.split('\n').map((l) => (l.trim() === '' ? '  ' : l)).join('\n')}]]` : '';
}
