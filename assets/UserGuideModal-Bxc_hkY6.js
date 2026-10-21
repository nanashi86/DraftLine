import{i as e,n as t,r as n,t as r}from"./index-CeZxMM24.js";var i=e(),a=`# DraftLine User Guide

DraftLine is a distraction-free screenwriting app that runs in your browser. It writes in Courier Prime at 12 pt with standard screenplay margins, saves as you type, and works offline. This guide covers everything from your first scene heading to the final PDF.

Press \`F1\` at any time to open this guide. \`Ctrl+/\` shows every keyboard shortcut. On a Mac, read \`Ctrl\` as \`⌘\` and \`Alt\` as \`⌥\`.

## Workspace & Storage

### The workspace

The top bar holds your script's title, file actions (New, Open, Import, Title Page), the Element picker, the B / I / U / S formatting buttons, the view switch (**Page**, **Split**, **Board**) and the Export menu. Story Bible and Characters open as panels on the right. The status bar at the bottom shows the current element, where your work is saved, scene and word counts, page count, page colour, undo / redo and zoom.

- **Page** shows the script. **Split** shows the script beside the Scene Board. **Board** shows the Scene Board alone. \`Alt+B\` cycles through them.
- **Focus** hides everything but the page. Press \`Esc\` to come back.
- The **Scenes** sidebar (\`Alt+S\`) lists every scene with its length in eighths of a page. Click one to jump to it, or type to find a scene.
- Narrow windows tuck File actions into a **File ▾** menu, and panels you can't see on the bar move into the **⋮** menu.

### Projects and browser storage

Every script lives in your **Projects** library (\`Alt+P\`, or the ▾ beside the title). From there you can create, switch, rename, duplicate, export or delete scripts.

By default, scripts are saved in this browser's own database (IndexedDB) on this computer. Saving is automatic, about half a second after you stop typing. \`Ctrl+S\` saves immediately. Nothing is uploaded and no account is needed.

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
- **Deleting a script** in DraftLine also deletes its file in the linked folder, so it doesn't come back.
- **Two computers, one script:** the most recent save wins. DraftLine doesn't merge edits made on two computers at the same time.

Safari, Firefox and phone browsers can't link folders. There, DraftLine uses browser storage only; use backups to move scripts.

### Snapshots

A snapshot is a named checkpoint of the whole project: script, title page, Scene Board and Story Bible.

- Click the camera button (**Snapshot**) in the top bar, give it a label (or keep the date and time), and save.
- **⋮ → View Snapshots** lists them, newest first. **Restore** puts a snapshot back. It offers to snapshot your current draft first (on by default), and \`Ctrl+Z\` undoes the restore.
- Snapshots are saved with the script and included in backups.
- With Folder Sync on, each snapshot is also written to \`Snapshots/Your-Title_YYYY-MM-DD_HHmm.draftline\` inside the linked folder. Snapshots found only in that folder (from another computer, for example) show **In folder** and can be restored like any other.

### Backups

**Export → Backup Project (.draftline)** downloads one file holding everything the project is: script, formatting, margin notes, title page, Scene Board, Story Bible, characters and snapshots. Open it with **Open** on any computer to restore it exactly. A restored backup never overwrites an existing script; if the same script is already there, the backup comes in beside it.

About DraftLine (**⋮ → About DraftLine**) has a **Backup Project** button too, and shows where your scripts are stored.

## Screenplay Editor

### Elements

A screenplay is made of elements, each with its own margins:

- **Scene Heading** (\`Alt+1\`): INT. / EXT., location and time of day.
- **Format Cue** (\`Alt+2\`): MONTAGE, SERIES OF SHOTS, INTERCUT and their END cues.
- **Action** (\`Alt+3\`): what we see and hear.
- **Character** (\`Alt+4\`): the name above a speech.
- **Parenthetical** (\`Alt+5\`): (beat), (whispering), and so on.
- **Dialogue** (\`Alt+6\`): what the character says.
- **Transition** (\`Alt+7\`): CUT TO:, DISSOLVE TO:.
- **Centered** (\`Alt+8\`): centred text such as THE END.

The Element picker in the top bar shows the current element and changes it. \`Alt+D\` makes a speech **dual dialogue**, side by side with the one before it.

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
- On an empty line, Tab cycles Action → Character → Transition → Scene Heading → Action. \`Shift+Tab\` goes backwards.
- Pressing Enter on an empty Character, Dialogue or Parenthetical line steps back out to Action.
- Typing \`(\` at the start of an empty Dialogue line turns it into a Parenthetical.
- \`Shift+Enter\` adds a line break inside Action or Dialogue.

The status bar always shows what Enter and Tab will do next.

### Autocomplete

Scene Headings suggest INT. / EXT., locations you've used and times of day. Character cues suggest names already in the script. Use ↑ ↓ to pick, then Enter or Tab to accept. \`Esc\` dismisses the list.

### Formatting

Select text and press \`Ctrl+B\` (bold), \`Ctrl+I\` (italic), \`Ctrl+U\` (underline) or \`Ctrl+Shift+X\` (strikethrough). With nothing selected, formatting applies to the word at the cursor. \`Ctrl+\\\` clears formatting. The toolbar's **B I U S** buttons do the same.

### Title page

**Title Page** in the top bar edits the title, credit, author, source material, draft version and date, and contact details, plus the title's font, size and weight. The title page shows above page 1 and prints first.

### Margin notes

\`Alt+N\` opens a private margin note for the current line. Selected words are quoted into the note. Notes open in the Notes drawer (**⋮ → Margin Notes**) and are never printed or exported.

### View Only lock

\`Ctrl+Alt+L\`, or the **Edit** badge in the status bar, locks the script. While it shows **View Only** you can read, scroll, select and copy, and character bio cards still appear, but nothing can be typed, deleted, formatted or undone. The Element picker and B / I / U / S are dimmed. Press \`Ctrl+Alt+L\` again (or click the badge) to edit.

### Checking your pages

- **Format Doctor** (status bar) finds elements that are probably tagged wrong, such as a scene heading or a character cue typed as Action, dialogue with no character above it, or empty elements, and fixes each in one click (or all at once).
- **Density** (status bar) flags Action paragraphs that run past four lines, or that are walls of text. Click it to highlight them, then step through each one with ‹ ›, or open the list with ▴.
- **Hover a character cue** to see that character's bio card. Click **Edit in Bios →** to open their bio.

### Page colour and zoom

The status bar switches the page between **Paper** (ivory, black ink) and **Midnight** (a dark page with light ink, on screen only; printing stays black on white). The zoom controls sit at the far right. The page shrinks to fit when panels are open.

## Story Bible

The Story Bible (\`Alt+I\`) keeps everything about the story that isn't the script. It's saved with the project and switches with it in Projects. The ⤢ button in the panel's header expands it to the full window; \`Esc\` collapses it again.

### DNA: Blueprint

The **Blueprint** walks through the spine of the story in eight questions:

1. **Protagonist**: Who is it about?
2. **Inciting Incident**: What happens that starts the story?
3. **Goal / Desire**: What do they want?
4. **Flaw**: What must they overcome to get it?
5. **Conflict / Debate**: Why can't they get it? (with the conflict type: Individual vs. Individual, Nature, Society, Technology, Supernatural or Self)
6. **Rising Action**: What did they do about it?
7. **Climax**: Why doesn't that work?
8. **Falling Action**: How does it end?

It also records genre, theme and **Plot Devices**. Foreshadowing and Flashback are always listed. You can add Deus ex machina, MacGuffin, Quest, Cliffhanger, Red herring and Love triangle, each with Yes / No and notes. The ⓘ beside any term shows its definition.

### DNA: Glossary

The **Glossary** defines every story term in two sections, **Character Roles** and **Narrative & Dramatic Craft**. Search filters both at once. Definitions marked **starter** are DraftLine's; click **Edit** to paste your own reference's wording. Your wording is kept for all your projects, and **Reset to starter text** brings the original back.

### Notes

**Notes** holds free-form cards: **Logline**, **Tone**, **Timeline**, **Pitch** and a **Scratchpad**. Rename, remove or add your own sections. Every card has **Edit** / **Done** and saves as you type. Cards accept Markdown: headings, lists, quotes, **bold** and *italic*.

### Synopsis & Treatment

- **Synopsis**: three acts (Act I: Setup, Act II: Confrontation, Act III: Resolution), right after Pitch.
- **Treatment**: right below the Synopsis, the same three acts at full length, for your narrative treatment: sequence-by-sequence prose, scene breakdowns and subplots. Write each act there, or paste it in with Import from Notes.

### Copying and importing notes

- **Copy as Markdown** copies every note, in order, ready to paste into a document.
- **Import from Notes** pastes text from Docs, Word, Notion or Apple Notes into a section (or straight into one act of the Treatment), appended or replacing what's there. **Split by headings** turns each heading into a section. Under a \`## Treatment\` or \`## Synopsis\` heading, act headings such as \`### ACT I: SETUP\` fill that act, and any other sub-headings stay inside the act they follow, so Copy as Markdown output imports straight back.

## Characters

Characters (\`Alt+C\`) has two tabs, **Bios** and **Dialogue**.

### Bios

Each bio has:

- **Name**
- **Primary Role**: Protagonist, Antagonist, Deuteragonist, Tritagonist, Supporting or Minor / Cameo.
- **Secondary Function**: an archetype such as Foil, Catalyst, Mentor / Guide, Confidant(e), Love Interest, Skeptic / Voice of Reason, Henchman / Enforcer, Threshold Guardian or Shadow / Mirror.
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

The **Dialogue** tab (\`Alt+T\`) gathers every line one character speaks, in script order, with its scene and page. Pick a character at the top. You can edit lines right there (changes go straight into the script), filter the lines, show the line before each speech for context (**Cue context**), and jump to any line in the script with **Go ↗**. Picking a character also highlights their speeches in the script.

## Scene Board & Pacing

The **Scene Board** (formerly the Beat Board; **Board** or **Split** view) lays the story out as index cards in act columns.

### Acts and cards

- Switch between **3 Acts** (Act 1 · Act 2 with a Midpoint divider · Act 3) and **4 Acts** (Act 1 · Act 2A · Act 2B · Act 3). Switching never moves or loses a card.
- Each card has a headline, a synopsis and colour tags: **Plot**, **Subplot**, **Character** and **Theme**. Click a tag in the legend to show only those cards.
- **+ Add Card** adds a card to a column. Drag cards by their grip to reorder them or move them between acts.

### Linking cards to scenes

**Populate from Script** fills the board from your script, one card per scene, linked to that scene:

- **Auto-Distribute (% Targets)** places scenes by page: about 25 / 50 / 25% for 3 acts, or 25% each for 4 acts.
- **Manual Scene Ranges…** lets you say which scenes belong to each act (for example 1–12, 13–40, 41–55).

Moving a linked card also moves its scene in the script (one undo step).

### Pacing distribution

Once cards are linked to scenes, each act column shows how many pages its scenes add up to and what share of the script that is, for example "24 pgs · 25%". A coloured status dot appears when an act runs more than 7 points above or below its usual share (3 acts: 25 / 50 / 25%; 4 acts: 25% each). Hover the badge for details.

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

**Export → Print Script / PDF** (\`Ctrl+P\`) prints exactly what the editor shows: Courier Prime 12 pt, standard margins and the same page breaks. The title page prints first, unnumbered, and page numbers start on page 2. Choose **Save as PDF** in the print dialog for a PDF. Margin notes, highlights and the Midnight page colour never print.
`,o=e=>String(e||``).normalize(`NFD`).replace(/\p{M}/gu,``).toLowerCase(),s=e=>o(e).replace(/[^a-z0-9]+/g,`-`).replace(/^-+|-+$/g,``);function c(e){let t=[],n=/`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*?)\*/g,r=0,i;for(;i=n.exec(e);)i.index>r&&t.push({t:`text`,v:e.slice(r,i.index)}),i[1]==null?i[2]==null?t.push({t:`i`,v:i[3]}):t.push({t:`b`,v:i[2]}):t.push({t:`code`,v:i[1]}),r=n.lastIndex;return r<e.length&&t.push({t:`text`,v:e.slice(r)}),t}var l=e=>c(e).map(e=>e.v).join(``);function u(e){let t=[],n=[],r=null,i=()=>{n.length&&t.push({type:`p`,text:n.join(` `)}),n=[],r&&t.push(r),r=null};for(let t of e){let e=t.trim(),a;e?(a=/^[-*]\s+(.*)$/.exec(e))?((n.length||r?.type!==`ul`)&&i(),r??={type:`ul`,items:[]},r.items.push(a[1])):(a=/^(\d+)[.)]\s+(.*)$/.exec(e))?((n.length||r?.type!==`ol`)&&i(),r??={type:`ol`,start:Number(a[1]),items:[]},r.items.push(a[2])):r?r.items[r.items.length-1]+=` ${e}`:n.push(e):i()}return i(),t}function d(e){let t=String(e||``).replace(/\r\n?/g,`
`).split(`
`),n=``,r=[],i=[],a=r,o=null,c=new Set,l=e=>{let t=s(e)||`section`;for(let n=2;c.has(t);n+=1)t=`${s(e)}-${n}`;return c.add(t),t},d=()=>{a.target&&(a.target.blocks=u(a))};for(let e of t){let t=/^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(e);if(!t){a.push(e);continue}let s=t[1].length,c=t[2].trim();if(d(),s===1)n=c,a=r;else if(s===2)o={id:l(c),title:c,blocks:[],topics:[]},i.push(o),a=[],a.target=o;else{let e={id:l(c),title:c,blocks:[]};o||(o={id:l(`General`),title:`General`,blocks:[],topics:[]},i.push(o)),o.topics.push(e),a=[],a.target=e}}return d(),{title:n,intro:u(r.target?[]:r),chapters:i}}var f=e=>e.type===`p`?l(e.text):e.items.map(l).join(` `);function p(e,t){let n=o(t).split(/\s+/).filter(Boolean);if(!n.length)return{chapters:e.chapters,count:null};let r=e=>n.every(t=>e.includes(t)),i=0,a=[];for(let t of e.chapters){let e=o(`${t.title} ${t.blocks.map(f).join(` `)}`),n=o(t.title),s=t.topics.filter(e=>r(o(`${n} ${e.title} ${e.blocks.map(f).join(` `)}`))),c=t.blocks.length>0&&r(e);(s.length||c)&&(i+=s.length+ +!!c,a.push({...t,blocks:c?t.blocks:[],topics:s}))}return{chapters:a,count:i}}function m(e,t){let n=o(t).split(/\s+/).filter(Boolean);if(!n.length||!e)return[{v:e,hit:!1}];let r=[...e],i=r.map(e=>o(e)),a=i.join(``),s=[];i.forEach((e,t)=>{for(let n=0;n<e.length;n+=1)s.push(t)});let c=Array(r.length).fill(!1);for(let e of n){let t=a.indexOf(e);for(;t>=0;){for(let n=t;n<t+e.length;n+=1)c[s[n]]=!0;t=a.indexOf(e,t+e.length)}}let l=[];return r.forEach((e,t)=>{let n=l[l.length-1];n&&n.hit===c[t]?n.v+=e:l.push({v:e,hit:c[t]})}),l}var h=e=>String(e).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`),g=e=>c(e).map(({t:e,v:t})=>e===`b`?`<strong>${h(t)}</strong>`:e===`i`?`<em>${h(t)}</em>`:e===`code`?`<code>${h(t)}</code>`:h(t)).join(``),_=e=>e.map(e=>e.type===`p`?`<p>${g(e.text)}</p>`:`<${e.type}${e.type===`ol`&&e.start!==1?` start="${e.start}"`:``}>${e.items.map(e=>`<li>${g(e)}</li>`).join(``)}</${e.type}>`).join(`
`),v=`DraftLine - User Guide`;function y(e,{version:t=``,title:n=v}={}){let r=[`<h1>${h(e.title)}</h1>`,t?`<p class="ver">DraftLine ${h(t)}</p>`:``,_(e.intro),`<nav><ol>${e.chapters.map(e=>`<li>${h(e.title)}</li>`).join(``)}</ol></nav>`,...e.chapters.map(e=>[`<h2>${h(e.title)}</h2>`,_(e.blocks),...e.topics.map(e=>`<h3>${h(e.title)}</h3>\n${_(e.blocks)}`)].join(`
`))].join(`
`);return`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${h(n)}</title>
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
</body></html>`}function b({topWindow:e,frameWindow:t,title:n,onDone:r}){let i=e.document,a=i.title;i.title=n,t?.document&&(t.document.title=n);let o=!1,s=[e,t].filter(Boolean),c=s.map(e=>e.document).filter(Boolean),l=()=>{if(!o){o=!0;for(let e of s)e.removeEventListener(`afterprint`,l);for(let e of c)e.removeEventListener(`pointerdown`,u,!0),e.removeEventListener(`keydown`,u,!0);i.title===n&&(i.title=a),r?.()}},u=()=>l();for(let e of s)e.addEventListener(`afterprint`,l);return{restore:l,armFallback:()=>{if(!o)for(let e of c)e.addEventListener(`pointerdown`,u,!0),e.addEventListener(`keydown`,u,!0)},saved:a}}function x({openWindow:e,html:t,title:n,features:r=`width=800,height=900`}){let i=null;try{i=e(``,`_blank`,r)}catch{i=null}if(!i||!i.document)return null;let a=i.document;a.open(),a.write(t),a.close(),a.title=n;let o=!1;i.onafterprint=()=>{if(!o){o=!0;try{i.close()}catch{}}};let s=!1,c=()=>{s||(s=!0,i.focus(),i.print())};return a.readyState===`complete`?setTimeout(c,50):(i.addEventListener?.(`load`,()=>setTimeout(c,50),{once:!0}),setTimeout(c,1500)),i}var S=n(),C=d(a);function w({text:e,query:t}){return c(e).map((e,n)=>{let r=m(e.v,t).map((e,t)=>e.hit?(0,S.jsx)(`mark`,{children:e.v},t):e.v);return e.t===`b`?(0,S.jsx)(`strong`,{children:r},n):e.t===`i`?(0,S.jsx)(`em`,{children:r},n):e.t===`code`?(0,S.jsx)(`kbd`,{children:r},n):(0,S.jsx)(`span`,{children:r},n)})}function T({blocks:e,query:t}){return e.map((e,n)=>{if(e.type===`p`)return(0,S.jsx)(`p`,{children:(0,S.jsx)(w,{text:e.text,query:t})},n);let r=e.type;return(0,S.jsx)(r,{start:e.type===`ol`&&e.start!==1?e.start:void 0,children:e.items.map((e,n)=>(0,S.jsx)(`li`,{children:(0,S.jsx)(w,{text:e,query:t})},n))},n)})}function E(e){let t=y(C,{version:r.version,title:v});x({openWindow:(...e)=>window.open(...e),html:t,title:`DraftLine - User Guide`})||D(t,e)}function D(e,t){let n=document.createElement(`iframe`);n.setAttribute(`aria-hidden`,`true`),n.style.cssText=`position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden`,n.srcdoc=e,n.onload=()=>{let e=b({topWindow:window,frameWindow:n.contentWindow,title:v,onDone:()=>{t?.focus(),setTimeout(()=>n.remove(),500)}});n.contentWindow.focus(),n.contentWindow.print(),e.armFallback()},document.body.appendChild(n)}function O({onClose:e}){let n=(0,i.useRef)(null),r=(0,i.useRef)(null),a=(0,i.useRef)(null),[o,s]=(0,i.useState)(``),[c,l]=(0,i.useState)(!1),u=(0,i.useMemo)(()=>p(C,o),[o]),d=u.count!=null;(0,i.useEffect)(()=>{let e=n.current;e&&!e.open&&e.showModal(),a.current?.focus()},[]);let f=e=>{r.current?.querySelector(`#ug-${CSS.escape(e)}`)?.scrollIntoView({block:`start`,behavior:`smooth`})};return(0,S.jsxs)(`dialog`,{ref:n,className:`hm-modal ug-modal${c?` is-expanded`:``}`,"aria-labelledby":`ug-title`,onCancel:t=>{t.preventDefault(),o?s(``):c?l(!1):e()},onMouseDown:t=>{t.target===n.current&&e()},children:[(0,S.jsxs)(`header`,{className:`hm-head ug-head`,children:[(0,S.jsx)(`h2`,{id:`ug-title`,children:`User Guide`}),(0,S.jsx)(`input`,{ref:a,className:`ug-search`,type:`search`,value:o,onChange:e=>{s(e.target.value),r.current?.scrollTo({top:0})},placeholder:`Search the guide…`,"aria-label":`Search the User Guide`}),(0,S.jsxs)(`div`,{className:`ug-actions`,children:[(0,S.jsx)(`button`,{type:`button`,className:`btn`,onClick:e=>E(e.currentTarget),title:`Print the whole guide, or choose Save as PDF`,children:`Print / Save PDF`}),(0,S.jsx)(t,{expanded:c,onToggle:()=>l(e=>!e)}),(0,S.jsx)(`button`,{type:`button`,className:`btn`,onClick:e,children:`Close`})]})]}),(0,S.jsxs)(`div`,{className:`ug-main`,children:[(0,S.jsxs)(`nav`,{className:`ug-toc`,"aria-label":`Contents`,children:[(0,S.jsx)(`div`,{className:`micro-label`,children:`Contents`}),(0,S.jsx)(`ol`,{children:C.chapters.map(e=>{let t=u.chapters.some(t=>t.id===e.id);return(0,S.jsxs)(`li`,{children:[(0,S.jsx)(`button`,{type:`button`,className:`ug-toc-ch${d&&!t?` is-dim`:``}`,onClick:()=>f(e.id),disabled:d&&!t,children:e.title}),c&&!d&&(0,S.jsx)(`ol`,{children:e.topics.map(e=>(0,S.jsx)(`li`,{children:(0,S.jsx)(`button`,{type:`button`,className:`ug-toc-topic`,onClick:()=>f(e.id),children:e.title})},e.id))})]},e.id)})})]}),(0,S.jsxs)(`article`,{className:`ug-body`,ref:r,"aria-live":`polite`,children:[d?(0,S.jsx)(`p`,{className:`ug-count`,children:u.count?`${u.count} ${u.count===1?`topic matches`:`topics match`} “${o.trim()}”`:`Nothing in the guide matches “${o.trim()}”.`}):(0,S.jsxs)(S.Fragment,{children:[(0,S.jsx)(`h1`,{className:`ug-title`,children:C.title}),(0,S.jsx)(T,{blocks:C.intro,query:``})]}),u.chapters.map(e=>(0,S.jsxs)(`section`,{className:`ug-chapter`,"aria-labelledby":`ug-${e.id}`,children:[(0,S.jsx)(`h2`,{id:`ug-${e.id}`,children:(0,S.jsx)(w,{text:e.title,query:o})}),(0,S.jsx)(T,{blocks:e.blocks,query:o}),e.topics.map(e=>(0,S.jsxs)(`section`,{className:`ug-topic`,"aria-labelledby":`ug-${e.id}`,children:[(0,S.jsx)(`h3`,{id:`ug-${e.id}`,children:(0,S.jsx)(w,{text:e.title,query:o})}),(0,S.jsx)(T,{blocks:e.blocks,query:o})]},e.id))]},e.id))]})]})]})}export{O as default};