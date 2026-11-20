# DraftLine Core: Table Read (local-first read-aloud)

> **Status: Stage 1 — the next planned free Core feature; not yet approved for implementation.** Updated November 19,
> 2026 (first written October 2026). See [`../../ROADMAP.md`](../../ROADMAP.md).
>
> **Table Read is free in DraftLine Core and never requires DraftLine Pro or DraftLine Co-Write.** No hosted speech
> service, no generative AI, no account.
>
> **Placement:** Write → ⋮ → **Table Read…** (today it opens the planned-feature preview, "Hear your story come to
> life."; that placeholder is separate from this spec and changes when the feature is built).

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
| Start | Write → ⋮ → **Table Read…** (already in place as a preview) · shortcut (a free Alt+letter; check `shortcuts.js`) | ⋮ menu items |
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

## Platform and reliability notes (to verify in a spike)

- **Browser/OS compatibility.** `speechSynthesis` exists in Chrome, Edge, Safari and Firefox, but voices, events and
  pause/resume differ: Chrome on some systems stops long utterances after about 15 seconds (hence one element per
  utterance); Safari and Chrome on Android have had unreliable `pause()`; Firefox on Linux may have no voices.
- **Offline voices.** Only `localService === true` voices are guaranteed to work offline, and not every system has
  one. With none, Table Read says so plainly instead of silently using an online voice.
- **Long scripts.** Build the queue lazily (a scene or two ahead), keep memory flat on a 120-page script, and never
  block typing; measure on the longest sample.
- **Mobile interruptions.** Phone calls, other audio, locking the screen or switching apps can stop speech without an
  `onend`. On `visibilitychange` (hidden), pause and remember the position; resume only when the writer presses Play.
  Background playback is not a goal for v1.
- **Privacy.** On-device voices by default; an online voice needs a one-time, plainly worded opt-in and a visible
  marker while speaking. Nothing about what's read is logged or sent by DraftLine.
- **Storage.** A voice per character fits on `characters[].voice`, which today's code already preserves
  ([`data-integrity.md`](data-integrity.md)); anything stored elsewhere on the project waits for the pass-through fix.

## Minimal MVP (Stage 1, first release)

- ⋮ → Table Read… starts reading **from the cursor**; a small transport with **Play / Pause / Stop** and **speed**
  (0.75×–1.5×); range: from the beginning, this scene, or the current position.
- Narration of **scene headings, action and dialogue** in one narrator voice plus one voice for all dialogue (or a
  simple rotation), on-device voices only by default.
- The current element highlighted and kept in view; stops on Esc, typing, switching project or workspace.
- No character voice mapping UI and no Rehearse as… yet (next increments).

### Acceptance criteria

1. Reading a 120-page script from page 1 completes without stalling in Chrome and Edge on Windows and ChromeOS, and
   in Safari on macOS.
2. Pause/Resume and Stop work within half a second; Stop leaves the cursor and the script exactly as they were.
3. Starting from a scene or the cursor begins at the right element.
4. Nothing is sent over the network with on-device voices (verified with the network panel).
5. No change to the project's stored data unless the writer chooses a voice.
6. With no on-device voices, a clear message and no silent fallback to an online voice.
7. Typing is never slowed while reading.

## Next increments

1. Character voice mapping (Characters → Bios voice picker; narrator voice).
2. Rehearse as… (read everyone but one character, pausing on their lines).
3. Optional reading of parentheticals and transitions.
