# DraftLine Core: Table Read (local-first read-aloud)

> **Status: Stage 1 — shipped (approved November 23, 2026).** First written October 2026. See
> [`../../ROADMAP.md`](../../ROADMAP.md). "As built" below is authoritative; the "Earlier plan" section is kept for
> reference, and "Next increments" (Rehearse as…) is still to come.
>
> **Table Read is free in DraftLine Core and never requires DraftLine Pro or DraftLine Co-Write.** No hosted speech
> service, no generative AI, no account.
>
> **Placement:** Write → ⋮ → **Table Read…** opens the player (the planned-feature preview is retired).

## As built (Stage 1)

| Piece | Where | Code |
|---|---|---|
| Start | Write → ⋮ → **Table Read…** (not in Plan; closes on entering Plan or switching project) | `App.jsx` `openTableRead` |
| Player | Floating card above the status bar, centred; never a dialog; never autoplays (focus lands on Play) | `components/TableRead.jsx`, `TableRead.css` |
| Scopes | **Scene** (default) · **Act** · **Script** (+ **From here**) | `lib/tableRead.js` `scopeRange` |
| Acts | Read from the Scene Board's cards; the same function labels the Scenes sidebar | `lib/sceneActs.js` |
| Controls | ⏮ previous element · ▶/❚❚ · ⏭ next element · 1× / 1.25× / 1.5× · Voices… · ✕ | Lucide icons, `Select` |
| Current element | Soft accent tint + accent margin rule; kept in view, but never scrolled while the caret is in the script; never printed | `Editor` `readingId` → `.el.is-reading` |
| Voices | Voices… popover: Narrator + speaking characters, each a `Select` and a short preview; Auto-Assign; Read Action & Headings; Read Parentheticals | `TableRead.jsx` |
| Storage | **On this device only**: `localStorage["draftline:tableRead:v1"]`, per project, by cue name | `lib/tableReadPrefs.js` |

### Scenes sidebar act labels

- The Scene Board is the only source: each card's underlying act (`beat.act`: 1, 2A, 2B, 3) and its `sceneId`. The
  board's 3 Acts / 4 Acts switch only changes the labels (2A + 2B → ACT 2), so switching back and forth keeps every
  manual placement; dragging a card or redistributing updates the labels at once (nothing is stored).
- A label is drawn above the first scene of each act, between dashed rules in the sidebar's existing style, below the
  Title Page. A scene without a card stays under the act above it (no boundary is invented); scenes before the first
  carded scene, or a board with no scene cards, get no label. The script's order is kept: if an act comes back later
  in the script, it is labelled again rather than regrouped.
- While searching, a label shows above the first matching scene of its act; acts with no match show nothing.

### Decisions that differ from the earlier plan below

- **Voice storage is per device, not `characters[].voice`.** A `voiceURI` names a voice installed on one computer, so
  it is meaningless elsewhere; storing it in the project would also require a Bio for every speaking character. Kept in
  `localStorage` per project and cue name, the project record, `.draftline` files, backups, snapshots, folder sync and
  Bios never change. Trade-off: choices don't travel with a backup; elsewhere every character gets automatic voices.
  Rename (Characters → Rename) carries the choice to the new name. At most 100 projects are remembered.
- **Pause = stop and remember.** Native `pause()`/`resume()` is unreliable (Chrome, Safari, Android), so Pause cancels
  and Play restarts the current piece (≤ 200 characters, usually a sentence).
- **Playback doesn't stop on typing.** Each element is looked up again by id when it's spoken, so edits are picked up;
  a deleted element is skipped. Auto-scroll pauses while the caret is in the script. It pauses when the script is
  hidden (Board) or the tab is hidden, and stops on closing, entering Plan or switching project.
- **Google voices are preferred for automatic voices** (Eric's decision after testing Chrome on Windows, November 23:
  they sound clearly better than the Microsoft voices). They're online (`localService === false`): Chrome sends the
  text to Google. The pool for automatic voices is the Google voices when any exist, otherwise the on-device voices;
  other voices are never mixed in just to have more distinct ones (reuse with a modest pitch nudge, 0.86–1.14,
  instead). Other online voices are never chosen automatically. Offline (`navigator.onLine === false`), or after an
  online voice errors or never starts within 5 s, only on-device voices are used (the writer's choices are kept and
  come back online). Voices… marks online voices ("· online", and the "Online · text is sent to the provider" group);
  the player shows "Online voice" while one speaks. **This changes the original "on-device voices by default"
  principle above: in Chrome, Google voices are the default — but only after a one-time consent.**
- **Online-voice consent (one time, per device).** Before any utterance with `localService === false` is created
  (playback or a voice sample), the player asks: "Use an online voice? Online voices send the screenplay text being
  read to Google (or "the voice provider") for speech synthesis. On-device voices keep it on this computer."
  **Use Online Voice** / **Use On-Device Voice**. Stored as `onlineConsent` (`'online' | 'device'`) in
  `draftline:tableRead:v1`. Unanswered (Esc) sends nothing and asks again at the next Play. "On-device" assigns
  on-device voices only (`assignVoices({ online: false })`) without changing saved voice choices; picking an online
  voice in Voices… afterwards clears the answer so it's asked again. The same gate covers the offline fallback: with
  consent given, an online voice that fails still falls back to on-device voices in place.
- **Reading target.** App keeps `readTarget { id, n }`: set when the caret moves to another element, when a scene is
  picked in the Scenes sidebar (always, even the same one), and to `null` for the Title Page (= the first scene; a
  target that no longer exists also means the first scene, never a stale one). A new target while stopped or paused
  resets the player, so Play starts there; while playing, it's remembered but nothing is interrupted. Scope and From
  here changes reset too, and the range is resolved when Play is pressed. The player's line names the target:
  "Ready · Scene 5", "Ready · Act 2B · Scenes 7–9", "Ready · Script from Scene 7".
- **Character cues are never read** (as at a real table read); (V.O.), (O.S.), (CONT'D) only identify the speaker.
  Transitions, Format Cues and Centered text are not read in Stage 1.
- **Voice assignment:** narrator = the system's default on-device voice; characters by number of lines get the other
  on-device voices first, then voices are reused in the same order with a pitch nudge (the narrator's voice last).
  Bio gender is a best-effort hint matched against voice names only. Assignments are fixed while the player is open;
  new speakers join at the end.
- **Shortcut:** none. Space plays/pauses only while the player itself has focus; Esc closes an open list, then
  Voices…, then the player.

### Needs real-browser verification (not covered by automated tests)

Actual speech, voice lists and timing on Chrome/Edge (Windows, ChromeOS), Safari (macOS), Firefox, Android; offline
playback with on-device voices (and the network panel staying empty); a 120-page read without stalling; the ~15-second
Chrome cut-off with long pieces; behaviour on phone interruptions.

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

## Earlier plan (October 2026, kept for reference)

### Where it lives (keeping the minimal look)

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
