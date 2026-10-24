# Changelog

All notable changes to DraftLine are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Dialogue splitting across pages: a speech breaks when at least 2 dialogue lines fit on the page and at least 2 carry over, with a centred `(MORE)` at the foot of the page and `NAME (CONT'D)` at the top of the next. Never splits inside or directly after a parenthetical. You can type straight through the seam in the editor, and Print/PDF shows the same breaks.
- Per-element spellcheck: spellcheck and autocorrect on for Action, Dialogue and Centered; off for Scene Headings, Character cues, Parentheticals, Transitions and Format Cues.
- MIT license, linked from the About box footer.

### Changed

- Orphan prevention: a scene heading needs at least 2 lines of what follows on its page, or it moves to the next one. Transitions still never start a page.
- Long scripts run shorter where speeches used to jump whole to the next page and now split instead.

### Notes

- `(MORE)` and `(CONT'D)` are layout only. They never enter the script data, Fountain, Final Draft or `.draftline` exports.
