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
 * User Guide · About DraftLine (Sample… is in File ▾), plus Focus, Story Bible and/or Characters first (toolbar order), but only while
 * the toolbar can't show them itself (narrow windows). Snapshots and Notes show their counts.
 */
export function moreMenuItems({
  bibleOnBar, charactersOnBar, onBible, onCharacters, onSnapshots, snapshotCount = 0, onNotes, noteCount = 0,
  onShortcuts, onAbout, focusOnBar = true, onFocus, onGuide, onFormatDoctor, issueCount = 0, planTools = null, onReports = null,
  onFeedback = null,
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
    // Plan → Reports, from Write (Plan has it on its own bar).
    ...(onReports ? [{ label: 'Reports', hint: 'Plan', onSelect: onReports }] : []),
    { divider: true },
    { label: 'Keyboard Shortcuts', hint: 'Ctrl+/', onSelect: onShortcuts },
    { divider: true },
    ...(onGuide ? [{ label: 'User Guide', hint: 'F1', onSelect: onGuide }] : []),
    // Directly above About: three questions, sent anonymously (components/FeedbackModal.jsx).
    ...(onFeedback ? [{ label: 'Give Anonymous Feedback…', onSelect: onFeedback }] : []),
    { label: 'About DraftLine', onSelect: onAbout },
  ];
}

/**
 * The header's one "File ▾" menu: Script · Export Script · Export Outline & Bible · Backup. Labels
 * name what each export writes and `ext` its file type (.fountain, .pdf…); hints are shortcuts. (The Scene Board's Export Outline offers the
 * same three outlines; Plan's breakdown CSV is on Plan's own bar.)
 */
export function fileMenuItems({
  onNew, onOpen, onImport, onSample, onTitlePage, onPrint, onCompiledPdf, onBible, onFountain, onFdx, onOutlineCsv, onOutlineMd, onOutlineFountain,
  onBackup, onSnapshots, snapshotCount = 0,
}) {
  return [
    { heading: 'Script' },
    { label: 'New…', hint: 'Ctrl+Alt+N', onSelect: onNew, title: 'Start a new script (your others stay in Projects)' },
    { label: 'Open…', hint: 'Ctrl+O', onSelect: onOpen, title: 'Open a .fountain, .fdx, .docx, .txt or .draftline file' },
    { label: 'Import…', hint: 'Word · Docs · PDF', onSelect: onImport, title: 'Load a script from Word (.docx), Final Draft, Fountain or plain text, or paste one from Google Docs or a PDF' },
    { label: 'Sample…', hint: 'The Last Ferry', onSelect: onSample, title: 'Add the sample script to your Projects (your scripts stay as they are)' },
    { label: 'Edit Title…', onSelect: onTitlePage, title: 'Title page: title, credit, author, draft and contact' },
    { divider: true },
    { heading: 'Export Script' },
    ...(onCompiledPdf ? [{ label: 'PDF', ext: '.pdf', onSelect: onCompiledPdf, title: 'A ready-made PDF, built in DraftLine with Courier Prime embedded: the same file on every computer (asks about scene numbers first)' }] : []),
    { label: 'Final Draft', ext: '.fdx', onSelect: onFdx, title: 'For Final Draft users and productions' },
    { label: 'Fountain', ext: '.fountain', onSelect: onFountain, title: 'Plain-text screenplay for Highland, Slugline, Fade In…' },
    { label: 'Print Script…', hint: 'Ctrl+P', onSelect: onPrint, title: 'Print, or save as PDF from the print dialog — exactly the pages on screen' },
    { divider: true },
    { heading: 'Export Outline & Bible' },
    { label: 'Story Bible', ext: '.pdf', onSelect: onBible, title: 'Story DNA, Notes and Character Bios as a dossier' },
    { label: 'Spreadsheet Outline', ext: '.csv', onSelect: onOutlineCsv, title: 'One row per Scene Board card' },
    { label: 'Markdown Outline', ext: '.md', onSelect: onOutlineMd, title: 'The Scene Board as a Markdown outline' },
    { label: 'Fountain Outline', ext: '.fountain', onSelect: onOutlineFountain, title: 'The Scene Board as Fountain sections and synopses' },
    { divider: true },
    { heading: 'Backup' },
    { label: 'Backup Project', ext: '.draftline', onSelect: onBackup },
    { label: 'Snapshot History', hint: String(snapshotCount), onSelect: onSnapshots },
  ];
}
