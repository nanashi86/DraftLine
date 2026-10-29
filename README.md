[![DraftLine App](https://img.shields.io/badge/Launch-DraftLine-E05A47?style=for-the-badge)](https://nanashi86.github.io/DraftLine/)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Tip%20Jar-FF5E5B?style=for-the-badge&logo=kofi&logoColor=white)](https://ko-fi.com/draftline)
[![Patreon](https://img.shields.io/badge/Patreon-Support-F96854?style=for-the-badge&logo=patreon)](https://patreon.com/DraftLine)
[![Discord](https://img.shields.io/badge/Discord-Community-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/8ytSsSWsPX)

# DraftLine™

A fast, distraction-free, local-first screenwriting app built on open formats (Fountain, Final Draft XML). Zero corporate clouds, zero tracking, and complete writer IP ownership.

```bash
npm install
npm run dev
```

## Writing

Each line is a screenplay element. The status bar always shows where Enter and Tab will take you.

| In…           | Enter →        | Tab →                                                             |
|---------------|----------------|-------------------------------------------------------------------|
| Scene Heading | Action         | `INT. HOUSE` → `INT. HOUSE - ` (times of day open); complete → Action below |
| Action        | Action         | Character (new cue below; an empty line becomes the cue)          |
| Character     | Dialogue       | Cycles the extension: (O.S.) → (V.O.) → (CONT'D) → none; empty → Transition |
| Dialogue      | Action         | Parenthetical (inserted at the caret)                              |
| Parenthetical | Dialogue       | Dialogue                                                          |
| Transition    | Action         | Scene Heading                                                     |
| Format Cue    | Action         | Action                                                            |
| Centered      | Action         | Action                                                            |

- **Enter at the end of a Dialogue line** ends the speech and starts Action, as in Final Draft; **Enter** in the middle
  of a Dialogue line splits the speech into two Dialogue paragraphs. **Enter on an empty** Character / Dialogue /
  Parenthetical / Transition turns it into Action.
- Typing **(** at the start of an empty Dialogue line makes it a Parenthetical — `()` with the caret inside.
- **Shift+Tab** cycles the type backwards; **Alt+1…8** sets it directly.
- **Shift+Enter** adds a line break inside Action or Dialogue.
- **Backspace** on an empty Character, Dialogue, Transition, Scene Heading … line first steps it back to Action;
  **Backspace** on an empty Action line (or **Delete** on any empty element) removes it. An empty first element is
  removed and the next one moves up to line 1 of Page 1.
- **Backspace** at the very start of an element with text merges it onto the end of the element above (which keeps
  its own type). **Delete** at the very end pulls the element below up into it.

### Format Cue

A flush-left, all-caps, bold element (**Alt+2**, or the element dropdown) for directions that aren't story action:
language cues (`IN CREOLE WITH ENGLISH SUBTITLES:`), sequence boundaries (`BEGIN FLASHBACK`, `END MONTAGE`),
on-screen text (`SUPER:`, `TITLE:`) and audio/technical notes. On screen it's tinted teal with a **CUE** tag in the
margin; it prints in plain black. `BEGIN …` cues never get stranded at the foot of a page, and `END …` cues stay with
what they close. Exports as an all-caps Action line in Fountain (read back as a Format Cue when it matches one of the
patterns above) and as a bold `General` paragraph in Final Draft (read back exactly).

### Centered

Centered text (**Alt+8**) — chiefly the closing **THE END**, set two lines below the last transition and kept on
the same page as it. Fountain writes it as `> THE END <`; Final Draft as Action with `Alignment="Center"`. Both read
back as Centered.

### Inline formatting

| Style | Keys | Fountain | Final Draft |
|---|---|---|---|
| **Bold** | Ctrl+B | `**text**` | `<Text Style="Bold">` |
| *Italic* | Ctrl+I | `*text*` | `<Text Style="Italic">` |
| Underline | Ctrl+U | `_text_` | `<Text Style="Underline">` |
| ~~Strikethrough~~ | Ctrl+Shift+X | `~~text~~` | `<Text Style="Strikeout">` |
| Clear formatting | Ctrl+\\ | | |

(⌘ instead of Ctrl on a Mac.) Shortcuts and the **B | I | U | S** buttons work on the selection, or on the word at
the cursor when nothing is selected; the buttons light up for the styles the selection has. Styles combine freely
(`***bold italic***`, `_**bold underline**_` …). Typing right after (or before) a styled word never carries the
style on; typing inside it does. Formatting follows the text as you edit, splits with Enter, joins with Backspace,
and shows in the page, in print/PDF and in both exports; literal `*`, `_` and `~` are escaped in Fountain. Open and
Import read it back, including Markdown and HTML (`<b>`/`<strong>`, `<i>`/`<em>`, `<u>`, `<s>`/`<strike>`/`<del>`).
Title page fields accept the same Markdown emphasis on the cover, in print and in .fdx.

### Margin notes (private editorial notes)

- Hover a line and click the faint **＋** in the left margin (right-click works too), or press **Alt+N**, to add a note.
  With words selected, Alt+N quotes them into the note — the script text itself is never changed.
- Annotated lines get a small yellow marker in the left margin; click it to open the **Margin Notes** drawer: the line
  it belongs to, the note editor, its **History** (earlier versions, each restorable), and every note in the script
  (‹ › step between them). The status bar's "N notes" and ⋮ → Margin Notes open it too; **Esc** returns to the script.
- Notes never count as lines, never change page breaks, and **never leave DraftLine**: not in print, PDFs, .fountain or
  .fdx. They're kept in .draftline backups (the whole project). Fountain `[[notes]]` and Final Draft `<ScriptNote>`s
  you import still arrive as margin notes.

### Autocomplete

- **Scene Headings** suggest `INT.` / `EXT.` / `INT./EXT.` from the first letter (typed `INT/EXT`, `EXT./INT.`, `I/E` and their variants still work), then locations you've already used — most used first, ties going to the one used most recently above — then times of day.
- **Character** cues suggest names as soon as you type a letter: whoever speaks in the current scene first, then the rest of the script by how often and how recently they speak, then Story Bible characters who haven't spoken yet. Type `(` for `(V.O.)`, `(O.S.)`, `(CONT'D)`, or press **Tab** on a finished name to cycle them.
- **↑/↓** move through suggestions, **Enter** or **Tab** accepts — on a Character cue either one drops you straight into its Dialogue line; on a Scene Heading **Tab** completes it in place — and **Esc** dismisses. Suggestions are computed in memory from the open script, with no network or library involved.

### Pages

The canvas is paginated live at 54 lines per page (1in margins, Courier 12pt) with numbers from page 2, following industry page-break rules:

- **Orphan prevention:** a scene heading is never the last line on a page. It needs at least 2 lines of what follows on the same page, or it moves to the next one. Lead-in Action never ends a page either: a short line ending in a colon (`She reads it aloud:`), a `SUPER` / `INSERT` / `TITLE` / `CHYRON` / `PRE-LAP` / `IN … WITH SUBTITLES` line, or a one-line all-caps line right before a cue or heading moves on with what it introduces. Transitions never stand alone at the top of a page; they stay with the action before them.
- **Dialogue splitting:** a long speech can break across pages when at least 2 dialogue lines fit on this page and at least 2 go on to the next. DraftLine then draws a centred `(MORE)` at the bottom of the page and `NAME (CONT'D)` at the top of the next. It never splits inside or straight after a parenthetical, and a Character cue never leaves its dialogue. When those rules can't be met, the whole speech moves.
- `(MORE)` and `(CONT'D)` are layout only: you can keep typing through the seam, and they never enter the script, Fountain, Final Draft or `.draftline` files. Print and PDF show the same breaks.
- **Taller than a page:** an element longer than a whole page (a pasted wall of text) breaks at the page edge, with
  at least 2 lines on each side, instead of running off the paper; a heading above it stays with its first lines.
- **Spellcheck per element:** the browser's spellcheck and autocorrect run on Action, Dialogue and Centered text, and stay off for Scene Headings, Character cues, Parentheticals, Transitions and Format Cues, so names and sluglines aren't underlined.

### Dual dialogue

Put the cursor in either of two back-to-back speeches and press **Alt+D** (or choose **Dual Dialogue** in the Element dropdown, right below Dialogue — it shows ✓ when the speech is paired). Press again to undo.
Exports as `NAME ^` in Fountain and Final Draft's `<DualDialogue>` block in .fdx.

### Find & Replace

**Ctrl+F** opens a slim bar floating at the top right of the page (not a dialog: the script stays visible and
editable); **Ctrl+H**, or its chevron, adds the Replace row. Matches are highlighted in the text, on both sides of a
page seam; **Enter** / **Shift+Enter** step through them, **Aa** matches case, **W** whole words, and the list picks
where to look (all elements, or only Scene Headings, Action, Character cues, Dialogue, Parentheticals or
Transitions). **Replace** changes one and moves on; **All** (Ctrl+Enter) changes every match as one undo step,
snapshotting the script first; inline formatting follows the text. **Esc** closes the bar with the match selected;
a search still on stays in the status bar as **Find · 3 of 12** (‹ › and a list of matches) until ✕. In View Only,
Find works and Replace is off.

### Shortcuts

| Keys | Action |
|---|---|
| Ctrl+Z / Ctrl+Shift+Z | Undo / redo |
| Alt+D | Dual dialogue |
| Ctrl+B / Ctrl+I / Ctrl+U | Bold / italic / underline (selection or word at the cursor) |
| Ctrl+Shift+X | Strikethrough |
| Ctrl+\\ | Clear formatting |
| Ctrl+/ | Keyboard shortcuts |
| Alt+1 … Alt+8 | Scene Heading · Format Cue · Action · Character · Parenthetical · Dialogue · Transition · Centered |
| Alt+N | Margin note for this line (quotes any selected words) |
| Alt+S | Scenes sidebar |
| Alt+C | Characters (Bios · Dialogue) |
| Alt+T | Characters → Dialogue |
| Alt+B | Cycle Page → Split → Board |
| Alt+P | Projects drawer |
| Alt+I | Story Bible (DNA · Notes) |
| Ctrl+P | Print Script… — the browser's print preview (title page first); File → PDF downloads a ready-made .pdf |
| Ctrl+S | Save now (it also autosaves continuously) |
| Ctrl+F / Ctrl+H | Find / Find & Replace |

## Scene Board

Three workspace views from the toolbar (or **Alt+B** to cycle): **Page** (script only), **Split** (script + board,
the page auto-fits its half) and **Board** (full-width).

- **4 Acts** (default): Act 1 Setup · Act 2A Escalation to Midpoint · Act 2B Fall & Crisis · Act 3 Climax & Resolution.
- **3 Acts**: Act 1 Setup · Act 2 Confrontation · Act 3 Climax & Resolution. Act 2 shows the 2A cards, a **Midpoint** divider,
  then the 2B cards. Dropping a card above the divider makes it 2A, below makes it 2B, so switching modes never
  moves or loses a card. The choice is remembered.
- **+ Add Card** appends an index card: headline, synopsis / emotional beat, and a tag (Plot, Subplot, Character, Theme).
- Drag a card by its grip (native HTML5 drag-and-drop, no libraries) to reorder or move between acts.
  With the grip focused, **arrow keys** move the card too. Deleting a card offers **Undo** for a few seconds.
- **Export Outline** downloads a Fountain outline (`# Act`, `## Beat`, `= synopsis`) or Markdown, using whichever
  act structure is showing.
- **Import Scenes** makes a card for every scene — titled "12. INT. HOTEL BALLROOM - NIGHT", with the first
  sentence of the scene's action as its synopsis — and places it in an act column:
  - **Auto-Distribute (% Targets)** uses the page each scene starts on, against targets worked out from the
    script's actual page count: 3 Acts = 25 · 50 · 25 % (Act 1 ≤ 25% · Act 2 ≤ 75% · Act 3 the rest); 4 Acts = 25 %
    each (Act 1 ≤ 25% · 2A ≤ 50% · 2B ≤ 75% · Act 3 the rest). The menu shows the shares and, underneath, the actual
    page ranges for the open script (a 96-page script in 3 Acts: "pp. 1–24 · 25–72 · 73+").
    A scene is never split — it belongs wholly to the act its first page falls in.
  - **Manual Scene Ranges…** asks for scene numbers per act (`1-12, 15`) — three inputs in 3-Act view, four in
    4-Act view — starting from the page-target placement, and only applies once every scene is in exactly one act.

  A scene card shows its scene and page (**Sc 12 · p. 34 ↗**); click it (or the card) to jump to that scene in the
  editor. Populating again moves scene cards to their acts, adds cards for new scenes and keeps your edits and your
  own cards. Every populate can be undone from the toast.
- **Act 2 lane memory:** every card remembers whether it's 2A or 2B, so switching **3 Acts ↔ 4 Acts** never moves a
  card — the Midpoint divider you set in the 3-Act view is exactly where 2A ends in the 4-Act view. Placing scenes in
  the 3-Act view gives Act 2 scenes their lane from the 50% page.
- **Pacing badges.** Once the board has scene cards, each act column's header shows how many pages its scenes add up
  to and their share of the whole script — e.g. `24 pgs · 25%` (scene lengths are counted from heading to heading,
  in eighths of a page). A dot appears when an act is more than 7 points off the usual share: 25 / 50 / 25 % in 3-Act
  view, 25 % each in 4-Act — so an Act 1 above 32 % gets flagged. Hover for the details.
- **Restructure the script from the board.** Dragging a scene card (one made by **Import Scenes**, linked to
  its scene) — or moving it with the arrow keys — moves that whole scene in the screenplay: the heading and everything
  up to the next heading (action, dialogue, parentheticals, transitions, notes, formatting) travels together. The
  scene lands right after the scene of the nearest scene card above it on the board. Scene numbers, the Scenes list
  and generated card titles ("2. INT. FERRY - DAY") renumber; titles you've rewritten are left alone. Your own cards
  (no scene) move on the board only, `FADE IN:` stays first and a closing `FADE OUT.` / `THE END` stays last. One
  **Ctrl+Z** puts back both the board and the script.
- Cards autosave with the script, in the project's record.

## The right dock: Story Bible and Characters

The toolbar's right side reads **Export ▾ · Focus · Story Bible · Characters · ⋮**. Story Bible and Characters are
two drawers sharing the right dock — opening one closes the other. On wide screens the script and Scene Board make room
(nothing is covered); on narrow screens the drawer overlays them. Everything in both is saved inside the open project
and switches with it in Projects. Tab labels are one short word each, so they never wrap.

### Characters (Alt+C)

- **👤 Bios** (with a count) — a card per character: name, role / relationship, age (or timeline ages, e.g. "10 in 1986,
  45 in 2021"), traits, and backstory / motivation. **+ Add Character**, filter by name, **A–Z** sort or ↑ ↓ to
  reorder, one-click chips for script speakers who don't have a bio yet, and **Rename across script…**. Deleting can
  be undone. Each bio also has a **Gender** picker beside Age / Timeline. **Populate Bio** fills empty Age, Gender and
  Physical Description fields from each character's introduction in the Action (`MARJORIE (30s)--warm-dark skin, …`;
  gender from a word that names them, e.g. `her female FRIEND`, `petite woman`, else from the pronouns that clearly dominate), adding bios for introduced speakers; it never
  changes what you've typed or picked, and Undo reverses it.
- **💬 Dialogue** (with the number of speaking characters) — pick a character to read every line they speak, top to
  bottom, tagged with scene number and heading; filter lines, show the cue before each speech, see lines / words /
  scenes, and **Rename…** the character. Edit right in the tab: changes write straight to the script. "Go ↗" jumps to
  the line in the page. **Alt+T** opens Characters straight on this tab.

If you had the old Dialogue drawer open, DraftLine opens Characters on its Dialogue tab instead; the tab you last used
is remembered.

**Spotlight a character.** Click a name in the Dialogue tab and the script fades everything except that character's
speeches, with a slim banner above the page — "Filtering dialogue: MARIE · 9 lines" — and **Clear Filter ✕**. Press
**Esc** (or the button, or the name again) to see the whole script. The banner and the fading are on screen only:
never printed or in a PDF.

### Story Bible (Alt+I)

Two tabs — **DNA** opens first unless you've picked Notes this session:

- **📖 DNA** — two views:
  - **Story Blueprint**: **Genre** as clickable pills (Drama, Thriller, Crime, Horror, Comedy, Action, Adventure,
    Romance, Fantasy, Science Fiction, Western, Noir, Other — with a text box for Other; projects that saved the old
    "Noire" spelling load as Noir); **Theme — revealed by the Climax**; **Central Dramatic Question** ("What core
    question does the climax answer?"); **Plot Devices** — pick from Foreshadowing, Flashback, Deus ex machina,
    MacGuffin, Quest, Cliffhanger, Red herring, Love triangle; each added device has Yes / No, a notes box ("How the
    script uses …") and an **i** with its glossary definition (older projects' Foreshadowing / Flashback / Special
    Plot Technique notes carry over as devices); then the eight question cards — Protagonist, Inciting Incident, Goal /
    Desire, Flaw, Conflict / Debate (with the six conflict types), Rising Action, Climax, Falling Action. Every **i**
    shows the definition in a tooltip that always fits inside the drawer (it flips above near the bottom and slides
    in from the edges); click it to open the entry. Saved with the project.
  - **Story Glossary** (formerly Structure Dictionary): 17 terms — the eight above, Text / Subtext / Context, and the
    plot devices (Foreshadowing, Flashback, Deus ex machina, MacGuffin, Quest, Cliffhanger, Red herring, Love
    triangle) — searchable. They ship with DraftLine's *starter* definitions — **Edit** any entry to paste your own
    reference's wording (kept for all projects, including wording you saved before the rename; **Reset** restores the
    starter).
- **📝 Notes** — Markdown sections (**Logline**, **Tone**, **Timeline**, **Pitch**, **Scratchpad**, plus any you add
  below them). The story's theme has one home — **Theme** in DNA ("revealed by the Climax") — so there's no Themes
  card. Notes from earlier versions are updated once on open: a Themes card's text moves into DNA's Theme when that's
  empty (lists become one line, e.g. "Exile; Return home"); if Theme already says the same, the card just goes; if it
  says something different, the card stays as one of your own sections so nothing is overwritten. "Timeline & Lore"
  becomes Timeline, "General Scratchpad" Scratchpad, missing presets are added and your own sections follow — keeping
  every word, edited in place and shown formatted in Preview. **Import from Notes** pastes text from anywhere: append
  to a section, replace it, or split it at `# headings` into matching or new sections (undoable).

## Install & offline (PWA)

DraftLine is an installable web app. In Chrome or Edge, use **Install DraftLine** in the address bar (or the browser
menu) to get it in its own window with a dock / taskbar icon. After one visit online it runs **fully offline**: a
service worker keeps the app itself (every built file, icons, manifest) and the script and UI fonts (Courier Prime
and Inter); title-page fonts are kept as you use them. Online, you always get the newest version; each new build
replaces the old cached one. Your scripts remain entirely on your machine—either saved directly to your linked local
folder or protected in persistent local storage.
The service worker is generated by the build (`src/pwa/`), so it isn't active in `npm run dev`; try it with
`npm run build` and `npm run preview`.

## Snapshots

**Snapshot** (toolbar) saves the whole project — script, title page, Scene Board and Story Bible — as a labelled
checkpoint ("Draft - Oct 20, 2026, 12:44 PM" unless you name it). **⋮ → View Snapshots** lists them, newest first, with
date, pages, scenes, words and size. **Restore** first offers to snapshot what's on screen (on by default), then puts the
snapshot back as one step — Ctrl+Z undoes it. **Compare** opens a read-only comparison of that snapshot's script with
the current draft: **Inline** (deleted text struck through in red, added text highlighted in green, retyped elements
tagged "Action → Scene Heading") or **Side by Side** (the snapshot on the left, the draft on the right). Unchanged
stretches fold away; the diff (Myers, by element and then by word) runs in a Web Worker, so long scripts never stall
the editor. **Close Comparison** (or Esc) returns to the list. **Delete** asks once. Snapshots are saved with the script in the browser
and travel inside .draftline backups.

## Projects

Every script lives in a secure local project library. Choose between **App Storage (Zero Setup)**, which saves
automatically inside DraftLine on this device, or **Linked Folder (File Backup)** to save `.draftline` files directly
into a folder on your computer, including locally synced Google Drive, Dropbox or OneDrive folders. Click the title's **▾** or the **D** logo (or press **Alt+P**) to open the
**Projects** drawer:

- Each card shows the title, author, page and scene counts and when it was last edited; the open script is marked
  **Active**. Click a card to switch: your changes are saved first, then the script, title page, Scene Navigator,
  Dialogue and Scene Board all switch over (undo history starts fresh for each script).
- **+ New Script** asks for a title and opens a blank script. A card's **⋮** menu renames, duplicates
  ("[Title] (Copy)"), exports (.fdx / .fountain — no need to open it first) or deletes it (after a confirmation;
  you can't delete your only script).
- **New**, **Open** and **⋮ → Load Sample** each add a new project instead of replacing the one you're in.
  **Import** still works on the open script (Ctrl+Z undoes it).
- On first run the script DraftLine kept in localStorage moves into the library as your first project; the old copy
  is left in place untouched.

## Plan → Reports

The Plan workspace's third view, beside Breakdowns and Stripboard (also **⋮ → Reports** from Write): quiet tables
worked out from the script each time, nothing stored. **Scenes** (number, slugline, INT/EXT, time, page, length in
eighths, speaking cast) · **Characters** (speeches, printed dialogue lines, words, scenes, pages, share of dialogue) ·
**Locations** (grouped by place: INT/EXT, times, scenes, screen time) · **Script** (pages, scenes, words, speakers,
dialogue vs action, interiors/exteriors, day/night, average and longest scene). Click a column to sort. Every row
leads somewhere: a scene opens in Write, a character turns on their Dialogue spotlight, a location lists its scenes.
Each report downloads as a `.csv`.

## Files

**File → PDF** (Export Script) builds the PDF inside DraftLine instead of through the browser's print dialog:
US Letter, Courier Prime 12 pt embedded (only the styles the script uses), margins 1.5 in left and 1 in elsewhere,
54 lines a page, Character at 3.7 in, Parenthetical 3.1 in, Dialogue 2.5 in (3.5 in wide), Transitions flush right,
page numbers top right from page 2, the title page first. Page breaks come from the same pagination as the editor
(orphaned headings moved, speeches split with `(MORE)` / `NAME (CONT'D)`), so the file matches the screen and is the
same on every machine. It compiles in a Web Worker (`src/lib/pdf/`, no dependencies) and downloads `<title>.pdf`.
Text outside Latin-1 and typographic punctuation prints as `?` (you're told how many characters). The title is set in
Courier Prime whatever title font you chose; **Print Script…** keeps the chosen font.

Before it compiles, a small **Export PDF** dialog asks one thing: **Include Scene Numbers (Production Draft)**. It's
unchecked by default, so spec scripts go out with clean sluglines; checked, every scene heading is numbered in both
margins. The choice is saved per script (`showSceneNumbers`), and **Print Script…** (Ctrl+P) follows it through the
print stylesheet (`.hide-print-scene-numbers`) with no dialog of its own.

Every script export (`.fountain`, `.fdx`, `.draftline`, print / PDF) is confirmed in a bottom-right toast that closes
itself after 8 seconds, never takes focus and pauses while hovered. At most every 14 days it also carries one line
about supporting DraftLine on Ko-fi or Patreon; a clean Format Doctor report (no findings, ignored ones included) can
end with a similar line at most every 30 days. Both are throttled and muted per browser in `localStorage`
(`last_export_tip_shown` / `export_tip_muted`, `last_format_doctor_tip_shown` / `format_doctor_tip_muted`; see
`src/lib/supportTips.js`), and stay silent when storage is unavailable.

- **Open** reads `.fountain`, `.spmd` and `.fdx` (including title pages and dual dialogue); `.txt` files go to Import.
- **Import** brings in scripts from Google Docs, Word, PDFs or any plain text: drop a `.txt` or paste, check the
  live preview (each line tagged Scene Heading / Action / Character / Parenthetical / Dialogue / Transition, with
  counts), then **Load into Editor** (replaces; Ctrl+Z undoes it) or **Append**. It adapts to one-paragraph-per-line
  pastes, blank-line-separated text and indented PDF copies; strips page numbers, (MORE), CONTINUED and scene
  numbers and act markers (`ACT 1`, `ACT TWO`, `ACT 1[b]`, `END OF ACT ONE`); rejoins speeches split by page breaks;
  and lifts a "Written by" title page into the Title Page. Every slugline variant (`INT./EXT.`, `EXT./INT.`,
  `INT/EXT`, `EXT/INT.`, `I/E`, …) becomes a Scene Heading, and so do secondary headings (`BACK TO THE CINEUS
  RESIDENCE`, `LATER`, `MOMENTS LATER`, `RESUME …`, `CONTINUOUS`, `SAME`) and all-caps `FLASHBACK - PLACE - NIGHT`
  lines; `FADE IN:` and capitalised lines ending in `TO:` are Transitions; `IN … WITH ENGLISH SUBTITLES:`,
  `BEGIN …`, `END …`, `SUPER:`, `TITLE:` and `SUBTITLE:` lines are Format Cues (never character cues), split out of
  the Action around them so each has a blank line before and after. A standalone `THE END` (or `FADE OUT. THE END`)
  becomes a `FADE OUT.` transition plus a Centered `THE END`. A character cue is a short all-caps name on its own
  line with only extensions such as `(V.O.)`, `(O.S.)`, `(CONT'D)`; a character introduction like
  `FITO (10)--copper skin, bare feet…` (an age, dashes or sentence punctuation), or a name whose next line carries
  on in lower case, stays Action. Hyphenated names (`JEAN-CLAUDE`) are still cues. `[[notes]]` become margin
  notes, and bold / italic / underline / strikethrough from Markdown or HTML is kept.
  Turn off **Auto-Detect Elements** to bring everything in as Action.
- **Format Doctor** (status bar, with a count of open issues) audits the script for unclassified sluglines (Action
  that starts with INT/EXT/I/E, or is all caps and ends in a time of day), secondary scene headings typed as Action
  (`BACK TO …`, `LATER`, …), sequence cues typed as Action (`BEGIN FLASHBACK`, `END MONTAGE`; language directions such as `IN FRENCH WITH ENGLISH SUBTITLES:` and on-screen `SUPER:` lines may stay Action and are never flagged), stray
  character cues (a short all-caps Action line directly above dialogue), orphaned dialogue (dialogue with no cue
  above it), **false dialogue** — structural only: a speech line that is really a character introduction
  (`FITO (10)--copper skin…`), or one under a "cue" that holds an age or a dash (`FITO (10)` / `--copper skin…`;
  **Make Action** folds the two back into one Action paragraph). Monologues of any length and lines starting with
  `--` under a valid cue are never flagged), **unspaced Super/Cue** (a
  `SUPER:` / `SUBTITLE:` / `TITLE:` line run into an Action paragraph; the fix splits it out as a Format Cue), a
  **misaligned script ending** (`THE END` as left-aligned Action or a Transition; **Center ‘THE END’**), act markers
  and empty elements, **dangling** and **unclosed parentheticals**, the **same character cue twice in a row**
  (**Merge speeches**), a heading's **missing time of day** (**Add - DAY**, one at a time, never in Fix All),
  **leading spaces** at the start of an Action line (first line only; indented lyrics further
  down stay), and anything **stranded at the bottom of a page** (a heading, a cue or a lead-in line on an
  earlier page than what it introduces; flagged only, with no automatic fix). Format Cues themselves are never flagged. Review each in a list,
  **Show** it in the page, fix one with its button (e.g. **Convert to Scene Heading**) or **Fix All**; Ctrl+Z undoes.
- **Rename a character** — **Rename…** in Dialogue (for the selected voice) or **Rename across script…**
  on a Character Bio. A review lists what would change, with counts and before → after examples, in four groups you
  can switch off: **character cues** (extensions such as `(V.O.)`, `(O.S.)`, `(CONT'D)` and the dual-dialogue `^` are
  kept), **spoken dialogue mentions** (dialogue and parentheticals), **action & description mentions** (action, scene
  headings and other direction) and the **Scene Board & Story Bible** (cards, bios, Story Notes, Story DNA). Margin
  notes go with their element's group. Matching is whole-name and keeps each mention's case — `FITO` → `MARC`,
  `Fito's` → `Marc's` — and only the name as written, ALL CAPS and Title Case match, so renaming ROSE leaves "a
  rose" alone; it never touches `FITOS`, `AFITO` or `JEAN-FITO`. The whole rename is one **Ctrl+Z**, script, board
  and Bible together (anything you edited since is left as it is).
- **Backup Project** (Export menu, or a project's ⋯ menu in Projects) saves the whole project as one `.draftline`
  file (JSON): every element with its formatting, notes and dual-dialogue flag; the title page including font, size
  and bold; the Scene Board (card order, act columns and Act 2 lanes, colour tags, scene links) and its 3- / 4-Act
  view; character bios, Story Notes and Story DNA; and your Story Glossary wording. **Open** a `.draftline`
  file, or drop / choose one in **Import**, to restore it exactly — on this or any other browser. A restore never
  overwrites: if that project is already in your library, the backup comes in beside it. Your own dictionary wording
  always wins over the backup's. A script in App Storage stays in the browser it was written in, so this is also how you
  move projects between browsers, or between your local DraftLine and the published one.
- **Page colour** (status bar, or the top-right corner in Focus mode): **Paper** — the classic ivory page with black
  ink — or **Midnight**, a dark page (#1f1f22) with soft light text (#e4e4e7) that matches the app around it.
  Remembered in this browser (`draftline_canvas_theme`). Printing and PDFs are always black on white either way.
- **File ▾** has four sections: **Script** (**New…**, **Open…**, **Import…**, **Sample…**, **Edit Title…**),
  **Export Script** (**PDF** `.pdf`, compiled in DraftLine; **Final Draft** `.fdx`; **Fountain** `.fountain`; and
  **Print Script…**, also **Ctrl+P** — through the print dialog, with the title page as page 0; page 1 is unnumbered,
  pages 2 onward carry a right-aligned "2.", "3." …), **Export Planning & Production** (**Story Bible** `.pdf`, **Scene Breakdown** `.csv` — the same file as Plan's
  **Export Breakdown** — and the **Spreadsheet**, **Markdown** and **Fountain Outline**) and **Backup** (**Backup Project** `.draftline`, **Snapshot History**).
- The toolbar keeps **Story Bible** and **Characters** visible down to 1380px wide (about a laptop screen); below that,
  Story Bible moves into **⋮** (and stays on Alt+I). Below 1300px the toolbar scrolls sideways.
- **⋮** (far right of the toolbar): **Keyboard Shortcuts** (also Ctrl+/), **Load Sample** (*The Last Ferry*) and
  **About DraftLine** (version, where your draft is saved, its size and last save, and a **Backup Project
  (.draftline)** button). **Story Bible** and **Characters** appear at the top of ⋮ only when the toolbar can't show them
  itself (narrow windows) — never twice.
- **Title Page** edits title, **Credit / Subtitle** ("Written by", "Screenplay by", "Story by", … or anything you type),
  author, "based on", **Draft Version** (suggests First / Second / Revised / Final / Shooting Draft), draft date and
  contact/copyright, plus the title's typography: **Title Font** (38 Google Fonts — classic, serif, sans, display, script and handwritten; they load in the background and are used only on the title page),
  **Title Size** (18–48pt) and **Bold**. The script itself always stays Courier Prime 12pt.
  A **new** script starts with an empty author and contact; Chilli Palmer (a *Get Shorty* homage, with a 555 number)
  shows faintly as placeholder text on screen only, never saved or printed. Saving the Title Page remembers its Author and Contact (localStorage `draftline_user_author` /
  `draftline_user_contact`) for the next new script. Both stay ordinary fields — edit or clear them per script. An
  existing script's title page is never changed: imported, opened and saved scripts keep theirs, and only a script
  with neither an author nor a contact has them suggested when you open the Title Page (kept only if you save).
- **View Full Cover** (in the Title Page dialog, or **Title Page** at the top of the Scenes list) shows the title page
  at true 8.5×11 size as *Page 0* above Page 1; **Back to Script** jumps to Page 1. The same layout prints as the cover
  and exports to .fountain (`Credit:`) and .fdx.
- Every change autosaves to the project library within half a second (status bar shows "App Storage Only", or "Linked Folder Synced" with a folder linked), and the
  last open script reopens on reload. If the tab closes mid-save, the unsaved state is journaled and recovered on
  the next start. **⋮ → About DraftLine** shows the library's size and lets you ask the browser to protect it from
  automatic clean-up. DraftLine is built local-first: link a folder (Linked Folder) to keep physical `.draftline` files on your
  hard drive, or export anytime to Final Draft (.fdx), Fountain, or spec PDF.

## Roadmap

Want to see where DraftLine is heading? Check out our [Public Roadmap](ROADMAP.md) for upcoming desktop and
offline-first milestones.

Design notes for planned features live in `docs/specs/`: **Table Read** (local-first read-aloud) and **Revision
Mode** (colored revisions, locked pages and scene numbers).

## Testing

```bash
npm test
```

Runs the suite in `tests/` with Node's built-in test runner (no extra dependencies): Fountain/FDX round-trips, dual
dialogue, pagination rules, the plain-text importer's layouts, beat-board moves and act structures, autocomplete, and
title page metadata (credit, draft version/date, typography), the title font list (every family loaded once by index.html, bold only where it exists, never applied to the Courier Prime script), slugline variants and act-marker stripping, Backspace /
Delete behaviour, margin-note round-trips (Fountain, FDX, Import), the Format Doctor, secondary sluglines, inline
formatting (toggling, clearing, cursor-boundary isolation, every combination of bold/italic/underline/strikethrough
through Fountain, FDX and Import), page-number labels, the Format Cue element, the Story Bible (character CRUD, sorting and filtering, story-note sections, presets and
import, Story DNA questions, migration and persistence, the Story Glossary and your edits to it), the Bible's tab order and badges, the genre checklist, right-dock exclusivity, the keyboard
shortcut list, proportional page targets and Act 2 lane memory, margin-note placement (never over the script), Scene Board population (3-Act and 4-Act page targets and boundaries, scene-range input
and validation, re-populating, 3 ↔ 4 Act folding), and the project library (create, list,
switch, duplicate, rename, delete, migration from localStorage, crash-journal recovery, memory fallback) against an
in-memory IndexedDB (`tests/helpers/fakeIndexedDB.js`). `tests/helpers/miniDom.js` is a
tiny XML DOM so the Final Draft importer can be tested under Node too.

## Layout

```
src/
  App.jsx                  shell, toolbar, status bar, autosave, shortcuts
  components/Editor.jsx    paginated block editor, keyboard flow, autocomplete, dual rows
  components/Navigator.jsx scene sidebar
  components/DialogueTuner.jsx       Characters → Dialogue tab
  components/TitlePageModal.jsx
  components/PrintView.jsx print-only paginated pages
  components/TitlePageSheet.jsx  the title page in page units (canvas cover, print, modal preview)
  components/BeatBoard.jsx 4-act index-card board with drag-and-drop, Import Scenes
  components/SceneRangeModal.jsx  Manual Scene Ranges dialog
  components/Menu.jsx      small dropdown menu (Export, ⋮)
  components/HelpModal.jsx Keyboard Shortcuts and About DraftLine
  components/ProjectsDrawer.jsx  the project library drawer
  components/ProjectBibleDrawer.jsx  Story Bible drawer: DNA and Notes tabs
  components/CharactersDrawer.jsx    Characters drawer: Bios and Dialogue tabs
  components/StoryDna.jsx  Story Blueprint and Story Glossary
  components/FormattedText.jsx  styled runs (editor overlay, print, title page)
  components/ImportModal.jsx  paste / drop import with live preview
  components/FormatDoctorModal.jsx  script audit list with Fix / Fix All
  components/AutoTextarea.jsx
  hooks/useHistory.js      undo/redo with typing coalescing
  lib/screenplay.js        element model, flow rules, pagination, dual dialogue, analysis
  lib/autocomplete.js      scene heading + character suggestions
  lib/textScriptParser.js  plain-text → screenplay element heuristics (Import)
  lib/beats.js             beat model, moves, outline exporters, populate / ranges / act folding
  lib/titleFonts.js        title page font catalog
  lib/measure.js           line-snapped textarea sizing
  lib/editing.js           Backspace / Delete block operations
  lib/sluglines.js         slugline, act-break and on-screen-text detection (shared)
  lib/notes.js             [[note]] extraction and Fountain note output
  lib/formatting.js        inline formatting: ranges, toggling, following edits, Markdown/HTML/FDX conversion
  lib/projectStorage.js    IndexedDB project library, migration, crash journal
  lib/bible.js             Story Bible model: characters, story notes, notes import, Markdown reader
  lib/editorialNotes.js    margin notes: quoting, editing sessions, history, the drawer's list
  lib/revisions.js         Snapshots: create, list, restore (whole-project checkpoints)
  lib/pdf/                 File → PDF (compiled): layout (scriptPdf.js), PDF writer, TrueType reader, worker
  lib/findReplace.js       Find & Replace: matches, replace one / all (formatting kept)
  lib/reports.js           Plan → Reports: scenes, characters, locations, script; CSV
  lib/scriptDiff.js        Snapshot Compare: Myers diff by element and word (+ scriptDiff.worker.js, scriptDiffAsync.js)
  lib/storyDna.js          Story DNA blueprint model
  lib/structureDictionary.js  the 11 structure terms (starter wording) and your overrides
  lib/shortcuts.js         every keyboard shortcut (feeds the Ctrl+/ dialog)
  lib/dock.js              the right dock: Story Bible or Characters, one at a time
  lib/formatDoctor.js      script audit + fixes
  lib/fountain.js          Fountain import/export
  lib/fdx.js               Final Draft XML import/export
  lib/sampleScript.js      "The Last Ferry" sample
tests/                     node --test suite
```

---

DraftLine™ and the DraftLine logo are trademarks of Eric Lemaire Jr.
