# Revision Mode — design plan (for review)

Status: **opted out for now; design kept for review** (October 2026). Written to be read on its own, for example by
another reviewer or AI, without the rest of the codebase.

## Context: what DraftLine is

DraftLine is a free, open-source (MIT), local-first screenwriting web app (React + Vite, installable as a PWA). Scripts
live in the browser's IndexedDB and, optionally, in a linked local or Google Drive folder. Nothing is sent to a server.
Its design values are **minimalism** (nothing on the writing canvas that isn't the script), **speed**, and
**privacy**. Relevant existing pieces:

- **Pagination engine** (`paginate()` in `src/lib/screenplay.js`): 54 lines/page, industry page-seam rules
  ((MORE)/(CONT'D) speech splits, no orphaned scene headings, transitions never start a page, elements taller than a
  page break at the page edge). Used by the editor, Print, and the compiled PDF.
- **Elements keep stable ids** (`{ id, type, text, marks?, note?, dual? }`).
- **Snapshots** (`src/lib/revisions.js`): labelled whole-project checkpoints.
- **Snapshot Compare** (`src/lib/scriptDiff.js`): a linear-space Myers diff by element, then by word, running in a Web
  Worker; Inline and Side-by-Side views.
- **Compiled PDF** (`src/lib/pdf/`): a dependency-free PDF writer with Courier Prime embedded.
- **.fdx** import/export (`src/lib/fdx.js`).

## Why revision mode matters

Professional productions distribute changes as **revision pages**: each round has a colour (White → Blue → Pink →
Yellow → Green → Goldenrod → Buff → Salmon → Cherry → Double White …); changed lines carry an asterisk in the right
margin; revised pages carry a header ("Blue Rev. 10/25/26"); page and scene numbers are **locked** so a shooting schedule
stays valid (new material becomes page 12A or scene 12A; removed scenes become "OMITTED"). Final Draft, Fade In and
Movie Magic support this; it's the main gap keeping DraftLine out of production use.

## Core idea: computed marks, not tracked edits

Most apps record revision marks as you type, which is fragile (marks linger after you undo a change, or get lost in
paste). DraftLine can **compute** them:

1. **Starting a revision** (e.g. Blue) takes an automatic, locked baseline snapshot of the script as it was ("White —
   locked Oct 25").
2. **Changed lines = diff(baseline, current)**. Elements keep their ids, so each element is compared with its own
   baseline text; the word-level diff maps onto wrapped lines (`wrapOffsets`), and every visual line containing an
   insertion, deletion or retype gets an asterisk. Change a word back and its asterisk disappears by itself.
3. **Performance:** only edited elements are re-diffed (unchanged elements are the same object, so they're skipped
   by identity) — microseconds per keystroke. Whole-script recomputation (on load, on starting a revision) runs in the
   existing diff Web Worker.
4. **Revision against revision** is free: "Compare with White" is the existing Snapshot Compare.

## User experience (minimal by design)

- **Off by default.** Entered from ⋮ → **Revision Mode…** with a three-line first-run explanation. Writers who never
  use it never see it.
- **One status-bar chip** beside the Edit / View Only badge: `● Blue Rev. ▾`. Its popover (same style as the
  existing status steppers' menus):
  - "● Blue Revision · since Oct 25 — 14 lines changed on 6 pages"
  - Start Pink Revision… · Lock Scene Numbers ✓ · Lock Pages · Show marks ✓
  - Compare with White… · Leave Revision Mode
- **On the page (screen):** asterisks in the right margin (past the right scene number) in a muted tone of the
  revision colour; a small page header on changed pages ("Blue Rev. 10/25/26"); a thin coloured stripe on the edge
  of revised page cards. **No coloured paper on screen.**
- **Locked scene numbers:** a scene inserted between 12 and 13 is **12A** (then 12B; between 12A and 12B → 12AA, as
  Final Draft does); deleting a scene leaves a one-line `12  OMITTED` placeholder (restore, or remove for good).
- **Locked pages:** overflow creates **A-pages** (a page card labelled `12A.`); emptied pages collapse into one
  placeholder card "Pages 14–15 omitted".

## Output

- **File → PDF**: when a revision is active, a small choice — Full script / **Revised pages only**; optional "tint
  revised pages" for productions that still want coloured paper. Revised pages carry the header and asterisks.
- **Print Script…**: same view through the print dialog.
- **.fdx export** writes Final Draft's own revision data (revision sets, colours, per-paragraph revision ids, locked
  page and scene numbers), so a script opened in Final Draft keeps its Blue marks. This needs testing against real
  Final Draft files (see "Risks").
- **Plan → Reports**: a Revisions table (colour, date, pages and scenes touched).

## Data model (stored with the project; included in .draftline backups and folder sync)

```
revision: {
  active: { index: 1, color: 'blue', label: 'Blue', startedAt: ISO, baselineSnapshotId },
  history: [{ index: 0, color: 'white', lockedAt: ISO, snapshotId }, …],
  lockScenes: false, sceneNumbers: { [sceneId]: '12A' | '13' … },
  lockPages: false, pageAnchors: [{ page: '12', blockId, line }, …],   // where each locked page starts
  options: { keepPreviousMarks: false, granularity: 'line' },
}
```

Marks are never stored: they're computed from the baseline. Locked scene numbers and page anchors are stored, since
they must not move.

## Engine changes

- **Marks:** `lib/revisionMarks.js` (pure) — `marksFor(baselineBlocks, blocks)` → `{ [blockId]: Set<lineIndex> }`,
  built on `diffWords` + `wrapOffsets`; cached per element by object identity.
- **Locked scene numbers:** `lib/sceneNumbering.js` — given the locked map and the current headings, assign numbers
  to new scenes between their locked neighbours (12A, 12B, 12AA); deleted locked scenes become OMITTED placeholders
  (a `{ type: 'scene', omitted: true }` element the editor renders as one quiet line).
- **Locked pages:** a **separate pagination path**, used only when pages are locked: split the script at the stored
  page anchors, paginate each locked page's content with the existing `paginate()` rules, number overflow pages
  `12A, 12B…`, collapse empty runs into "omitted" placeholders. Writers who never lock pages keep using today's engine
  unchanged.
- **Rendering:** the editor's page cards, Print, and the compiled PDF all read the same page model, so the three
  always agree (as they do today).

## Phasing

1. **Phase 1 — colours and marks:** revision colours and labels, computed asterisks, page headers and stripes,
   Compare between revisions, PDF "Revised pages only". (Covers "send me the changed pages".)
2. **Phase 2 — locked scene numbers:** 12A scenes, OMITTED placeholders, numbering in exports.
3. **Phase 3 — locked pages:** A-pages, omitted-page placeholders, FDX revision export, Revisions report.

## Decisions to make

1. When a new revision starts, do the previous revision's asterisks clear (industry default; recommended) or stay
   in their own colour?
2. Asterisk per changed **line** (standard; recommended) or per changed **element** (simpler, less precise)?
3. Revision header format and position (default: top-left of the page, "Blue Rev. 10/25/26").
4. Colour sequence editable, or fixed to the standard order?

## Risks and costs

- **Locked pages are the hardest part**: they touch the page model everything else depends on. Mitigation: a separate
  code path, used only when pages are locked, with its own test suite (overflow, empty pages, speeches split across
  locked boundaries, unlocking).
- **FDX revision fidelity** is unproven until tested with real Final Draft files (a fixture library of genuine .fdx
  files, plus one manual pass in Final Draft).
- **Ongoing maintenance** for a solo developer: the most complex feature on the roadmap.
- **Storage:** each revision baseline is a snapshot (typically 30–80 KB of text); negligible.
- **Minimalism:** preserved only if it stays off by default and confined to the status chip and page margins.

## Questions for a reviewer

- Is computing marks from a baseline diff (instead of tracking edits) sound for production use, including when the
  writer reorders scenes (moved scenes show as deleted and inserted under a plain diff; should moves be detected and
  marked differently)?
- Is the locked-pages approach (anchors + per-page pagination) robust when a speech that was split across a locked
  page boundary grows or shrinks?
- What does Final Draft's FDX revision structure require for a lossless round-trip?
