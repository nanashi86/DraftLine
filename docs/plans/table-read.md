# Table Read — local-first read-aloud (future plan)

Status: **planned, not started.** Written October 2026 after the competitive review; build after Find & Replace and Reports.

## Goal

Hear the script performed, without any of it leaving the computer. A "table read" you can start from anywhere,
with a different voice for each character, and a **Rehearse as…** mode that reads every part but yours.

## Principles

- **Local-first, by default.** DraftLine promises the script never leaves the machine. Browser speech has two kinds of
  voices, and they are not equal:
  - *On-device voices* (`SpeechSynthesisVoice.localService === true`): Windows, macOS, ChromeOS and Android system
    voices. The text never leaves the computer. **These are the only defaults.**
  - *Online voices* (`localService === false`, e.g. Chrome's "Google US English"): the text is sent to the vendor's
    servers to be spoken. Offered only when the writer opts in, labelled **"Online voice — text is sent to Google"**
    every place a voice can be chosen.
- **Nothing on the canvas until it plays.** No toolbar button. It appears when started and disappears when stopped.
- **No new dependencies.** The Web Speech API (`speechSynthesis`) is built into every supported browser.
- **Works offline** (on-device voices need no network).

## Where it lives (keeping the minimal look)

| Piece | Where | Existing pattern reused |
|---|---|---|
| Start | ⋮ → **Table Read** · shortcut (a free Alt+letter; check `shortcuts.js`) | ⋮ menu items |
| Transport | A small pill, bottom-centre, in the toast zone: `▶ ❚❚ ■ · Scene 3 · THEO · 1.0× · From cursor ▾` | Export toast / milestone toast |
| Current line | The active-line accent rule, plus gentle auto-scroll | Editor's active line |
| Voices | Characters → Bios: a small voice picker on each bio card; a Narrator voice (Action, headings) at the top of Bios | Bio cards |
| Rehearse as… | Choose a character: DraftLine reads everyone else and pauses, silently, on that character's lines; the rest of the script dims | Characters → Dialogue filter dimming |

## Behaviour

- **Range:** From cursor (default) · This scene · Scenes A–B · Whole script.
- **What's read:** Action and Dialogue always; Scene Headings and Parentheticals optional (toggles in the pill's ▾);
  Transitions and Format Cues off by default; (MORE)/(CONT'D) never (they are layout, not text).
- **Character voices:** each speaking character gets the next on-device voice in rotation until the writer chooses;
  choices are stored with the project (`characters[].voice` = the voice's `voiceURI`), so a voice missing on another
  computer falls back to the rotation.
- **Rate** 0.75×–1.5×; per-voice pitch nudged so two characters sharing one system voice still sound different.
- **Rehearse as… pauses:** the pause is estimated from the line's word count (~2.6 words/second × rate), with a
  "Next" key (Space) to move on early.
- **Stops** on Esc, on typing in the script, on switching project or workspace.

## Technical notes

- `lib/tableRead.js` (pure): script → queue of utterances `{ blockId, voiceKey, text, kind }` (headings expanded:
  "INT." → "Interior", "EXT." → "Exterior", "V.O." → "voice over", "CONT'D" dropped; numbers left to the voice).
- `components/TableReadPill.jsx`: the transport; drives `speechSynthesis.speak()` one utterance at a time
  (`onend` → next) so pause/seek work reliably across browsers (long single utterances get cut off in Chrome).
- Voice list: `speechSynthesis.getVoices()` + the `voiceschanged` event (Chrome loads voices asynchronously).
- Privacy guard: the voice picker lists on-device voices first; an online voice can't be chosen without a one-time
  confirmation, and the pill shows a small "online voice" marker while one is speaking.
- Tests: queue building (what is / isn't read, expansions, Rehearse-as gaps), voice assignment and fallback,
  the online-voice guard (mocked `localService`).

## Known limits to state honestly

- Voice quality depends on the operating system. macOS and Windows on-device voices are decent; ChromeOS on-device
  voices are more robotic. Firefox on Linux may have few or none.
- No emotion or direction from parentheticals; this is a listening tool, not a performance.
