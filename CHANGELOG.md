# Changelog

All notable changes to DraftLine are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- File → PDF: a PDF built inside DraftLine, off the main thread, with Courier Prime embedded — US Letter, 1.5 / 1 / 1 / 1 in margins, 54 lines a page, standard indents, page numbers from page 2, title page first, and the editor's page breaks including (MORE) / (CONT'D). Same bytes on every machine; no new dependencies.
- No-mouse writing: Tab in a Scene Heading moves on to the time of day (then down to Action); Tab on a Character name cycles (O.S.) → (V.O.) → (CONT'D) → none; Backspace on an empty non-Action line steps it back to Action before deleting.
- Smarter autocomplete: locations ranked by use, then recency; character names ranked by who speaks in the current scene, then the script, then Story Bible characters who haven't spoken yet.
- Export toast: every script export (.fountain, .fdx, .draftline, print / PDF) is confirmed bottom-right, closing itself after 8 s (paused while hovered or focused) without taking focus. At most every 14 days it adds a quiet Ko-fi / Patreon line with **Don't show again**.
- Format Doctor: a clean report (no findings, ignored ones included) can end with "Independent & ad-free · Support on Ko-fi · Patreon · Dismiss", at most every 30 days. Both callouts are throttled and permanently mutable per browser, and silent when localStorage is unavailable.
- Snapshot Compare: **Compare** beside each snapshot opens a read-only comparison with the current draft, Inline (red strike-through for deletions, green for additions, retyped elements tagged) or Side by Side. Element- and word-level Myers diff, run in a Web Worker; unchanged stretches fold away. Nothing is added to the writing canvas.
- Dialogue splitting across pages: a speech breaks when at least 2 dialogue lines fit on the page and at least 2 carry over, with a centred `(MORE)` at the foot of the page and `NAME (CONT'D)` at the top of the next. Never splits inside or directly after a parenthetical. You can type straight through the seam in the editor, and Print/PDF shows the same breaks.
- Per-element spellcheck: spellcheck and autocorrect on for Action, Dialogue and Centered; off for Scene Headings, Character cues, Parentheticals, Transitions and Format Cues.
- MIT license, linked from the About box footer.

### Changed

- File ▾ → Export Script now reads PDF (compiled) · Final Draft · Fountain · Print Script… (Ctrl+P); the other sections are unchanged.
- Enter at the end of a Dialogue line now ends the speech and starts Action (as in Final Draft) instead of another Dialogue line; Enter mid-line still splits a speech.
- Elements taller than a whole page break at the page edge (at least 2 lines each side) instead of running off the paper in print, and a heading above one stays with its first lines.
- Orphan prevention: a scene heading needs at least 2 lines of what follows on its page, or it moves to the next one. Transitions still never start a page.
- Long scripts run shorter where speeches used to jump whole to the next page and now split instead.

### Fixed

- Right-click on script text is never redirected: the sheet's click-to-nearest-line handler and the page-seam caret routing now act on the left button only, and every layer over the text is click-through, so the browser's own menu (spelling suggestions, Add to dictionary) opens on the word under the pointer. A chosen suggestion is an ordinary edit: it updates the script and is undoable with Ctrl+Z.
- Scene Board drag-reorder stopped moving scenes in the script after **File → Import… → Load into Editor**: the import gave every element a new id and left the scene cards pointing at the old ones, so a drag only moved the board. Scene cards now follow their headings into an imported script (in the same Ctrl+Z step), boards already left unlinked mend themselves when the project opens, and every drag checks the links first.

### Notes

- `(MORE)` and `(CONT'D)` are layout only. They never enter the script data, Fountain, Final Draft or `.draftline` exports.
