import{K as e,q as t}from"./formatting-ROOIYVNG.js";import{A as n,C as r,D as i,E as a,F as o,I as s,L as c,M as l,N as u,O as d,P as f,R as p,S as m,T as h,V as g,_,a as v,b as y,g as b,h as ee,i as x,j as S,k as C,m as w,n as te,o as ne,r as re,s as ie,t as ae,v as oe,w as T,x as E,y as D}from"./index-kjHu-8XI.js";/* empty css                  */var O=t(),k=`# DraftLine User Guide

DraftLine is a distraction-free screenwriting app that runs in your browser. It writes in Courier Prime at 12 pt with standard screenplay margins, saves as you type, and works offline. This guide covers everything from your first scene heading to the final PDF.

Press {{key:F1}} at any time to open this guide. {{key:Ctrl+/}} shows every keyboard shortcut. On a Mac, read \`Ctrl\` as \`⌘\` and \`Alt\` as \`⌥\`.

## Workspace & Storage

### The workspace

The top bar holds your script's title, file actions (New, Open, Import, Title Page), the Element picker, the B / I / U / S formatting buttons, the view switch (**Page**, **Split**, **Board**) and the Export menu. Story Bible and Characters open as panels on the right. The status bar at the bottom shows the current element, where your work is saved, scene and word counts, page count, page colour, undo / redo and zoom.

- **Page** shows the script. **Split** shows the script beside the Scene Board. **Board** shows the Scene Board alone. {{key:Alt+B}} cycles through them.
- **Focus** hides everything but the page. Press {{key:Esc}} to come back.
- The **Scenes** sidebar ({{key:Alt+S}}) lists every scene with its length in eighths of a page. Click one to jump to it, or type to find a scene.
- Narrow windows tuck File actions into a **File ▾** menu, and panels you can't see on the bar move into the **⋮** menu.

### Projects and browser storage

Every script lives in your **Projects** library ({{key:Alt+P}}, or the ▾ beside the title). From there you can create, switch, rename, duplicate, export or delete scripts. Deleting asks first: the **Delete Screenplay?** dialog only deletes once you type **DELETE** and press **Permanently Delete**; **Cancel** leaves everything as it was.

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

**Export → Backup Project (.draftline)** downloads one file holding everything the project is: script, formatting, margin notes, title page, Scene Board, Story Bible, characters and snapshots. Open it with **Open** on any computer to restore it exactly. A restored backup never overwrites an existing script; if the same script is already there, the backup comes in beside it.

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

**Title Page** in the top bar edits the title, credit, author, source material, draft version and date, and contact details, plus the title's font, size and weight. The title page shows above page 1 and prints first.

### Margin notes

{{key:Alt+N}} opens a private margin note for the current line. Selected words are quoted into the note. Notes open in the Notes drawer (**⋮ → Margin Notes**) and are never printed or exported.

### View Only lock

{{lock.combo}}, or the **Edit** badge in the status bar, locks the script. While it shows **View Only** you can read, scroll, select and copy, and character bio cards still appear, but nothing can be typed, deleted, formatted or undone. The Element picker and B / I / U / S are dimmed. Press {{lock.combo}} again (or click the badge) to edit.

### Checking your pages

- **Format Doctor** (status bar) finds elements that are probably tagged wrong, such as a scene heading or a character cue typed as Action, dialogue with no character above it, or empty elements, and fixes each in one click (or all at once).
- **Density** (status bar) flags Action paragraphs that run past {{density.lines}} lines, or that are walls of text. Click it to highlight them, then step through each one with ‹ ›, or open the list with ▴.
- **Hover a character cue** to see that character's bio card. Click **Edit in Bios →** to open their bio.

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

The **Dialogue** tab ({{key:Alt+T}}) gathers every line one character speaks, in script order, with its scene and page. Pick a character at the top. You can edit lines right there (changes go straight into the script), filter the lines, show the line before each speech for context (**Cue context**), and jump to any line in the script with **Go ↗**. Picking a character also highlights their speeches in the script.

## Scene Board & Pacing

The **Scene Board** (formerly the Beat Board; **Board** or **Split** view) lays the story out as index cards in act columns.

### Acts and cards

- Switch between **3 Acts** ({{board.columns.3}}, with a Midpoint divider in Act 2) and **4 Acts** ({{board.columns.4}}). Switching never moves or loses a card. It's the same setting as the act switch in Notes, so it also splits or joins Act II of the Synopsis and Treatment (see Synopsis & Treatment).
- Each card has a headline, a synopsis and colour tags: {{board.tags}}. Click a tag in the legend to show only those cards.
- **+ Add Card** adds a card to a column. Drag cards by their grip to reorder them or move them between acts.

### Linking cards to scenes

**Populate from Script** fills the board from your script, one card per scene, linked to that scene:

- **Auto-Distribute (% Targets)** places scenes by page: about {{board.targets.3}} for 3 acts, or {{board.targets.4}} for 4 acts.
- **Manual Scene Ranges…** lets you say which scenes belong to each act (for example 1–12, 13–40, 41–55).

Moving a linked card also moves its scene in the script (one undo step).

### Pacing distribution

Once cards are linked to scenes, each act column shows how many pages its scenes add up to and what share of the script that is, for example "24 pgs · 25%". A coloured status dot appears when an act runs more than {{board.tolerance}} points above or below its usual share (3 acts: {{board.targets.3}}; 4 acts: {{board.targets.4}}). Hover the badge for details.

### Outline export

**Export → Scene outline** downloads the board as a **Fountain outline** or **Markdown**.

## Export & Deliverables

### Formats

- **.draftline**: DraftLine's own format, holding the complete project. Use **Backup Project**, or link a folder (above), to keep and move scripts with nothing lost.
- **.fountain**: plain-text screenplay format, readable by Highland, Slugline, WriteSolo, Fade In and many others.
- **.fdx**: Final Draft's format, for sending to Final Draft users and productions.
- **Scene outline**: a Fountain outline or Markdown, from the Scene Board.

### Opening and importing

- **Open** reads \`.fountain\`, \`.fdx\`, \`.txt\` and \`.draftline\` files. Each opens as a new script; your others stay in Projects.
- **Import** takes a script copied from Google Docs, Word, a PDF or plain text, detects its elements, and shows a preview before anything changes. **Join wrapped lines** repairs lines broken by a PDF. You can add the import after your current script instead of starting a new one.

### Printing and PDF

**Export → Print Script / PDF** ({{key:Ctrl+P}}) prints exactly what the editor shows: Courier Prime 12 pt, standard margins and the same page breaks. The title page prints first, unnumbered, and page numbers start on page 2. Choose **Save as PDF** in the print dialog for a PDF. Margin notes, highlights and the Midnight page colour never print.

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

Press {{curiosities.noirCombo}} or select **{{curiosities.noirGenre}}** under Story DNA → Genre to transform the workspace into 1940s monochrome complete with blind shadows, vintage grading, and ambient rain audio. Press \`Esc\` to exit.
`,A=[`Esc`,`Enter`,`Tab`];function j(e,t={},{shortcuts:n=null}={}){let r=[];return{text:String(e||``).replace(/\{\{\s*([^{}]+?)\s*\}\}/g,(e,i)=>{if(i.startsWith(`key:`)){let e=i.slice(4).trim();return n&&!n[e]&&!A.includes(e)&&r.push(i),`\`${e}\``}return Object.prototype.hasOwnProperty.call(t,i)?t[i]:(r.push(i),e)}),missing:r}}var M=e=>String(e||``).normalize(`NFD`).replace(/\p{M}/gu,``).toLowerCase(),N=e=>M(e).replace(/[^a-z0-9]+/g,`-`).replace(/^-+|-+$/g,``);function P(e){let t=[],n=/`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*?)\*/g,r=0,i;for(;i=n.exec(e);)i.index>r&&t.push({t:`text`,v:e.slice(r,i.index)}),i[1]==null?i[2]==null?t.push({t:`i`,v:i[3]}):t.push({t:`b`,v:i[2]}):t.push({t:`code`,v:i[1]}),r=n.lastIndex;return r<e.length&&t.push({t:`text`,v:e.slice(r)}),t}var F=e=>P(e).map(e=>e.v).join(``);function I(e){let t=[],n=[],r=null,i=()=>{n.length&&t.push({type:`p`,text:n.join(` `)}),n=[],r&&t.push(r),r=null};for(let t of e){let e=t.trim(),a;e?(a=/^[-*]\s+(.*)$/.exec(e))?((n.length||r?.type!==`ul`)&&i(),r??={type:`ul`,items:[]},r.items.push(a[1])):(a=/^(\d+)[.)]\s+(.*)$/.exec(e))?((n.length||r?.type!==`ol`)&&i(),r??={type:`ol`,start:Number(a[1]),items:[]},r.items.push(a[2])):r?r.items[r.items.length-1]+=` ${e}`:n.push(e):i()}return i(),t}function L(e){let t=String(e||``).replace(/\r\n?/g,`
`).split(`
`),n=``,r=[],i=[],a=r,o=null,s=new Set,c=e=>{let t=N(e)||`section`;for(let n=2;s.has(t);n+=1)t=`${N(e)}-${n}`;return s.add(t),t},l=()=>{a.target&&(a.target.blocks=I(a))};for(let e of t){let t=/^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(e);if(!t){a.push(e);continue}let s=t[1].length,u=t[2].trim();if(l(),s===1)n=u,a=r;else if(s===2)o={id:c(u),title:u,blocks:[],topics:[]},i.push(o),a=[],a.target=o;else{let e={id:c(u),title:u,blocks:[]};o||(o={id:c(`General`),title:`General`,blocks:[],topics:[]},i.push(o)),o.topics.push(e),a=[],a.target=e}}return l(),{title:n,intro:I(r.target?[]:r),chapters:i}}var R=e=>e.type===`p`?F(e.text):e.items.map(F).join(` `);function z(e,t){let n=M(t).split(/\s+/).filter(Boolean);if(!n.length)return{chapters:e.chapters,count:null};let r=e=>n.every(t=>e.includes(t)),i=0,a=[];for(let t of e.chapters){let e=M(`${t.title} ${t.blocks.map(R).join(` `)}`),n=M(t.title),o=t.topics.filter(e=>r(M(`${n} ${e.title} ${e.blocks.map(R).join(` `)}`))),s=t.blocks.length>0&&r(e);(o.length||s)&&(i+=o.length+ +!!s,a.push({...t,blocks:s?t.blocks:[],topics:o}))}return{chapters:a,count:i}}function B(e,t){let n=M(t).split(/\s+/).filter(Boolean);if(!n.length||!e)return[{v:e,hit:!1}];let r=[...e],i=r.map(e=>M(e)),a=i.join(``),o=[];i.forEach((e,t)=>{for(let n=0;n<e.length;n+=1)o.push(t)});let s=Array(r.length).fill(!1);for(let e of n){let t=a.indexOf(e);for(;t>=0;){for(let n=t;n<t+e.length;n+=1)s[o[n]]=!0;t=a.indexOf(e,t+e.length)}}let c=[];return r.forEach((e,t)=>{let n=c[c.length-1];n&&n.hit===s[t]?n.v+=e:c.push({v:e,hit:s[t]})}),c}var V=e=>String(e).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`),H=e=>P(e).map(({t:e,v:t})=>e===`b`?`<strong>${V(t)}</strong>`:e===`i`?`<em>${V(t)}</em>`:e===`code`?`<code>${V(t)}</code>`:V(t)).join(``),U=e=>e.map(e=>e.type===`p`?`<p>${H(e.text)}</p>`:`<${e.type}${e.type===`ol`&&e.start!==1?` start="${e.start}"`:``}>${e.items.map(e=>`<li>${H(e)}</li>`).join(``)}</${e.type}>`).join(`
`),W=`DraftLine - User Guide`;function G(e,{version:t=``,title:n=W}={}){let r=[`<h1>${V(e.title)}</h1>`,t?`<p class="ver">DraftLine ${V(t)}</p>`:``,U(e.intro),`<nav><ol>${e.chapters.map(e=>`<li>${V(e.title)}</li>`).join(``)}</ol></nav>`,...e.chapters.map(e=>[`<h2>${V(e.title)}</h2>`,U(e.blocks),...e.topics.map(e=>`<h3>${V(e.title)}</h3>\n${U(e.blocks)}`)].join(`
`))].join(`
`);return`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${V(n)}</title>
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
</body></html>`}var K={acts:{structures:y,default:4,cards:[`Synopsis`,a.label],labels:Object.fromEntries(y.map(e=>[e,i(`synopsis`,e,null).map(e=>e.label)])),treatmentHeadings:Object.fromEntries(y.map(e=>[e,i(`treatment`,e,null).map(d)]))},notes:{sections:m,fixedCardsAfter:h},board:{structures:b,tags:_,pacingTargets:ee,pacingTolerance:7},characters:{primaryRoles:r,secondaryRoles:T.filter(e=>e.id!==`none`),fields:E},dna:{questions:l,conflictTypes:n,plotDevices:f,defaultDevices:S},glossary:{sections:C},shortcuts:p,elements:c,canvasThemes:ie,density:{lineLimit:4},lock:{combo:g},sync:{snapshotDir:w},colors:{accent:`#c8553d`,text:`#e9e7e2`,muted:`#9a9890`,"tag-plot":`#c8553d`,"tag-subplot":`#3d7cc8`,"tag-character":`#3f9a6b`,"tag-theme":`#8a5cc8`},curiosities:{stamp:{text:D,angle:-18},defaultAuthor:oe,milestones:x,wordGoal:500,lateNight:re,pages:v,noir:{combo:ae,genre:u.find(te)}}},q=e=>`**${e}**`,J=(e,t=`and`)=>e.length<=1?e.join(``):`${e.slice(0,-1).join(`, `)} ${t} ${e[e.length-1]}`,se=e=>[`I`,`II`,`III`,`IV`][e-1];function ce(e=K){let t={},n=e.acts;t[`acts.structures`]=J(n.structures.map(e=>`${e} acts`),`or`),t[`acts.cards`]=J(n.cards.map(q));for(let r of n.structures)t[`acts.labels.${r}`]=n.labels[r].join(`, `),t[`acts.short.${r}`]=n.labels[r].map(e=>e.split(`:`)[0]).join(`, `),t[`acts.headings.${r}`]=n.treatmentHeadings[r].map(e=>`\`### ${e}\``).join(`, `),t[`board.columns.${r}`]=e.board.structures[r].map(e=>e.label).join(` · `),t[`board.targets.${r}`]=`${e.board.pacingTargets[r].join(` / `)}%`;t[`acts.importExamples`]=`${n.structures.includes(3)?"`### ACT I: SETUP`, `### ACT II`":``}${n.structures.includes(4)?", `### ACT 1`, `### ACT 2A`, `### ACT 2B`, `### ACT 3`":``}`,t[`acts.default`]=`${n.default} acts`,t[`notes.sections`]=J(e.notes.sections.map(q)),t[`notes.fixedAfter`]=e.notes.fixedCardsAfter,t[`board.tags`]=J(e.board.tags.map(e=>q(e.label))),t[`board.tolerance`]=String(e.board.pacingTolerance),t[`roles.primary`]=J(e.characters.primaryRoles.map(e=>e.label),`or`),t[`roles.secondary`]=J(e.characters.secondaryRoles.map(e=>e.label),`or`),t[`bio.fields`]=e.characters.fields.map(e=>`- ${q(e.label)}`).join(`
`),t[`dna.count`]={8:`eight`}[e.dna.questions.length]||String(e.dna.questions.length),t[`dna.questions`]=e.dna.questions.map((e,t)=>`${t+1}. ${q(e.label)}: ${e.question.replace(/’/g,`'`)}`).join(`
`),t[`dna.conflictTypes`]=J(e.dna.conflictTypes.map(e=>e.replace(/^Individual vs\. /,``)),`or`),t[`dna.defaultDevices`]=J(e.dna.defaultDevices.map(t=>e.dna.plotDevices.find(e=>e.id===t)?.label)),t[`dna.optionalDevices`]=J(e.dna.plotDevices.filter(t=>!e.dna.defaultDevices.includes(t.id)).map(e=>e.label)),t[`glossary.sections`]=J(e.glossary.sections.map(e=>q(e.label))),t[`density.lines`]={4:`four`}[e.density.lineLimit]||String(e.density.lineLimit),t[`lock.combo`]=`\`${e.lock.combo}\``,t[`sync.snapshotDir`]=e.sync.snapshotDir,t.themes=e.canvasThemes.map(e=>`${q(e.label)} (${e.hint.charAt(0).toLowerCase()}${e.hint.slice(1)})`).join(` or `);for(let n of e.elements)t[`element.${n.type}`]=`${q(n.label)} (\`${n.combo}\`)`;t[`element.dual`]=`\`${s.combo}\``;let r=e.curiosities;t[`curiosities.stampText`]=`“${r.stamp.text}”`,t[`curiosities.stampAngle`]=`${r.stamp.angle}°`,t[`curiosities.defaultAuthor`]=r.defaultAuthor,t[`curiosities.wordGoal`]=String(r.wordGoal);let i=e=>e===0?`midnight`:`${e}:00 AM`;t[`curiosities.lateNight`]=`${i(r.lateNight[0])} and ${i(r.lateNight[1])}`;for(let[e,n]of r.pages)t[`curiosities.${e}`]=String(n);let a=e=>/^[“"]/.test(e)?e:`“${e}”`;for(let[e,n]of Object.entries(r.milestones))t[`milestones.${e}`]=a(n);return t[`curiosities.noirCombo`]=`\`${r.noir.combo}\``,t[`curiosities.noirGenre`]=r.noir.genre,t[`acts.roman`]=n.structures.includes(3)?[1,2,3].map(e=>`Act ${se(e)}`).join(`, `):``,t}var le=ce();function ue({topWindow:e,frameWindow:t,title:n,onDone:r}){let i=e.document,a=i.title;i.title=n,t?.document&&(t.document.title=n);let o=!1,s=[e,t].filter(Boolean),c=s.map(e=>e.document).filter(Boolean),l=()=>{if(!o){o=!0;for(let e of s)e.removeEventListener(`afterprint`,l);for(let e of c)e.removeEventListener(`pointerdown`,u,!0),e.removeEventListener(`keydown`,u,!0);i.title===n&&(i.title=a),r?.()}},u=()=>l();for(let e of s)e.addEventListener(`afterprint`,l);return{restore:l,armFallback:()=>{if(!o)for(let e of c)e.addEventListener(`pointerdown`,u,!0),e.addEventListener(`keydown`,u,!0)},saved:a}}function Y({openWindow:e,html:t,title:n,features:r=`width=800,height=900`}){let i=null;try{i=e(``,`_blank`,r)}catch{i=null}if(!i||!i.document)return null;let a=i.document;a.open(),a.write(t),a.close(),a.title=n;let o=!1;i.onafterprint=()=>{if(!o){o=!0;try{i.close()}catch{}}};let s=!1,c=()=>{s||(s=!0,i.focus(),i.print())};return a.readyState===`complete`?setTimeout(c,50):(i.addEventListener?.(`load`,()=>setTimeout(c,50),{once:!0}),setTimeout(c,1500)),i}var X=e(),Z=L(j(k,le,{shortcuts:p}).text);function Q({text:e,query:t}){return P(e).map((e,n)=>{let r=B(e.v,t).map((e,t)=>e.hit?(0,X.jsx)(`mark`,{children:e.v},t):e.v);return e.t===`b`?(0,X.jsx)(`strong`,{children:r},n):e.t===`i`?(0,X.jsx)(`em`,{children:r},n):e.t===`code`?(0,X.jsx)(`kbd`,{children:r},n):(0,X.jsx)(`span`,{children:r},n)})}function $({blocks:e,query:t}){return e.map((e,n)=>{if(e.type===`p`)return(0,X.jsx)(`p`,{children:(0,X.jsx)(Q,{text:e.text,query:t})},n);let r=e.type;return(0,X.jsx)(r,{start:e.type===`ol`&&e.start!==1?e.start:void 0,children:e.items.map((e,n)=>(0,X.jsx)(`li`,{children:(0,X.jsx)(Q,{text:e,query:t})},n))},n)})}function de(e){let t=G(Z,{version:ne.version,title:W});Y({openWindow:(...e)=>window.open(...e),html:t,title:`DraftLine - User Guide`})||fe(t,e)}function fe(e,t){let n=document.createElement(`iframe`);n.setAttribute(`aria-hidden`,`true`),n.style.cssText=`position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden`,n.srcdoc=e,n.onload=()=>{let e=ue({topWindow:window,frameWindow:n.contentWindow,title:W,onDone:()=>{t?.focus(),setTimeout(()=>n.remove(),500)}});n.contentWindow.focus(),n.contentWindow.print(),e.armFallback()},document.body.appendChild(n)}function pe({onClose:e}){let t=(0,O.useRef)(null),n=(0,O.useRef)(null),r=(0,O.useRef)(null),[i,a]=(0,O.useState)(``),[s,c]=(0,O.useState)(!1),l=(0,O.useMemo)(()=>z(Z,i),[i]),u=l.count!=null;(0,O.useEffect)(()=>{let e=t.current;e&&!e.open&&e.showModal(),r.current?.focus()},[]);let d=e=>{n.current?.querySelector(`#ug-${CSS.escape(e)}`)?.scrollIntoView({block:`start`,behavior:`smooth`})};return(0,X.jsxs)(`dialog`,{ref:t,className:`hm-modal ug-modal${s?` is-expanded`:``}`,"aria-labelledby":`ug-title`,onCancel:t=>{t.preventDefault(),i?a(``):s?c(!1):e()},onMouseDown:n=>{n.target===t.current&&e()},children:[(0,X.jsxs)(`header`,{className:`hm-head ug-head`,children:[(0,X.jsx)(`h2`,{id:`ug-title`,children:`User Guide`}),(0,X.jsx)(`input`,{ref:r,className:`ug-search`,type:`search`,value:i,onChange:e=>{a(e.target.value),n.current?.scrollTo({top:0})},placeholder:`Search the guide…`,"aria-label":`Search the User Guide`}),(0,X.jsxs)(`div`,{className:`ug-actions`,children:[(0,X.jsx)(`button`,{type:`button`,className:`btn`,onClick:e=>de(e.currentTarget),title:`Print the whole guide, or choose Save as PDF`,children:`Print / Save PDF`}),(0,X.jsx)(o,{expanded:s,onToggle:()=>c(e=>!e)}),(0,X.jsx)(`button`,{type:`button`,className:`btn`,onClick:e,children:`Close`})]})]}),(0,X.jsxs)(`div`,{className:`ug-main`,children:[(0,X.jsxs)(`nav`,{className:`ug-toc`,"aria-label":`Contents`,children:[(0,X.jsx)(`div`,{className:`micro-label`,children:`Contents`}),(0,X.jsx)(`ol`,{children:Z.chapters.map(e=>{let t=l.chapters.some(t=>t.id===e.id);return(0,X.jsxs)(`li`,{children:[(0,X.jsx)(`button`,{type:`button`,className:`ug-toc-ch${u&&!t?` is-dim`:``}`,onClick:()=>d(e.id),disabled:u&&!t,children:e.title}),s&&!u&&(0,X.jsx)(`ol`,{children:e.topics.map(e=>(0,X.jsx)(`li`,{children:(0,X.jsx)(`button`,{type:`button`,className:`ug-toc-topic`,onClick:()=>d(e.id),children:e.title})},e.id))})]},e.id)})})]}),(0,X.jsxs)(`article`,{className:`ug-body`,ref:n,"aria-live":`polite`,children:[u?(0,X.jsx)(`p`,{className:`ug-count`,children:l.count?`${l.count} ${l.count===1?`topic matches`:`topics match`} “${i.trim()}”`:`Nothing in the guide matches “${i.trim()}”.`}):(0,X.jsxs)(X.Fragment,{children:[(0,X.jsx)(`h1`,{className:`ug-title`,children:Z.title}),(0,X.jsx)($,{blocks:Z.intro,query:``})]}),l.chapters.map(e=>(0,X.jsxs)(`section`,{className:`ug-chapter`,"aria-labelledby":`ug-${e.id}`,children:[(0,X.jsx)(`h2`,{id:`ug-${e.id}`,children:(0,X.jsx)(Q,{text:e.title,query:i})}),(0,X.jsx)($,{blocks:e.blocks,query:i}),e.topics.map(e=>(0,X.jsxs)(`section`,{className:`ug-topic`,"aria-labelledby":`ug-${e.id}`,children:[(0,X.jsx)(`h3`,{id:`ug-${e.id}`,children:(0,X.jsx)(Q,{text:e.title,query:i})}),(0,X.jsx)($,{blocks:e.blocks,query:i})]},e.id))]},e.id))]})]})]})}export{pe as default};