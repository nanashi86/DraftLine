import{i as e,t}from"./react-DgawKyfb.js";import{Ct as n,St as r,dt as i,ft as a,ht as o,it as s,mt as c,ot as l,pt as u,yt as d}from"./index-Gkqd1VNm.js";import{n as f}from"./printTitle-C1qWomuv.js";var p=e(),m=[{id:`dna`,label:`Story DNA`,hint:`Genre, Theme, 8 Narrative Beats`},{id:`notes`,label:`Story Notes`,hint:`Synopsis & Multi-Act Treatment`},{id:`characters`,label:`Character Bios`,hint:`All characters with populated bios/descriptions`}],h=Object.fromEntries(m.map(e=>[e.id,!0])),g=`STORY BIBLE & PROJECT DOSSIER`,_=e=>/note/i.test(String(e||``))&&!/scratch\s*pad/i.test(String(e||``)),v=e=>typeof e==`string`?e.trim():``,y=e=>m.some(t=>e?.[t.id]),b=e=>`${v(e)||`Untitled`} - Story Bible`;function x(e){return v(e?.name)?!!u(e)||!!o(e.gender)||s.some(t=>t.key!==`name`&&v(e[t.key])):!1}function S(e){let t=r(e),i=t.genres.filter(e=>e!==`Other`);t.genres.includes(`Other`)&&v(t.genreOther)&&i.push(v(t.genreOther));let a=n(t).filter(e=>e.kind===`device`&&e.info).map(e=>({label:e.info.label,on:e.on===!0,notes:v(e.notes)})).filter(e=>e.on||e.notes);return{id:`dna`,heading:`Story DNA`,meta:[{label:`Genre`,value:i.join(` · `)},{label:`Theme`,value:v(t.theme)},{label:`Conflict`,value:v(t.conflictType)}].filter(e=>e.value),devices:a,beats:d.map((e,n)=>({n:n+1,label:e.label,question:e.question,text:v(t.answers[e.key])}))}}function C(e,t){let n=a(e),r=e=>e.trim().toLowerCase(),o=new Set(l.map(r)),s=e=>n.sections.find(t=>r(t.title)===r(e)),u=(e,n)=>i(e,t,n).map(t=>({key:t.key,label:e===`treatment`?c(t):t.label,text:v(n[t.key])}));return{id:`notes`,heading:`Story Notes`,logline:v(s(`Logline`)?.body),cards:l.slice(1).map(e=>({title:e,body:v(s(e)?.body)})).filter(e=>e.body),synopsis:u(`synopsis`,n.synopsis),treatment:u(`treatment`,n.treatment),others:n.sections.filter(e=>!o.has(r(e.title))&&_(e.title)&&v(e.body)).map(e=>({title:v(e.title),body:v(e.body)}))}}function w(e){return{id:`characters`,heading:`Character Bios`,characters:(Array.isArray(e)?e:[]).filter(x).map(e=>({name:v(e.name),role:u(e),age:v(e.age),gender:o(e.gender),relationship:v(e.relationship),fields:[{label:`Physical Description`,text:v(e.description)},{label:`Traits`,text:v(e.traits)},{label:`Backstory / Motivation & Arc`,text:v(e.backstory)}].filter(e=>e.text)}))}}function T({meta:e={},storyDna:t,storyNotes:n,characters:r,actMode:i=4}={},a=h){let o=v(e.title)||`Untitled`,s=[];return a?.dna&&s.push(S(t)),a?.notes&&s.push(C(n,i)),a?.characters&&s.push(w(r)),{title:o,author:v(e.author),label:g,docTitle:b(o),actMode:i,sections:s}}var E=e=>String(e??``).replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`})[e]),D=e=>E(e).replace(/\*\*(.+?)\*\*/g,`<strong>$1</strong>`).replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g,`$1<em>$2</em>`);function O(e){let t=[];for(let n of v(e).split(/\n[ \t]*\n+/)){let e=n.split(`
`);e.every(e=>/^\s*[-*•]\s+/.test(e))?t.push(`<ul>${e.map(e=>`<li>${D(e.replace(/^\s*[-*•]\s+/,``))}</li>`).join(``)}</ul>`):/^#{1,6}\s+/.test(e[0])?(t.push(`<h4>${D(e[0].replace(/^#{1,6}\s+/,``))}</h4>`),e.length>1&&t.push(`<p>${e.slice(1).map(D).join(`<br>`)}</p>`)):n.trim()&&t.push(`<p>${e.map(D).join(`<br>`)}</p>`)}return t.join(`
`)}var k=e=>`<p class="empty">${E(e)}</p>`;function A(e){return`${e.meta.length?`<dl class="meta">${e.meta.map(e=>`<div><dt>${E(e.label)}</dt><dd>${E(e.value)}</dd></div>`).join(``)}</dl>`:``}${e.devices.length?`<h3>Plot Devices</h3><ul class="devices">${e.devices.map(e=>`<li><strong>${E(e.label)}</strong>${e.notes?` — ${D(e.notes)}`:``}</li>`).join(``)}</ul>`:``}<h3>The Eight Narrative Beats</h3>${e.beats.map(e=>`
    <div class="beat">
      <div class="beat-label"><span class="beat-n">${e.n}</span>${E(e.label)}<span class="beat-q">${E(e.question)}</span></div>
      ${e.text?O(e.text):k(`Not answered yet.`)}
    </div>`).join(``)}`}function j(e,t){return t.some(e=>e.text)?`<h3>${E(e)}</h3>${t.map(e=>`
    <div class="act"><h4 class="act-h">${E(e.label)}</h4>${e.text?O(e.text):k(`Not written yet.`)}</div>`).join(``)}`:`<h3>${E(e)}</h3>${k(`Not written yet.`)}`}function M(e){let t=e.logline?`<div class="logline"><div class="kicker">Logline</div>${O(e.logline)}</div>`:``,n=e=>`<div class="note"><h3>${E(e.title)}</h3>${O(e.body)}</div>`;return`${t}${e.cards.map(n).join(``)}${j(`Synopsis`,e.synopsis)}<div class="break-soft"></div>${j(`Treatment`,e.treatment)}${e.others.map(n).join(``)}`}function N(e){return e.characters.length?e.characters.map(e=>{let t=[e.role,e.age&&`Age: ${e.age}`,e.gender].filter(Boolean).map(E).join(` · `);return`
    <div class="character">
      <h3 class="char-name">${E(e.name)}</h3>
      ${t?`<div class="char-sub">${t}</div>`:``}
      ${e.relationship?`<div class="char-rel">${D(e.relationship)}</div>`:``}
      ${e.fields.map(e=>`<div class="char-field"><div class="kicker">${E(e.label)}</div>${O(e.text)}</div>`).join(``)}
    </div>`}).join(``):k(`No character bios yet.`)}var P={dna:A,notes:M,characters:N},F=`
@page { size: letter portrait; margin: 0.85in 0.9in 0.9in; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; color: #1d1d1f; background: #fff; font: 11pt/1.55 Georgia, 'Times New Roman', serif; }
h1, h2, h3, h4, .kicker, .cover-label, .meta dt, .beat-label, .char-sub { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
.cover { padding: 0.15in 0 0.3in; border-bottom: 3px solid #c8553d; margin-bottom: 0.3in; }
.cover-label { font-size: 9pt; font-weight: 700; letter-spacing: 0.22em; color: #c8553d; }
.cover h1 { margin: 0.12in 0 0.04in; font-size: 28pt; line-height: 1.15; font-weight: 700; letter-spacing: -0.01em; }
.cover .byline { font-size: 12pt; color: #555; font-style: italic; }
.cover .contents { margin-top: 0.14in; font: 9pt/1.4 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #777; letter-spacing: 0.04em; text-transform: uppercase; }
section.module + section.module { break-before: page; page-break-before: always; }
h2 { margin: 0 0 0.18in; padding-bottom: 0.06in; border-bottom: 1px solid #ddd; font-size: 18pt; font-weight: 700; color: #111; }
h3 { margin: 0.24in 0 0.08in; font-size: 12.5pt; font-weight: 700; color: #111; break-after: avoid; page-break-after: avoid; }
h4 { margin: 0.14in 0 0.04in; font-size: 10pt; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #333; break-after: avoid; page-break-after: avoid; }
p { margin: 0 0 0.09in; orphans: 3; widows: 3; }
ul { margin: 0 0 0.09in; padding-left: 0.22in; }
li { margin: 0 0 0.03in; }
.kicker { font-size: 8pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #8a8a8a; margin-bottom: 0.03in; }
.empty { color: #9a9a9a; font-style: italic; }
.meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.1in 0.2in; margin: 0 0 0.1in; }
.meta div { padding: 0.08in 0.1in; border-left: 3px solid #c8553d; background: #f7f5f2; }
.meta dt { font-size: 8pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #8a8a8a; }
.meta dd { margin: 0.02in 0 0; }
.devices li strong { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10pt; }
.beat { margin: 0 0 0.12in; padding: 0.1in 0.14in; border: 1px solid #e4e1dc; border-radius: 4px; break-inside: avoid; page-break-inside: avoid; }
.beat-label { font-size: 10.5pt; font-weight: 700; margin-bottom: 0.04in; }
.beat-n { display: inline-block; min-width: 0.24in; color: #c8553d; }
.beat-q { margin-left: 0.08in; font-weight: 400; font-style: italic; color: #888; }
.logline { margin: 0 0 0.12in; padding: 0.12in 0.16in; background: #f7f5f2; border-left: 3px solid #c8553d; font-size: 12pt; break-inside: avoid; }
.act { break-inside: auto; }
.act-h { color: #c8553d; }
.break-soft { height: 0.06in; }
.note { break-inside: avoid; page-break-inside: avoid; }
.character { margin: 0 0 0.22in; padding-bottom: 0.14in; border-bottom: 1px solid #eee; break-inside: avoid; page-break-inside: avoid; }
.char-name { margin-top: 0; font-size: 14pt; letter-spacing: 0.04em; text-transform: uppercase; }
.char-sub { font-size: 9.5pt; font-weight: 700; color: #c8553d; margin: -0.04in 0 0.04in; }
.char-rel { font-style: italic; color: #555; margin-bottom: 0.06in; }
.char-field { margin-top: 0.06in; }
.foot { margin-top: 0.3in; font: 8pt 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #aaa; text-align: center; }
@media screen { body { max-width: 7in; margin: 0.5in auto; } }
`;function I(e,{date:t=new Date}={}){let n=e.sections.map(e=>e.heading).join(` · `),r=new Date(t).toLocaleDateString(`en-US`,{year:`numeric`,month:`long`,day:`numeric`}),i=e.sections.map(e=>`
  <section class="module" id="${e.id}">
    <h2>${E(e.heading)}</h2>
    ${P[e.id](e)}
  </section>`).join(``);return`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${E(e.docTitle)}</title><style>${F}</style></head>
<body>
  <header class="cover">
    <div class="cover-label">${E(e.label)}</div>
    <h1>${E(e.title)}</h1>
    ${e.author?`<div class="byline">by ${E(e.author)}</div>`:``}
    <div class="contents">${E(n)} · ${E(r)}</div>
  </header>
  ${i}
  <div class="foot">Made with DraftLine</div>
</body></html>`}function L(e={}){let t=T(e,h),[n,r,i]=t.sections,a=n.beats.filter(e=>e.text).length,o=e=>e.filter(e=>e.text).length,s=[r.logline&&`Logline`,...r.cards.map(e=>e.title),o(r.synopsis)&&`Synopsis`,o(r.treatment)&&`Treatment (${t.actMode} acts)`,r.others.length&&`${r.others.length} note${r.others.length===1?``:`s`}`].filter(Boolean),c=i.characters.length;return{dna:`${a} of ${n.beats.length} beats answered${n.meta.length?` · ${n.meta.map(e=>e.label).join(`, `)}`:``}`,notes:s.length?s.join(` · `):`Nothing written yet`,characters:c?`${c} ${c===1?`character`:`characters`} with a bio`:`No bios yet`}}function R(e,t,n=f){let r=T(e,t);return n({html:I(r),title:r.docTitle})}var z=t();function B({project:e,onClose:t}){let n=(0,p.useRef)(null),[r,i]=(0,p.useState)(h),a=y(r),o=(0,p.useMemo)(()=>L(e),[e]);return(0,p.useEffect)(()=>{let e=n.current;e&&!e.open&&e.showModal()},[]),(0,z.jsx)(`dialog`,{ref:n,className:`eb-modal`,"aria-labelledby":`eb-title`,onCancel:e=>{e.preventDefault(),t()},onMouseDown:e=>{e.target===n.current&&t()},children:(0,z.jsxs)(`form`,{onSubmit:n=>{n.preventDefault(),a&&(t(),R(e,r))},children:[(0,z.jsx)(`h2`,{id:`eb-title`,children:`Export Story Bible (PDF)`}),(0,z.jsxs)(`p`,{className:`eb-sub`,children:[`A formatted dossier: title page header, then each section on its own pages. Choose `,(0,z.jsx)(`b`,{children:`Save as PDF`}),` in the print dialog.`]}),(0,z.jsxs)(`fieldset`,{className:`eb-options`,children:[(0,z.jsx)(`legend`,{className:`eb-legend`,children:`Include`}),m.map(e=>(0,z.jsxs)(`label`,{className:`eb-option${r[e.id]?` is-on`:``}`,children:[(0,z.jsx)(`input`,{type:`checkbox`,checked:!!r[e.id],onChange:t=>i(n=>({...n,[e.id]:t.target.checked}))}),(0,z.jsxs)(`span`,{className:`eb-text`,children:[(0,z.jsxs)(`span`,{className:`eb-label`,children:[e.label,` `,(0,z.jsxs)(`span`,{className:`eb-hint`,children:[`(`,e.hint,`)`]})]}),o[e.id]&&(0,z.jsx)(`span`,{className:`eb-summary`,children:o[e.id]})]})]},e.id))]}),!a&&(0,z.jsx)(`p`,{className:`eb-warn`,role:`status`,children:`Pick at least one section to export.`}),(0,z.jsxs)(`div`,{className:`eb-actions`,children:[(0,z.jsx)(`button`,{type:`button`,className:`btn eb-cancel`,onClick:t,children:`Cancel`}),(0,z.jsx)(`button`,{type:`submit`,className:`btn btn-primary eb-export`,disabled:!a,children:`Export PDF`})]})]})})}export{B as default};