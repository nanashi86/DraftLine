import{i as e,t}from"./react-DpjQJ7Lb.js";import"./formatting-CXVlQ9TD.js";import{$ as n,Ct as r,Q as i,S as a,X as o,Y as s,Z as c,_t as l,a as u,at as d,b as f,bt as p,ct as ee,dt as te,ft as ne,i as re,it as ie,lt as m,mt as h,n as g,nt as _,o as v,pt as y,r as b,rt as ae,s as x,t as S,tt as C,ut as oe,vt as se,x as w,y as T,yt as E}from"./index-DtPCMQY9.js";import{r as D,t as O}from"./printTitle-C1qWomuv.js";/* empty css                  */var k=e(),A=`# DraftLine User Guide

DraftLine is a distraction-free screenwriting app that runs in your browser. It writes in Courier Prime at 12 pt with standard screenplay margins, saves as you type, and works offline. This guide covers everything from your first scene heading to the final PDF.

Press {{key:F1}} at any time to open this guide. {{key:Ctrl+/}} shows every keyboard shortcut. On a Mac, read \`Ctrl\` as \`⌘\` and \`Alt\` as \`⌥\`.

## Workspace & Storage

### The workspace

The top bar holds your script's title, the **Write | Plan** switch, the **File ▾** menu, the Element picker and the B / I / U / S formatting buttons (only while you're on the page: **Page**, **Split** or Focus), the view switch (**Page**, **Split**, **Board**) and **Snapshot**. Story Bible and Characters open as panels on the right. The status bar at the bottom shows the current element, where your work is saved, scene and word counts, page count, page colour, undo / redo and zoom.

- **Page** shows the script. **Split** shows the script beside the Scene Board. **Board** shows the Scene Board alone. {{key:Alt+B}} cycles through them.
- **Focus** hides everything but the page. Press {{key:Esc}} to come back.
- The **Scenes** sidebar ({{key:Alt+S}}) lists every scene with its length in eighths of a page. Click one to jump to it, or type to find a scene.
- **Write | Plan** switches between writing the script and planning the shoot (see Production & Planning). Write is where you start.
- The status bar's steppers (**Format · 1 of 7**, **Density · 1 of 9**, a character's **MARIE · 1 of 8**) all work the same way: ‹ › step through, clicking the name lists every one, and ✕ closes it.
- **File ▾** holds everything to do with files, in three parts. **Script**: New Script ({{key:Ctrl+Alt+N}}), Open… ({{key:Ctrl+O}}), Import…, Load Sample Script (adds *The Last Ferry* to your Projects) and Title Page Settings…. **Export Script**: Script (PDF), Fountain (.fountain) and Final Draft (.fdx). **Export Outline & Bible**: Story Bible (PDF)…, and the Scene Board as a Spreadsheet (.csv), Markdown (.md) or Fountain (.fountain) outline. **Backup**: Backup Project and Snapshot History.
- Narrow windows move panels you can't see on the bar into the **⋮** menu.

### Projects and browser storage

Every script lives in your **Projects** library ({{key:Alt+P}}, or the ▾ beside the title). From there you can create, switch, rename, duplicate, export or delete scripts. Deleting asks first: the **Delete Screenplay?** dialog only deletes when you press **Permanently Delete**; **Cancel** leaves everything as it was.

By default, scripts are saved in this browser's own database (IndexedDB) on this computer. Saving is automatic, about half a second after you stop typing. {{key:Ctrl+S}} saves immediately. Nothing is uploaded and no account is needed.

Browser storage belongs to this browser profile. Clearing the browser's site data removes those scripts, so keep backups (see below) or link a folder.

### Folder Sync (Google Drive / Local Disk)

In Chrome, Edge and other Chromium browsers on a computer, DraftLine can also keep every script as a file in a folder you choose. Pick a folder inside Google Drive, Dropbox or OneDrive, and your scripts follow you to any computer that has that folder.

1. Click the save status in the status bar (it says **Saved locally**), or open Projects.
2. Under **Storage Destination**, choose **Link Folder…** and pick a folder.
3. Allow the browser to edit files in that folder.

From then on, every save goes to the browser first (instant and offline-safe) and then to the folder, as \`Your-Title.draftline\`. The status bar shows **Synced: [Folder name]** in green.

- **Scripts from the folder** appear in Projects. One marked **In folder** isn't in this browser yet; open it to bring it in. One marked **Newer in folder** was changed on another computer; opening it loads that newer copy.
- **After a browser restart**, the browser may ask again before DraftLine can write to the folder. The status bar then says **Click to allow folder sync**. One click resumes syncing.
- **If the folder can't be written** (an unplugged drive, for example), your work is still safe in the browser and the status bar says **Folder sync paused**.
- **Change Folder…** links a different folder. **Disconnect** stops syncing and leaves the files where they are. Choosing **Browser Storage (IndexedDB)** pauses syncing but remembers the folder.
- **Deleting a script** in DraftLine also takes its file out of the linked folder, so it doesn't come back. The file isn't erased: it's moved into a **Trash** folder inside the linked folder, renamed with the date it was deleted, so you can recover it there. If it can't be moved, DraftLine leaves it where it is and asks whether to delete it permanently.
- **Two computers, one script:** the most recent save wins. DraftLine doesn't merge edits made on two computers at the same time.

Safari, Firefox and phone browsers can't link folders. There, DraftLine uses browser storage only; use backups to move scripts.

### Snapshots

A snapshot is a named checkpoint of the whole project: script, title page, Scene Board and Story Bible.

- Click the camera button (**Snapshot**) in the top bar, give it a label (or keep the date and time), and save.
- **⋮ → View Snapshots** lists them, newest first. **Restore** puts a snapshot back. It offers to snapshot your current draft first (on by default), and {{key:Ctrl+Z}} undoes the restore.
- Snapshots are saved with the script and included in backups.
- With Folder Sync on, each snapshot is also written to \`{{sync.snapshotDir}}/Your-Title_YYYY-MM-DD_HHmm.draftline\` inside the linked folder. Snapshots found only in that folder (from another computer, for example) show **In folder** and can be restored like any other.

### Backups

**File → Backup Project (.draftline)** downloads one file holding everything the project is: script, formatting, margin notes, title page, Scene Board, Story Bible, characters and snapshots. Open it with **File → Open…** on any computer to restore it exactly. A restored backup never overwrites an existing script; if the same script is already there, the backup comes in beside it.

About DraftLine (**⋮ → About DraftLine**) has a **Backup Project** button too, and shows where your scripts are stored.

## Screenplay Editor

### Elements

A screenplay is made of elements, each with its own margins:

- {{element.scene}}: INT. / EXT., location and time of day.
- {{element.format_cue}}: MONTAGE, SERIES OF SHOTS, INTERCUT and their END cues.
- {{element.action}}: what we see and hear.
- {{element.character}}: the name above a speech.
- {{element.parenthetical}}: (beat), (whispering), and so on.
- {{element.dialogue}}: what the character says.
- {{element.transition}}: CUT TO:, DISSOLVE TO:.
- {{element.centered}}: centred text such as THE END.

The Element picker in the top bar shows the current element and changes it. {{element.dual}} makes a speech **dual dialogue**, side by side with the one before it.

### The Tab & Enter flow

You rarely need the mouse. **Enter** moves on to the element that usually comes next:

- Scene Heading → Action
- Action → Action
- Character → Dialogue
- Parenthetical → Dialogue
- Dialogue → Dialogue
- Transition, Format Cue or Centered → Action

**Tab** branches or changes the type:

- In Action with text, Tab starts a **Character** cue.
- In Dialogue with text, Tab inserts a **Parenthetical**.
- On an empty line, Tab cycles Action → Character → Transition → Scene Heading → Action. {{key:Shift+Tab}} goes backwards.
- Pressing Enter on an empty Character, Dialogue or Parenthetical line steps back out to Action.
- Typing \`(\` at the start of an empty Dialogue line turns it into a Parenthetical.
- {{key:Shift+Enter}} adds a line break inside Action or Dialogue.

The status bar always shows what Enter and Tab will do next.

### Autocomplete

Scene Headings suggest INT. / EXT., locations you've used and times of day. Character cues suggest names already in the script. Use ↑ ↓ to pick, then Enter or Tab to accept. {{key:Esc}} dismisses the list.

### Formatting

Select text and press {{key:Ctrl+B}} (bold), {{key:Ctrl+I}} (italic), {{key:Ctrl+U}} (underline) or {{key:Ctrl+Shift+X}} (strikethrough). With nothing selected, formatting applies to the word at the cursor. {{key:Ctrl+\\}} clears formatting. The toolbar's **B I U S** buttons do the same.

### Title page

**File → Title Page Settings…** edits the title, credit, author, source material, draft version and date, and contact details, plus the title's font, size and weight. The title page shows above page 1 and prints first.

### Margin notes

{{key:Alt+N}} opens a private margin note for the current line. Selected words are quoted into the note. Notes open in the Notes drawer (**⋮ → Margin Notes**) and are never printed or exported.

### View Only lock

{{lock.combo}}, or the **Edit** badge in the status bar, locks the script. While it shows **View Only** you can read, scroll, select and copy, and character bio cards still appear, but nothing can be typed, deleted, formatted or undone. The Element picker and B / I / U / S are dimmed. Press {{lock.combo}} again (or click the badge) to edit.

### Checking your pages

- **Format Doctor** checks the script against spec-script conventions (see below) and fixes what it can in one click, or all at once. Open it from **⋮ → Format Doctor** at any time; the menu shows how many findings there are, or **Clean**.
- While it has findings, a **Format · 1 of 7** stepper sits on the right of the status bar, and it's the Format Doctor's only control there: ‹ › go from one to the next, clicking **Format** lists them all with **Fix** and **Ignore** on each (Ignore hides one for this session), and ✕ hides the stepper until something new turns up.
- **Density** (status bar) flags Action paragraphs that run past {{density.lines}} lines, or that are walls of text. It's the same compact stepper as Format: **Density · – of 9**. ‹ › highlight them and step from one to the next (the pill then reads **Density · 1 of 9**), click **Density** for a list of every one by scene and page, and ✕ turns the highlights off.
- **Hover a character cue** to see that character's bio card. Click **Edit in Bios →** to open their bio.

### What the Format Doctor checks

- Elements that are probably tagged wrong: a scene heading or a character cue typed as Action, dialogue with no character above it, empty elements.
- A character cue with no dialogue under it, or a parenthetical with no dialogue after it.
- Scene headings: case, periods and dashes are fixed for you (\`int kitchen–night\` becomes \`INT. KITCHEN - NIGHT\`). A heading with no INT. / EXT. or no time of day is flagged for you to complete. \`INT./EXT.\`, \`INT/EXT.\` and \`I/E.\` are all accepted, and a time of day still counts with more after it (\`- NIGHT - BACK TO SCENE\`, \`- NEXT DAY\`, \`- NIGHT (FLASHBACK)\`).
- A speaking character whose first mention in the Action isn't in capitals ("Marie" for MARIE). The fix capitalizes it.
- Double blank lines inside an element, which are stripped.

### Scene headings: formatting tips

A scene heading (slugline) goes from the biggest place to the smallest, then the time:

\`INT./EXT. MASTER LOCATION - SPECIFIC ROOM OR AREA - TIME OF DAY\`

**Hyphens ( - ) are for physical spaces.** Each one steps further in:

- \`INT. BOUCHARD RESIDENCE - MASTER BEDROOM - NIGHT\`
- \`INT. POLICE STATION - INTERROGATION ROOM - DAY\`
- \`EXT. CINEUS RESIDENCE - BACKYARD - NIGHT\`

**Parentheses ( ) are for everything that isn't a place**: the state of a vehicle, the mode of the story, the camera or the sound.

- Vehicle state: \`INT. TAP-TAP - NIGHT (MOVING)\`
- Story mode: \`(FLASHBACK)\`, \`(DREAM)\`, \`(FANTASY)\`
- Sound and perspective: \`(INTERCUT)\`, \`(PRE-LAP)\`
- Sequence: \`(SERIES OF SHOTS)\`

Keeping them apart pays off later: Plan reads the hyphenated parts as the location and shows the parentheses as a separate tag, so \`EXT. CROIX-DES-BOSSALES - NIGHT (FLASHBACK)\` schedules as a night exterior at Croix-des-Bossales, marked FLASHBACK.

**Interior and exterior together.** Write the combined prefix with no spaces around the slash (\`INT./EXT.\`, or \`INT/EXT.\`), and lead with the side where the camera setup begins: \`INT./EXT. CAR - NIGHT\` when we start inside, \`EXT./INT. PORCH - DAY\` when we start outside. Plan colours the strip by the side you lead with.

**Time of day.** DAY and NIGHT are the clearest, and anything containing them works too (\`NEXT DAY\`, \`LATER THAT NIGHT\`). CONTINUOUS, LATER and MOMENTS LATER say the scene follows straight on, so it keeps the previous scene's light.

### Page colour and zoom

The status bar switches the page colour: {{themes}}. The zoom controls sit at the far right. The page shrinks to fit when panels are open.

## Story Bible

The Story Bible ({{key:Alt+I}}) keeps everything about the story that isn't the script. It's saved with the project and switches with it in Projects. The ⤢ button in the panel's header expands it to the full window; {{key:Esc}} collapses it again.

### DNA: Blueprint

The **Blueprint** walks through the spine of the story in {{dna.count}} questions:

{{dna.questions}}

The Conflict question also records its type: Individual vs. {{dna.conflictTypes}}.

It also records genre, theme and **Plot Devices**. {{dna.defaultDevices}} are always listed. You can add {{dna.optionalDevices}}, each with Yes / No and notes. The ⓘ beside any term shows its definition.

### DNA: Glossary

The **Glossary** defines every story term in two sections, {{glossary.sections}}. Search filters both at once. Definitions marked **starter** are DraftLine's; click **Edit** to paste your own reference's wording. Your wording is kept for all your projects, and **Reset to starter text** brings the original back.

### Notes

**Notes** holds free-form cards: {{notes.sections}}. Rename, remove or add your own sections. Every card has **Edit** / **Done** and saves as you type. Cards accept Markdown: headings, lists, quotes, **bold** and *italic*.

### Synopsis & Treatment

{{acts.cards}} sit right after {{notes.fixedAfter}}, written act by act, in {{acts.structures}}, the same switch as the Scene Board's (the **3 Acts** / **4 Acts** buttons above the notes change both).

- **Synopsis**: in 3 acts, {{acts.labels.3}}; in 4 acts, {{acts.labels.4}}.
- **Treatment**: your full narrative treatment, sequence-by-sequence prose, scene breakdowns and subplots, in the same acts. It adapts to the active 3- or 4-act view. Write each act there, or paste it in with Import from Notes.

Switching never loses text, and never adds any. Going from 4 acts to 3 joins Act 2A and Act 2B into Act II with a blank line between them; DraftLine quietly remembers where Act 2B began, so switching back splits them exactly where they were, even if you've added to Act II meanwhile. Otherwise, going from 3 acts to 4 splits Act II at a \`### Act 2B\` or \`## Midpoint\` heading, a \`---\` line or an \`[ACT 2B]\` tag if you've put one in. Failing that, Act 2B starts at the first paragraph that names the location of the first Act 2B scene on the Scene Board, or mentions the story's midpoint, whichever comes first, and otherwise at the paragraph break nearest the middle. (If Act 2B already has text, going to 4 acts leaves both as they are.) In 4 acts, **Auto-Align Acts** re-splits an existing Act 2A and Act 2B the same way, in both the Synopsis and the Treatment; text only moves between the two.

### Copying and importing notes

- **Copy as Markdown** copies every note, in order, ready to paste into a document. The acts come out in the active view: the Treatment as {{acts.headings.3}} in 3 acts, or {{acts.headings.4}} in 4 acts.
- **Import from Notes** pastes text from Docs, Word, Notion or Apple Notes into a section (or straight into one act of the Treatment), appended or replacing what's there. **Split by headings** turns each heading into a section. Under a \`## Treatment\` or \`## Synopsis\` heading, act headings fill that act: both traditional Roman numerals and 4-act numbers are recognized, such as {{acts.importExamples}}. Any other sub-headings stay inside the act they follow, so Copy as Markdown output imports straight back.

## Characters

Characters ({{key:Alt+C}}) has two tabs, **Bios** and **Dialogue**.

### Bios

Each bio has:

- **Name**
- **Primary Role**: {{roles.primary}}.
- **Secondary Function**: an archetype such as {{roles.secondary}}.
- **Relationship**: free text, for example "Brother-in-law to Fito, manages textile warehouse".
- **Age / Timeline**: for example "10 in 1986, 45 in 2021".
- **Physical Description**: how they look, for example "Tall, lean, weathered hands, always wearing a faded denim jacket".
- **Traits**
- **Backstory / Motivation**

The ⓘ beside each role picker explains the role, and clicking it opens that term in the Glossary. A collapsed bio shows its roles, for example "FITO · Deuteragonist (Foil)".

### Script characters and your own additions

DraftLine reads the character cues in your script. Anyone who speaks but has no bio appears under **Missing bios**; click a name to start their bio. You can also add bios yourself with **+ Add Character**, for characters who haven't spoken yet or never do. Filter, sort A–Z, or move bios up and down.

**Rename** changes a character's name everywhere at once: cues, dialogue and action mentions, the Scene Board, the Story Bible and other bios. It shows a review first and is one undo step.

### Dialogue

The **Dialogue** tab ({{key:Alt+T}}) gathers every line one character speaks, in script order, with its scene and page. Pick a character at the top. You can edit lines right there (changes go straight into the script), filter the lines, show the line before each speech for context (**Cue context**), and jump to any line in the script with **Go ↗**. Nothing is picked when you open it. Picking a character also highlights their speeches in the script, scrolls to their first line, and shows a stepper in the status bar, **MARIE · 1 of 8**: step through their speeches with ‹ › (or {{key:Alt+Down}} / {{key:Alt+Up}}), click the name for a list of every speech, and clear the filter with ✕ or \`Esc\`. The stepper is the filter's only control: nothing covers the page.

Above the lines are the character's totals: lines, words, scenes and average words per line, plus **Monologues** (speeches over five printed lines or 60 words) and **Cadence**: **Fast / Banter** under 8 words a line, **Expository** over 20, **Balanced** in between.

## Scene Board & Pacing

The **Scene Board** (formerly the Beat Board; **Board** or **Split** view) lays the story out as index cards in act columns.

### Acts and cards

- Switch between **3 Acts** ({{board.columns.3}}, with a Midpoint divider in Act 2) and **4 Acts** ({{board.columns.4}}). Switching never moves or loses a card. It's the same setting as the act switch in Notes, so it also splits or joins Act II of the Synopsis and Treatment (see Synopsis & Treatment).
- Each card has a headline, a synopsis and colour tags: {{board.tags}}. Click a tag in the legend to show only those cards.
- **Value Shift** (the **+/−** button on a card) records how the scene's emotional charge turns: **+ / −** (a setback), **− / +** (a small win or insight), or **+ / +** and **− / −**, which are marked as warnings because the scene doesn't turn. It's saved with the project.
- **Analyze Value Shifts** (beside Populate from Script) reads every scene and suggests its Value Shift. It compares the opening quarter of the scene's Action and Dialogue with the closing quarter: calm, help and agreement count as **+**; threats, obstacles and tension as **−**, and at the end, interruptions, weapons, violence, sudden exits and discoveries count double. The list shows each scene's number, slugline, the suggested shift and the card's current one. Hover a suggestion to see the words it's based on; **weak** means the scene gave little to go on. ✓ sets one card, **Apply to All Cards** sets every linked card (with Undo). Scenes without a card need **Populate from Script** first. It's a word-level reading, so treat it as a second opinion.
- **+ Add Card** adds a card to a column. Drag cards by their grip to reorder them or move them between acts.

### Linking cards to scenes

**Populate from Script** fills the board from your script, one card per scene, linked to that scene:

- **Auto-Distribute (% Targets)** places scenes by page: about {{board.targets.3}} for 3 acts, or {{board.targets.4}} for 4 acts.
- **Manual Scene Ranges…** lets you say which scenes belong to each act (for example 1–12, 13–40, 41–55).

Moving a linked card also moves its scene in the script (one undo step).

### Pacing distribution

Once cards are linked to scenes, each act column shows how many pages its scenes add up to and what share of the script that is, for example "24 pgs · 25%". A coloured status dot appears when an act runs more than {{board.tolerance}} points above or below its usual share (3 acts: {{board.targets.3}}; 4 acts: {{board.targets.4}}). Hover the badge for details.

### Outline export

The Scene Board's **Export Outline** downloads the board as a **Fountain Outline**, **Markdown**, or a **Spreadsheet** (.csv, named "Title_Scene_Outline.csv") with one row per card: scene number, act, heading, summary, tags, Value Shift and page. The same three are in **File ▾ → Export Outline & Bible**.

## Production & Planning

**Plan** (the **Write | Plan** switch in the top bar) turns the script into a production breakdown and a stripboard, for writer-directors getting ready to shoot. Everything that comes from the script is worked out from it each time you look, so there's nothing to keep in step: rewrite a scene and its breakdown follows.

### Write and Plan

- **Write** is the screenplay editor, with **Page**, **Split** and **Board**, **Focus**, **Story Bible** and **Characters** on the right of the top bar. In **Plan** those same places hold **Breakdowns | Stripboard**, **Collapse All / Expand All** and **Export Breakdown (.csv)**; the title, **Write | Plan**, **File ▾**, **Snapshot** and **⋮** stay put. On a smaller screen Plan's tools shorten (Export becomes **Export (.csv)**, the view switch turns to icons) and then move into **⋮**, the same way Write's do.
- The title, the Projects library, **File ▾**, **Snapshot** and the ⋮ menu (About, User Guide) stay in both.
- Switching never loses anything. Your script stays exactly as it was, unsaved typing included, and it keeps saving. Coming back to Write puts the script and the Scene Board where you'd scrolled them.
- **Write** on a breakdown card, or a click on a strip, takes you back to Write at that scene.

### What comes from the script

- **Scene number and slugline**: every scene heading, numbered in script order.
- **INT / EXT**: from the start of the heading, as written: INT, EXT, INT/EXT or EXT/INT. A combined heading is coloured by the side it leads with: INT./EXT. (and I/E) as an interior, EXT./INT. as an exterior.
- **Day or night**: from the part after the location that holds a day or night word, so \`NEXT DAY\`, \`FOLLOWING NIGHT\`, \`LATER THAT DAY\` and \`DAY - CONTINUOUS\` all read. DAY, MORNING, AFTERNOON, DAWN and SUNRISE are day; NIGHT, EVENING, DUSK and SUNSET are night. CONTINUOUS, LATER and MOMENTS LATER take the light of the scene before. The stripboard's D/N column shows the result as DAY or NIGHT; a heading without one is marked **DAY/NIGHT?**.
- **Modifiers**: anything in parentheses — \`(FLASHBACK)\`, \`(DREAM)\`, \`(MOVING)\` — is shown as a tag beside the location and never hides the time of day (see Scene headings: formatting tips).
- **Page eighths**: each scene's length in eighths of a page, the way a call sheet counts it: **6/8**, **1 2/8**. It's measured from the lines the scene takes on the page (a page is {{plan.pageLines}} lines), and every scene counts as at least 1/8.
- **Cast (Speaking)**: everyone with a line in the scene, from the character cues (extensions like (V.O.) and (CONT'D) are left off). Each character gets a **cast number**, as on a call sheet: 1 is the character with the most lines in the script, then 2, 3 …

### Breakdowns

One card per scene: **number · slugline · INT/EXT and DAY/NIGHT badges · length in eighths**, the speaking cast as pills, and four lists you fill in: **Background / Extras**, **Props & Set Dressing**, **Wardrobe & SFX** and **Vehicles & Stunts**. Click **+ Add** on a list, type, and press \`Enter\` (commas add several at once). The × on an item removes it. **Production Notes** takes anything else: permits, locations to scout, a stunt to rehearse. The ▾ folds a card.

### Stripboard

Every scene as one strip, in script order, coloured the standard way: **INT. DAY** white, **EXT. DAY** yellow, **INT. NIGHT** blue, **EXT. NIGHT** green (grey when the heading has no day or night). Each strip shows the scene number, INT/EXT, location, time of day, length in eighths and the cast numbers of who speaks. The legend at the top counts scenes, pages and strips of each colour.

### Where planning is saved

Your lists and notes are saved with the script, inside the project, and kept by everything that keeps the project: the browser library, a linked folder, **Backup Project** (.draftline) and **Snapshots** (restoring a snapshot puts its breakdowns back too). They're kept per scene, so they stay with a scene when you rename its heading or move it. Scripts and backups from before Plan existed open as usual, with empty breakdowns. **Export Breakdown** downloads a spreadsheet (.csv, named "Title_Breakdown.csv") with one row per scene: number, slugline, INT/EXT, day or night, eighths, page, speaking cast, each list and the notes.

## Export & Deliverables

### Formats

- **.draftline**: DraftLine's own format, holding the complete project. Use **Backup Project**, or link a folder (above), to keep and move scripts with nothing lost.
- **.fountain**: plain-text screenplay format, readable by Highland, Slugline, WriteSolo, Fade In and many others.
- **.fdx**: Final Draft's format, for sending to Final Draft users and productions.
- **Scene outline**: a Fountain Outline, Markdown, or a Spreadsheet (.csv), from the Scene Board.
- **Breakdown**: **Export Breakdown** in Plan, a spreadsheet (.csv) of every scene's breakdown (see Production & Planning).
- **Story Bible (PDF)**: **File → Story Bible (PDF)…** turns Story DNA, Story Notes and Character Bios (any or all of them) into a formatted dossier headed with the title, author and "Story Bible & Project Dossier", each section starting on a new page. Choose **Save as PDF** in the print dialog; the file is named "<Title> - Story Bible". Story Notes go in this order: Logline, Tone, Pitch, Timeline, Synopsis, then the Treatment by act. Of your own note cards, only those with "Note" in the title are included ("Note: Haiti 1986", "Note Revisions"); research questions and brainstorms stay in DraftLine, and the Scratchpad never goes. Only characters with something in their bio are included.

### Opening and importing

- **File → Open…** ({{key:Ctrl+O}}) reads \`.fountain\`, \`.fdx\`, \`.txt\` and \`.draftline\` files. Each opens as a new script; your others stay in Projects.
- **File → Import…** takes a script copied from Google Docs, Word, a PDF or plain text, detects its elements, and shows a preview before anything changes. **Join wrapped lines** repairs lines broken by a PDF. You can add the import after your current script instead of starting a new one.

### Printing and PDF

**File → Script (PDF)** ({{key:Ctrl+P}}) prints exactly what the editor shows: Courier Prime 12 pt, standard margins and the same page breaks. The title page prints first, unnumbered, and page numbers start on page 2. Choose **Save as PDF** in the print dialog for a PDF. Margin notes, highlights and the Midnight page colour never print.

## Editor Curiosities & Secrets

A few small surprises DraftLine keeps up its sleeve. None of them changes your script, and none of them ever prints.

### Spec Stamp

Tick **Spec stamp** in the Title Page dialog for a faded crimson stamp across the title page, tilted {{curiosities.stampAngle}}: {{curiosities.stampText}} It shows on screen only, and DraftLine remembers whether it's on.

### Chilli Palmer

A brand-new script's title page starts blank, with **{{curiosities.defaultAuthor}}**, a 555 number and a Palmer Films address showing faintly as placeholders, in homage to *Get Shorty*. They're never saved or printed. Save the Title Page with your own name and contact once, and every new script starts with yours instead.

### Writing pace milestones

A small note pops up in the corner of the window, once per session, when your own typing gets you there:

- **{{curiosities.wordGoal}} words** written this session: {{milestones.words500}}
- **Late at night**, finishing a sentence between {{curiosities.lateNight}}: {{milestones.lateNight}}
- **Page {{curiosities.page90}}**: {{milestones.page90}}
- **Page {{curiosities.page120}}**: {{milestones.page120}}

### Film Noir mode

Press {{curiosities.noirCombo}} or select **{{curiosities.noirGenre}}** under Story DNA → Genre to turn the room 1940s: typed paper on a dark desk with a coffee ring, Venetian-blind light falling from the window, film grain, and ambient rain audio. Press \`Esc\` to exit.
`,j=[`Esc`,`Enter`,`Tab`];function M(e,t={},{shortcuts:n=null}={}){let r=[];return{text:String(e||``).replace(/\{\{\s*([^{}]+?)\s*\}\}/g,(e,i)=>{if(i.startsWith(`key:`)){let e=i.slice(4).trim();return n&&!n[e]&&!j.includes(e)&&r.push(i),`\`${e}\``}return Object.prototype.hasOwnProperty.call(t,i)?t[i]:(r.push(i),e)}),missing:r}}var N=e=>String(e||``).normalize(`NFD`).replace(/\p{M}/gu,``).toLowerCase(),P=e=>N(e).replace(/[^a-z0-9]+/g,`-`).replace(/^-+|-+$/g,``);function F(e){let t=[],n=/`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*?)\*/g,r=0,i;for(;i=n.exec(e);)i.index>r&&t.push({t:`text`,v:e.slice(r,i.index)}),i[1]==null?i[2]==null?t.push({t:`i`,v:i[3]}):t.push({t:`b`,v:i[2]}):t.push({t:`code`,v:i[1]}),r=n.lastIndex;return r<e.length&&t.push({t:`text`,v:e.slice(r)}),t}var I=e=>F(e).map(e=>e.v).join(``);function L(e){let t=[],n=[],r=null,i=()=>{n.length&&t.push({type:`p`,text:n.join(` `)}),n=[],r&&t.push(r),r=null};for(let t of e){let e=t.trim(),a;e?(a=/^[-*]\s+(.*)$/.exec(e))?((n.length||r?.type!==`ul`)&&i(),r??={type:`ul`,items:[]},r.items.push(a[1])):(a=/^(\d+)[.)]\s+(.*)$/.exec(e))?((n.length||r?.type!==`ol`)&&i(),r??={type:`ol`,start:Number(a[1]),items:[]},r.items.push(a[2])):r?r.items[r.items.length-1]+=` ${e}`:n.push(e):i()}return i(),t}function R(e){let t=String(e||``).replace(/\r\n?/g,`
`).split(`
`),n=``,r=[],i=[],a=r,o=null,s=new Set,c=e=>{let t=P(e)||`section`;for(let n=2;s.has(t);n+=1)t=`${P(e)}-${n}`;return s.add(t),t},l=()=>{a.target&&(a.target.blocks=L(a))};for(let e of t){let t=/^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(e);if(!t){a.push(e);continue}let s=t[1].length,u=t[2].trim();if(l(),s===1)n=u,a=r;else if(s===2)o={id:c(u),title:u,blocks:[],topics:[]},i.push(o),a=[],a.target=o;else{let e={id:c(u),title:u,blocks:[]};o||(o={id:c(`General`),title:`General`,blocks:[],topics:[]},i.push(o)),o.topics.push(e),a=[],a.target=e}}return l(),{title:n,intro:L(r.target?[]:r),chapters:i}}var z=e=>e.type===`p`?I(e.text):e.items.map(I).join(` `);function B(e,t){let n=N(t).split(/\s+/).filter(Boolean);if(!n.length)return{chapters:e.chapters,count:null};let r=e=>n.every(t=>e.includes(t)),i=0,a=[];for(let t of e.chapters){let e=N(`${t.title} ${t.blocks.map(z).join(` `)}`),n=N(t.title),o=t.topics.filter(e=>r(N(`${n} ${e.title} ${e.blocks.map(z).join(` `)}`))),s=t.blocks.length>0&&r(e);(o.length||s)&&(i+=o.length+ +!!s,a.push({...t,blocks:s?t.blocks:[],topics:o}))}return{chapters:a,count:i}}function V(e,t){let n=N(t).split(/\s+/).filter(Boolean);if(!n.length||!e)return[{v:e,hit:!1}];let r=[...e],i=r.map(e=>N(e)),a=i.join(``),o=[];i.forEach((e,t)=>{for(let n=0;n<e.length;n+=1)o.push(t)});let s=Array(r.length).fill(!1);for(let e of n){let t=a.indexOf(e);for(;t>=0;){for(let n=t;n<t+e.length;n+=1)s[o[n]]=!0;t=a.indexOf(e,t+e.length)}}let c=[];return r.forEach((e,t)=>{let n=c[c.length-1];n&&n.hit===s[t]?n.v+=e:c.push({v:e,hit:s[t]})}),c}var H=e=>String(e).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`),U=e=>F(e).map(({t:e,v:t})=>e===`b`?`<strong>${H(t)}</strong>`:e===`i`?`<em>${H(t)}</em>`:e===`code`?`<code>${H(t)}</code>`:H(t)).join(``),W=e=>e.map(e=>e.type===`p`?`<p>${U(e.text)}</p>`:`<${e.type}${e.type===`ol`&&e.start!==1?` start="${e.start}"`:``}>${e.items.map(e=>`<li>${U(e)}</li>`).join(``)}</${e.type}>`).join(`
`),G=`DraftLine - User Guide`;function K(e,{version:t=``,title:n=G}={}){let r=[`<h1>${H(e.title)}</h1>`,t?`<p class="ver">DraftLine ${H(t)}</p>`:``,W(e.intro),`<nav><ol>${e.chapters.map(e=>`<li>${H(e.title)}</li>`).join(``)}</ol></nav>`,...e.chapters.map(e=>[`<h2>${H(e.title)}</h2>`,W(e.blocks),...e.topics.map(e=>`<h3>${H(e.title)}</h3>\n${W(e.blocks)}`)].join(`
`))].join(`
`);return`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${H(n)}</title>
<style>
  @page { margin: 0.8in; }
  body { font: 11pt/1.5 -apple-system, "Segoe UI", Inter, Helvetica, Arial, sans-serif; color: #111; max-width: 7in; margin: 0 auto; }
  h1 { font-size: 22pt; margin: 0 0 4pt; }
  .ver { color: #666; margin-top: 0; }
  h2 { font-size: 15pt; margin: 22pt 0 6pt; padding-bottom: 3pt; border-bottom: 1px solid #ccc; break-after: avoid; }
  h3 { font-size: 12pt; margin: 14pt 0 4pt; break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  ul, ol { padding-left: 20pt; }
  code { font: 10pt "Courier Prime", "Courier New", monospace; background: #f1f1f1; padding: 0 3px; border-radius: 3px; }
  nav ol { columns: 2; }
</style></head><body>
${r}
</body></html>`}var ce={acts:{structures:c,default:4,cards:[`Synopsis`,ie.label],labels:Object.fromEntries(c.map(e=>[e,d(`synopsis`,e,null).map(e=>e.label)])),treatmentHeadings:Object.fromEntries(c.map(e=>[e,d(`treatment`,e,null).map(ee)]))},notes:{sections:n,fixedCardsAfter:ae},board:{structures:w,tags:a,pacingTargets:f,pacingTolerance:7},characters:{primaryRoles:C,secondaryRoles:_.filter(e=>e.id!==`none`),fields:i},dna:{questions:ne,conflictTypes:oe,plotDevices:h,defaultDevices:te},glossary:{sections:m},shortcuts:p,elements:E,canvasThemes:x,density:{lineLimit:4},lock:{combo:r},sync:{snapshotDir:T},colors:{accent:`#c8553d`,text:`#e9e7e2`,muted:`#9a9890`,"tag-plot":`#c8553d`,"tag-subplot":`#3d7cc8`,"tag-character":`#3f9a6b`,"tag-theme":`#8a5cc8`},curiosities:{stamp:{text:o,angle:-18},defaultAuthor:s,milestones:re,wordGoal:500,lateNight:b,pages:u,noir:{combo:S,genre:y.find(g)}}},q=e=>`**${e}**`,J=(e,t=`and`)=>e.length<=1?e.join(``):`${e.slice(0,-1).join(`, `)} ${t} ${e[e.length-1]}`,le=e=>[`I`,`II`,`III`,`IV`][e-1];function ue(e=ce){let t={},n=e.acts;t[`acts.structures`]=J(n.structures.map(e=>`${e} acts`),`or`),t[`acts.cards`]=J(n.cards.map(q));for(let r of n.structures)t[`acts.labels.${r}`]=n.labels[r].join(`, `),t[`acts.short.${r}`]=n.labels[r].map(e=>e.split(`:`)[0]).join(`, `),t[`acts.headings.${r}`]=n.treatmentHeadings[r].map(e=>`\`### ${e}\``).join(`, `),t[`board.columns.${r}`]=e.board.structures[r].map(e=>e.label).join(` · `),t[`board.targets.${r}`]=`${e.board.pacingTargets[r].join(` / `)}%`;t[`acts.importExamples`]=`${n.structures.includes(3)?"`### ACT I: SETUP`, `### ACT II`":``}${n.structures.includes(4)?", `### ACT 1`, `### ACT 2A`, `### ACT 2B`, `### ACT 3`":``}`,t[`acts.default`]=`${n.default} acts`,t[`notes.sections`]=J(e.notes.sections.map(q)),t[`notes.fixedAfter`]=e.notes.fixedCardsAfter,t[`board.tags`]=J(e.board.tags.map(e=>q(e.label))),t[`board.tolerance`]=String(e.board.pacingTolerance),t[`roles.primary`]=J(e.characters.primaryRoles.map(e=>e.label),`or`),t[`roles.secondary`]=J(e.characters.secondaryRoles.map(e=>e.label),`or`),t[`bio.fields`]=e.characters.fields.map(e=>`- ${q(e.label)}`).join(`
`),t[`dna.count`]={8:`eight`}[e.dna.questions.length]||String(e.dna.questions.length),t[`dna.questions`]=e.dna.questions.map((e,t)=>`${t+1}. ${q(e.label)}: ${e.question.replace(/’/g,`'`)}`).join(`
`),t[`dna.conflictTypes`]=J(e.dna.conflictTypes.map(e=>e.replace(/^Individual vs\. /,``)),`or`),t[`dna.defaultDevices`]=J(e.dna.defaultDevices.map(t=>e.dna.plotDevices.find(e=>e.id===t)?.label)),t[`dna.optionalDevices`]=J(e.dna.plotDevices.filter(t=>!e.dna.defaultDevices.includes(t.id)).map(e=>e.label)),t[`glossary.sections`]=J(e.glossary.sections.map(e=>q(e.label))),t[`density.lines`]={4:`four`}[e.density.lineLimit]||String(e.density.lineLimit),t[`plan.pageLines`]=`54`,t[`lock.combo`]=`\`${e.lock.combo}\``,t[`sync.snapshotDir`]=e.sync.snapshotDir,t.themes=e.canvasThemes.map(e=>`${q(e.label)} (${e.hint.charAt(0).toLowerCase()}${e.hint.slice(1)})`).join(` or `);for(let n of e.elements)t[`element.${n.type}`]=`${q(n.label)} (\`${n.combo}\`)`;t[`element.dual`]=`\`${se.combo}\``;let r=e.curiosities;t[`curiosities.stampText`]=`“${r.stamp.text}”`,t[`curiosities.stampAngle`]=`${r.stamp.angle}°`,t[`curiosities.defaultAuthor`]=r.defaultAuthor,t[`curiosities.wordGoal`]=String(r.wordGoal);let i=e=>e===0?`midnight`:`${e}:00 AM`;t[`curiosities.lateNight`]=`${i(r.lateNight[0])} and ${i(r.lateNight[1])}`;for(let[e,n]of r.pages)t[`curiosities.${e}`]=String(n);let a=e=>/^[“"]/.test(e)?e:`“${e}”`;for(let[e,n]of Object.entries(r.milestones))t[`milestones.${e}`]=a(n);return t[`curiosities.noirCombo`]=`\`${r.noir.combo}\``,t[`curiosities.noirGenre`]=r.noir.genre,t[`acts.roman`]=n.structures.includes(3)?[1,2,3].map(e=>`Act ${le(e)}`).join(`, `):``,t}var Y=ue(),X=t(),Z=R(M(A,Y,{shortcuts:p}).text);function Q({text:e,query:t}){return F(e).map((e,n)=>{let r=V(e.v,t).map((e,t)=>e.hit?(0,X.jsx)(`mark`,{children:e.v},t):e.v);return e.t===`b`?(0,X.jsx)(`strong`,{children:r},n):e.t===`i`?(0,X.jsx)(`em`,{children:r},n):e.t===`code`?(0,X.jsx)(`kbd`,{children:r},n):(0,X.jsx)(`span`,{children:r},n)})}function $({blocks:e,query:t}){return e.map((e,n)=>{if(e.type===`p`)return(0,X.jsx)(`p`,{children:(0,X.jsx)(Q,{text:e.text,query:t})},n);let r=e.type;return(0,X.jsx)(r,{start:e.type===`ol`&&e.start!==1?e.start:void 0,children:e.items.map((e,n)=>(0,X.jsx)(`li`,{children:(0,X.jsx)(Q,{text:e,query:t})},n))},n)})}function de(e){let t=K(Z,{version:v.version,title:G});D({openWindow:(...e)=>window.open(...e),html:t,title:`DraftLine - User Guide`})||fe(t,e)}function fe(e,t){let n=document.createElement(`iframe`);n.setAttribute(`aria-hidden`,`true`),n.style.cssText=`position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden`,n.srcdoc=e,n.onload=()=>{let e=O({topWindow:window,frameWindow:n.contentWindow,title:G,onDone:()=>{t?.focus(),setTimeout(()=>n.remove(),500)}});n.contentWindow.focus(),n.contentWindow.print(),e.armFallback()},document.body.appendChild(n)}function pe({onClose:e}){let t=(0,k.useRef)(null),n=(0,k.useRef)(null),r=(0,k.useRef)(null),[i,a]=(0,k.useState)(``),[o,s]=(0,k.useState)(!1),c=(0,k.useMemo)(()=>B(Z,i),[i]),u=c.count!=null;(0,k.useEffect)(()=>{let e=t.current;e&&!e.open&&e.showModal(),r.current?.focus()},[]);let d=e=>{n.current?.querySelector(`#ug-${CSS.escape(e)}`)?.scrollIntoView({block:`start`,behavior:`smooth`})};return(0,X.jsxs)(`dialog`,{ref:t,className:`hm-modal ug-modal${o?` is-expanded`:``}`,"aria-labelledby":`ug-title`,onCancel:t=>{t.preventDefault(),i?a(``):o?s(!1):e()},onMouseDown:n=>{n.target===t.current&&e()},children:[(0,X.jsxs)(`header`,{className:`hm-head ug-head`,children:[(0,X.jsx)(`h2`,{id:`ug-title`,children:`User Guide`}),(0,X.jsx)(`input`,{ref:r,className:`ug-search`,type:`search`,value:i,onChange:e=>{a(e.target.value),n.current?.scrollTo({top:0})},placeholder:`Search the guide…`,"aria-label":`Search the User Guide`}),(0,X.jsxs)(`div`,{className:`ug-actions`,children:[(0,X.jsx)(`button`,{type:`button`,className:`btn`,onClick:e=>de(e.currentTarget),title:`Print the whole guide, or choose Save as PDF`,children:`Print / Save PDF`}),(0,X.jsx)(l,{expanded:o,onToggle:()=>s(e=>!e)}),(0,X.jsx)(`button`,{type:`button`,className:`btn`,onClick:e,children:`Close`})]})]}),(0,X.jsxs)(`div`,{className:`ug-main`,children:[(0,X.jsxs)(`nav`,{className:`ug-toc`,"aria-label":`Contents`,children:[(0,X.jsx)(`div`,{className:`micro-label`,children:`Contents`}),(0,X.jsx)(`ol`,{children:Z.chapters.map(e=>{let t=c.chapters.some(t=>t.id===e.id);return(0,X.jsxs)(`li`,{children:[(0,X.jsx)(`button`,{type:`button`,className:`ug-toc-ch${u&&!t?` is-dim`:``}`,onClick:()=>d(e.id),disabled:u&&!t,children:e.title}),o&&!u&&(0,X.jsx)(`ol`,{children:e.topics.map(e=>(0,X.jsx)(`li`,{children:(0,X.jsx)(`button`,{type:`button`,className:`ug-toc-topic`,onClick:()=>d(e.id),children:e.title})},e.id))})]},e.id)})})]}),(0,X.jsxs)(`article`,{className:`ug-body`,ref:n,"aria-live":`polite`,children:[u?(0,X.jsx)(`p`,{className:`ug-count`,children:c.count?`${c.count} ${c.count===1?`topic matches`:`topics match`} “${i.trim()}”`:`Nothing in the guide matches “${i.trim()}”.`}):(0,X.jsxs)(X.Fragment,{children:[(0,X.jsx)(`h1`,{className:`ug-title`,children:Z.title}),(0,X.jsx)($,{blocks:Z.intro,query:``})]}),c.chapters.map(e=>(0,X.jsxs)(`section`,{className:`ug-chapter`,"aria-labelledby":`ug-${e.id}`,children:[(0,X.jsx)(`h2`,{id:`ug-${e.id}`,children:(0,X.jsx)(Q,{text:e.title,query:i})}),(0,X.jsx)($,{blocks:e.blocks,query:i}),e.topics.map(e=>(0,X.jsxs)(`section`,{className:`ug-topic`,"aria-labelledby":`ug-${e.id}`,children:[(0,X.jsx)(`h3`,{id:`ug-${e.id}`,children:(0,X.jsx)(Q,{text:e.title,query:i})}),(0,X.jsx)($,{blocks:e.blocks,query:i})]},e.id))]},e.id))]})]})]})}export{pe as default};