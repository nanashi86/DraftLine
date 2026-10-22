// Toolbar helpers: what the ⋮ (More) menu holds, and whether a toolbar button is really on screen.

/**
 * Is `el` actually showing on the toolbar? It isn't when a breakpoint hides it
 * (display: none) or when a narrow, sideways-scrolling bar has it out of view.
 */
export function isOnBar(el, bar) {
  if (!el || !bar || el.offsetParent === null) return false;
  const r = el.getBoundingClientRect();
  const b = bar.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  return r.left >= b.left - 1 && r.right <= b.right + 1;
}

/**
 * The ⋮ menu, top to bottom: View Snapshots · Margin Notes · Format Doctor — Keyboard Shortcuts —
 * User Guide · About DraftLine (Load Sample Script is in File ▾), plus Focus, Story Bible and/or Characters first (toolbar order), but only while
 * the toolbar can't show them itself (narrow windows). Snapshots and Notes show their counts.
 */
export function moreMenuItems({
  bibleOnBar, charactersOnBar, onBible, onCharacters, onSnapshots, snapshotCount = 0, onNotes, noteCount = 0,
  onShortcuts, onAbout, focusOnBar = true, onFocus, onGuide, onFormatDoctor, issueCount = 0, planTools = null,
}) {
  const panels = [
    !focusOnBar && onFocus && { label: 'Focus', hint: 'Esc exits', onSelect: onFocus },
    !bibleOnBar && { label: 'Story Bible', hint: 'Alt+I', onSelect: onBible },
    !charactersOnBar && { label: 'Characters', hint: 'Alt+C', onSelect: onCharacters },
    // Plan: its header tools, when a narrow bar has tucked them away
    ...(planTools && !planTools.viewsOnBar ? planTools.views.map((v) => ({ label: v.label, hint: v.on ? 'Showing' : '', onSelect: v.onSelect })) : []),
    planTools?.hasScenes && !planTools.foldOnBar && { label: planTools.foldLabel, onSelect: planTools.onFold },
    planTools?.hasScenes && !planTools.exportOnBar && { label: 'Export Breakdown', hint: '.csv', onSelect: planTools.onExport },
  ].filter(Boolean);
  return [
    ...(panels.length ? [...panels, { divider: true }] : []),
    { label: 'View Snapshots', hint: String(snapshotCount), onSelect: onSnapshots },
    { label: 'Margin Notes', hint: String(noteCount), onSelect: onNotes },
    // Format Doctor's status-bar stepper only shows while it has findings; this opens it any time.
    ...(onFormatDoctor ? [{ label: 'Format Doctor', hint: issueCount ? String(issueCount) : 'Clean', onSelect: onFormatDoctor }] : []),
    { divider: true },
    { label: 'Keyboard Shortcuts', hint: 'Ctrl+/', onSelect: onShortcuts },
    { divider: true },
    ...(onGuide ? [{ label: 'User Guide', hint: 'F1', onSelect: onGuide }] : []),
    { label: 'About DraftLine', onSelect: onAbout },
  ];
}

/**
 * The header's one "File ▾" menu: Script · Export Script · Export Outline & Bible · Backup. Labels
 * name the file each export writes; hints are shortcuts. (The Scene Board's Export Outline offers the
 * same three outlines; Plan's breakdown CSV is on Plan's own bar.)
 */
export function fileMenuItems({
  onNew, onOpen, onImport, onSample, onTitlePage, onPrint, onBible, onFountain, onFdx, onOutlineCsv, onOutlineMd, onOutlineFountain,
  onBackup, onSnapshots, snapshotCount = 0,
}) {
  return [
    { heading: 'Script' },
    { label: 'New Script', hint: 'Ctrl+Alt+N', onSelect: onNew, title: 'Start a new script (your others stay in Projects)' },
    { label: 'Open…', hint: 'Ctrl+O', onSelect: onOpen, title: 'Open a .fountain, .fdx, .txt or .draftline file' },
    { label: 'Import…', hint: 'Docs · Word · PDF', onSelect: onImport, title: 'Paste or load a script from Google Docs, Word, a PDF or plain text' },
    { label: 'Load Sample Script', hint: 'The Last Ferry', onSelect: onSample, title: 'Add the sample script to your Projects (your scripts stay as they are)' },
    { label: 'Title Page Settings…', onSelect: onTitlePage },
    { divider: true },
    { heading: 'Export Script' },
    { label: 'Script (PDF)', hint: 'Ctrl+P', onSelect: onPrint, title: 'Print or save as PDF — exactly the pages on screen' },
    { label: 'Fountain (.fountain)', onSelect: onFountain, title: 'Plain-text screenplay for Highland, Slugline, Fade In…' },
    { label: 'Final Draft (.fdx)', onSelect: onFdx, title: 'For Final Draft users and productions' },
    { divider: true },
    { heading: 'Export Outline & Bible' },
    { label: 'Story Bible (PDF)…', hint: '.pdf', onSelect: onBible, title: 'Story DNA, Notes and Character Bios as a dossier' },
    { label: 'Spreadsheet Outline (.csv)', onSelect: onOutlineCsv, title: 'One row per Scene Board card' },
    { label: 'Markdown Outline (.md)', onSelect: onOutlineMd, title: 'The Scene Board as a Markdown outline' },
    { label: 'Fountain Outline (.fountain)', onSelect: onOutlineFountain, title: 'The Scene Board as Fountain sections and synopses' },
    { divider: true },
    { heading: 'Backup' },
    { label: 'Backup Project', hint: '.draftline', onSelect: onBackup },
    { label: 'Snapshot History', hint: String(snapshotCount), onSelect: onSnapshots },
  ];
}
