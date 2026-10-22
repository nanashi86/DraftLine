import{A as e,D as t,K as n,L as r,O as i,P as a,R as o,k as s,q as c,x as l}from"./index-BR1U3ulX.js";import{n as u}from"./printTitle-C1qWomuv.js";var d=c(),f=[{id:`dna`,label:`Story DNA`,hint:`Genre, Theme, 8 Narrative Beats`},{id:`notes`,label:`Story Notes`,hint:`Synopsis & Multi-Act Treatment`},{id:`characters`,label:`Character Bios`,hint:`All characters with populated bios/descriptions`}],p=Object.fromEntries(f.map(e=>[e.id,!0])),m=`STORY BIBLE & PROJECT DOSSIER`,h=new Set([`scratchpad`]),g=e=>typeof e==`string`?e.trim():``,_=e=>f.some(t=>e?.[t.id]),v=e=>`${g(e)||`Untitled`} - Story Bible`;function y(e){return g(e?.name)?!!s(e)||l.some(t=>t.key!==`name`&&g(e[t.key])):!1}function b(e){let t=r(e),n=t.genres.filter(e=>e!==`Other`);t.genres.includes(`Other`)&&g(t.genreOther)&&n.push(g(t.genreOther));let i=o(t).filter(e=>e.kind===`device`&&e.info).map(e=>({label:e.info.label,on:e.on===!0,notes:g(e.notes)})).filter(e=>e.on||e.notes);return{id:`dna`,heading:`Story DNA`,meta:[{label:`Genre`,value:n.join(` · `)},{label:`Theme`,value:g(t.theme)},{label:`Conflict`,value:g(t.conflictType)}].filter(e=>e.value),devices:i,beats:a.map((e,n)=>({n:n+1,label:e.label,question:e.question,text:g(t.answers[e.key])}))}}function x(n,r){let a=i(n),o=e=>a.sections.find(t=>t.title.trim().toLowerCase()===e),s=(n,i)=>t(n,r,i).map(t=>({key:t.key,label:n===`treatment`?e(t):t.label,text:g(i[t.key])}));return{id:`notes`,heading:`Story Notes`,logline:g(o(`logline`)?.body),synopsis:s(`synopsis`,a.synopsis),treatment:s(`treatment`,a.treatment),others:a.sections.filter(e=>![`logline`,...h].includes(e.title.trim().toLowerCase())&&g(e.body)).map(e=>({title:g(e.title)||`Untitled note`,body:g(e.body)}))}}function S(e){return{id:`characters`,heading:`Character Bios`,characters:(Array.isArray(e)?e:[]).filter(y).map(e=>({name:g(e.name),role:s(e),age:g(e.age),relationship:g(e.relationship),fields:[{label:`Physical Description`,text:g(e.description)},{label:`Traits`,text:g(e.traits)},{label:`Backstory / Motivation & Arc`,text:g(e.backstory)}].filter(e=>e.text)}))}}function C({meta:e={},storyDna:t,storyNotes:n,characters:r,actMode:i=4}={},a=p){let o=g(e.title)||`Untitled`,s=[];return a?.dna&&s.push(b(t)),a?.notes&&s.push(x(n,i)),a?.characters&&s.push(S(r)),{title:o,author:g(e.author),label:m,docTitle:v(o),actMode:i,sections:s}}var w=e=>String(e??``).replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`})[e]),T=e=>w(e).replace(/\*\*(.+?)\*\*/g,`<strong>$1</strong>`).replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g,`$1<em>$2</em>`);function E(e){let t=[];for(let n of g(e).split(/\n[ \t]*\n+/)){let e=n.split(`
`);e.every(e=>/^\s*[-*•]\s+/.test(e))?t.push(`<ul>${e.map(e=>`<li>${T(e.replace(/^\s*[-*•]\s+/,``))}</li>`).join(``)}</ul>`):/^#{1,6}\s+/.test(e[0])?(t.push(`<h4>${T(e[0].replace(/^#{1,6}\s+/,``))}</h4>`),e.length>1&&t.push(`<p>${e.slice(1).map(T).join(`<br>`)}</p>`)):n.trim()&&t.push(`<p>${e.map(T).join(`<br>`)}</p>`)}return t.join(`
`)}var D=e=>`<p class="empty">${w(e)}</p>`;function O(e){return`${e.meta.length?`<dl class="meta">${e.meta.map(e=>`<div><dt>${w(e.label)}</dt><dd>${w(e.value)}</dd></div>`).join(``)}</dl>`:``}${e.devices.length?`<h3>Plot Devices</h3><ul class="devices">${e.devices.map(e=>`<li><strong>${w(e.label)}</strong>${e.notes?` — ${T(e.notes)}`:``}</li>`).join(``)}</ul>`:``}<h3>The Eight Narrative Beats</h3>${e.beats.map(e=>`
    <div class="beat">
      <div class="beat-label"><span class="beat-n">${e.n}</span>${w(e.label)}<span class="beat-q">${w(e.question)}</span></div>
      ${e.text?E(e.text):D(`Not answered yet.`)}
    </div>`).join(``)}`}function k(e,t){return t.some(e=>e.text)?`<h3>${w(e)}</h3>${t.map(e=>`
    <div class="act"><h4 class="act-h">${w(e.label)}</h4>${e.text?E(e.text):D(`Not written yet.`)}</div>`).join(``)}`:`<h3>${w(e)}</h3>${D(`Not written yet.`)}`}function A(e){let t=e.logline?`<div class="logline"><div class="kicker">Logline</div>${E(e.logline)}</div>`:``,n=e.others.map(e=>`<div class="note"><h3>${w(e.title)}</h3>${E(e.body)}</div>`).join(``);return`${t}${k(`Synopsis`,e.synopsis)}<div class="break-soft"></div>${k(`Treatment`,e.treatment)}${n}`}function j(e){return e.characters.length?e.characters.map(e=>{let t=[e.role,e.age&&`Age: ${e.age}`].filter(Boolean).map(w).join(` · `);return`
    <div class="character">
      <h3 class="char-name">${w(e.name)}</h3>
      ${t?`<div class="char-sub">${t}</div>`:``}
      ${e.relationship?`<div class="char-rel">${T(e.relationship)}</div>`:``}
      ${e.fields.map(e=>`<div class="char-field"><div class="kicker">${w(e.label)}</div>${E(e.text)}</div>`).join(``)}
    </div>`}).join(``):D(`No character bios yet.`)}var M={dna:O,notes:A,characters:j},N=`
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
`;function P(e,{date:t=new Date}={}){let n=e.sections.map(e=>e.heading).join(` · `),r=new Date(t).toLocaleDateString(`en-US`,{year:`numeric`,month:`long`,day:`numeric`}),i=e.sections.map(e=>`
  <section class="module" id="${e.id}">
    <h2>${w(e.heading)}</h2>
    ${M[e.id](e)}
  </section>`).join(``);return`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${w(e.docTitle)}</title><style>${N}</style></head>
<body>
  <header class="cover">
    <div class="cover-label">${w(e.label)}</div>
    <h1>${w(e.title)}</h1>
    ${e.author?`<div class="byline">by ${w(e.author)}</div>`:``}
    <div class="contents">${w(n)} · ${w(r)}</div>
  </header>
  ${i}
  <div class="foot">Made with DraftLine</div>
</body></html>`}function F(e={}){let t=C(e,p),[n,r,i]=t.sections,a=n.beats.filter(e=>e.text).length,o=e=>e.filter(e=>e.text).length,s=[r.logline&&`Logline`,o(r.synopsis)&&`Synopsis`,o(r.treatment)&&`Treatment (${t.actMode} acts)`].filter(Boolean),c=i.characters.length;return{dna:`${a} of ${n.beats.length} beats answered${n.meta.length?` · ${n.meta.map(e=>e.label).join(`, `)}`:``}`,notes:s.length?s.join(` · `):`Nothing written yet`,characters:c?`${c} ${c===1?`character`:`characters`} with a bio`:`No bios yet`}}function I(e,t,n=u){let r=C(e,t);return n({html:P(r),title:r.docTitle})}var L=n();function R({project:e,onClose:t}){let n=(0,d.useRef)(null),[r,i]=(0,d.useState)(p),a=_(r),o=(0,d.useMemo)(()=>F(e),[e]);return(0,d.useEffect)(()=>{let e=n.current;e&&!e.open&&e.showModal()},[]),(0,L.jsx)(`dialog`,{ref:n,className:`eb-modal`,"aria-labelledby":`eb-title`,onCancel:e=>{e.preventDefault(),t()},onMouseDown:e=>{e.target===n.current&&t()},children:(0,L.jsxs)(`form`,{onSubmit:n=>{n.preventDefault(),a&&(t(),I(e,r))},children:[(0,L.jsx)(`h2`,{id:`eb-title`,children:`Export Story Bible (PDF)`}),(0,L.jsxs)(`p`,{className:`eb-sub`,children:[`A formatted dossier: title page header, then each section on its own pages. Choose `,(0,L.jsx)(`b`,{children:`Save as PDF`}),` in the print dialog.`]}),(0,L.jsxs)(`fieldset`,{className:`eb-options`,children:[(0,L.jsx)(`legend`,{className:`eb-legend`,children:`Include`}),f.map(e=>(0,L.jsxs)(`label`,{className:`eb-option${r[e.id]?` is-on`:``}`,children:[(0,L.jsx)(`input`,{type:`checkbox`,checked:!!r[e.id],onChange:t=>i(n=>({...n,[e.id]:t.target.checked}))}),(0,L.jsxs)(`span`,{className:`eb-text`,children:[(0,L.jsxs)(`span`,{className:`eb-label`,children:[e.label,` `,(0,L.jsxs)(`span`,{className:`eb-hint`,children:[`(`,e.hint,`)`]})]}),o[e.id]&&(0,L.jsx)(`span`,{className:`eb-summary`,children:o[e.id]})]})]},e.id))]}),!a&&(0,L.jsx)(`p`,{className:`eb-warn`,role:`status`,children:`Pick at least one section to export.`}),(0,L.jsxs)(`div`,{className:`eb-actions`,children:[(0,L.jsx)(`button`,{type:`button`,className:`btn eb-cancel`,onClick:t,children:`Cancel`}),(0,L.jsx)(`button`,{type:`submit`,className:`btn btn-primary eb-export`,disabled:!a,children:`Export PDF`})]})]})})}export{R as default};