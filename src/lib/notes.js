// Margin notes: private editorial notes on an element (block.note), shown in the left margin.
// They never count toward page length, never print, and are never written to an export
// (.fountain / .fdx / PDF). Imported Fountain [[ … ]] notes and Final Draft ScriptNotes are
// read *into* margin notes. A .draftline backup keeps them, since it is the whole project.

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
