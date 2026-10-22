import{i as e,t}from"./react-DgawKyfb.js";import{St as n,dt as r,ft as i,it as a,mt as o,ot as s,pt as c,vt as l,xt as u}from"./index-Xe4RoPwh.js";import{n as d}from"./printTitle-C1qWomuv.js";var f=e(),p=[{id:`dna`,label:`Story DNA`,hint:`Genre, Theme, 8 Narrative Beats`},{id:`notes`,label:`Story Notes`,hint:`Synopsis & Multi-Act Treatment`},{id:`characters`,label:`Character Bios`,hint:`All characters with populated bios/descriptions`}],m=Object.fromEntries(p.map(e=>[e.id,!0])),h=`STORY BIBLE & PROJECT DOSSIER`,g=e=>/note/i.test(String(e||``))&&!/scratch\s*pad/i.test(String(e||``)),_=e=>typeof e==`string`?e.trim():``,v=e=>p.some(t=>e?.[t.id]),y=e=>`${_(e)||`Untitled`} - Story Bible`;function b(e){return _(e?.name)?!!c(e)||a.some(t=>t.key!==`name`&&_(e[t.key])):!1}function x(e){let t=u(e),r=t.genres.filter(e=>e!==`Other`);t.genres.includes(`Other`)&&_(t.genreOther)&&r.push(_(t.genreOther));let i=n(t).filter(e=>e.kind===`device`&&e.info).map(e=>({label:e.info.label,on:e.on===!0,notes:_(e.notes)})).filter(e=>e.on||e.notes);return{id:`dna`,heading:`Story DNA`,meta:[{label:`Genre`,value:r.join(` · `)},{label:`Theme`,value:_(t.theme)},{label:`Conflict`,value:_(t.conflictType)}].filter(e=>e.value),devices:i,beats:l.map((e,n)=>({n:n+1,label:e.label,question:e.question,text:_(t.answers[e.key])}))}}function S(e,t){let n=i(e),a=e=>e.trim().toLowerCase(),c=new Set(s.map(a)),l=e=>n.sections.find(t=>a(t.title)===a(e)),u=(e,n)=>r(e,t,n).map(t=>({key:t.key,label:e===`treatment`?o(t):t.label,text:_(n[t.key])}));return{id:`notes`,heading:`Story Notes`,logline:_(l(`Logline`)?.body),cards:s.slice(1).map(e=>({title:e,body:_(l(e)?.body)})).filter(e=>e.body),synopsis:u(`synopsis`,n.synopsis),treatment:u(`treatment`,n.treatment),others:n.sections.filter(e=>!c.has(a(e.title))&&g(e.title)&&_(e.body)).map(e=>({title:_(e.title),body:_(e.body)}))}}function C(e){return{id:`characters`,heading:`Character Bios`,characters:(Array.isArray(e)?e:[]).filter(b).map(e=>({name:_(e.name),role:c(e),age:_(e.age),relationship:_(e.relationship),fields:[{label:`Physical Description`,text:_(e.description)},{label:`Traits`,text:_(e.traits)},{label:`Backstory / Motivation & Arc`,text:_(e.backstory)}].filter(e=>e.text)}))}}function w({meta:e={},storyDna:t,storyNotes:n,characters:r,actMode:i=4}={},a=m){let o=_(e.title)||`Untitled`,s=[];return a?.dna&&s.push(x(t)),a?.notes&&s.push(S(n,i)),a?.characters&&s.push(C(r)),{title:o,author:_(e.author),label:h,docTitle:y(o),actMode:i,sections:s}}var T=e=>String(e??``).replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`})[e]),E=e=>T(e).replace(/\*\*(.+?)\*\*/g,`<strong>$1</strong>`).replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g,`$1<em>$2</em>`);function D(e){let t=[];for(let n of _(e).split(/\n[ \t]*\n+/)){let e=n.split(`
`);e.every(e=>/^\s*[-*•]\s+/.test(e))?t.push(`<ul>${e.map(e=>`<li>${E(e.replace(/^\s*[-*•]\s+/,``))}</li>`).join(``)}</ul>`):/^#{1,6}\s+/.test(e[0])?(t.push(`<h4>${E(e[0].replace(/^#{1,6}\s+/,``))}</h4>`),e.length>1&&t.push(`<p>${e.slice(1).map(E).join(`<br>`)}</p>`)):n.trim()&&t.push(`<p>${e.map(E).join(`<br>`)}</p>`)}return t.join(`
`)}var O=e=>`<p class="empty">${T(e)}</p>`;function k(e){return`${e.meta.length?`<dl class="meta">${e.meta.map(e=>`<div><dt>${T(e.label)}</dt><dd>${T(e.value)}</dd></div>`).join(``)}</dl>`:``}${e.devices.length?`<h3>Plot Devices</h3><ul class="devices">${e.devices.map(e=>`<li><strong>${T(e.label)}</strong>${e.notes?` — ${E(e.notes)}`:``}</li>`).join(``)}</ul>`:``}<h3>The Eight Narrative Beats</h3>${e.beats.map(e=>`
    <div class="beat">
      <div class="beat-label"><span class="beat-n">${e.n}</span>${T(e.label)}<span class="beat-q">${T(e.question)}</span></div>
      ${e.text?D(e.text):O(`Not answered yet.`)}
    </div>`).join(``)}`}function A(e,t){return t.some(e=>e.text)?`<h3>${T(e)}</h3>${t.map(e=>`
    <div class="act"><h4 class="act-h">${T(e.label)}</h4>${e.text?D(e.text):O(`Not written yet.`)}</div>`).join(``)}`:`<h3>${T(e)}</h3>${O(`Not written yet.`)}`}function j(e){let t=e.logline?`<div class="logline"><div class="kicker">Logline</div>${D(e.logline)}</div>`:``,n=e=>`<div class="note"><h3>${T(e.title)}</h3>${D(e.body)}</div>`;return`${t}${e.cards.map(n).join(``)}${A(`Synopsis`,e.synopsis)}<div class="break-soft"></div>${A(`Treatment`,e.treatment)}${e.others.map(n).join(``)}`}function M(e){return e.characters.length?e.characters.map(e=>{let t=[e.role,e.age&&`Age: ${e.age}`].filter(Boolean).map(T).join(` · `);return`
    <div class="character">
      <h3 class="char-name">${T(e.name)}</h3>
      ${t?`<div class="char-sub">${t}</div>`:``}
      ${e.relationship?`<div class="char-rel">${E(e.relationship)}</div>`:``}
      ${e.fields.map(e=>`<div class="char-field"><div class="kicker">${T(e.label)}</div>${D(e.text)}</div>`).join(``)}
    </div>`}).join(``):O(`No character bios yet.`)}var N={dna:k,notes:j,characters:M},P=`
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
`;function F(e,{date:t=new Date}={}){let n=e.sections.map(e=>e.heading).join(` · `),r=new Date(t).toLocaleDateString(`en-US`,{year:`numeric`,month:`long`,day:`numeric`}),i=e.sections.map(e=>`
  <section class="module" id="${e.id}">
    <h2>${T(e.heading)}</h2>
    ${N[e.id](e)}
  </section>`).join(``);return`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${T(e.docTitle)}</title><style>${P}</style></head>
<body>
  <header class="cover">
    <div class="cover-label">${T(e.label)}</div>
    <h1>${T(e.title)}</h1>
    ${e.author?`<div class="byline">by ${T(e.author)}</div>`:``}
    <div class="contents">${T(n)} · ${T(r)}</div>
  </header>
  ${i}
  <div class="foot">Made with DraftLine</div>
</body></html>`}function I(e={}){let t=w(e,m),[n,r,i]=t.sections,a=n.beats.filter(e=>e.text).length,o=e=>e.filter(e=>e.text).length,s=[r.logline&&`Logline`,...r.cards.map(e=>e.title),o(r.synopsis)&&`Synopsis`,o(r.treatment)&&`Treatment (${t.actMode} acts)`,r.others.length&&`${r.others.length} note${r.others.length===1?``:`s`}`].filter(Boolean),c=i.characters.length;return{dna:`${a} of ${n.beats.length} beats answered${n.meta.length?` · ${n.meta.map(e=>e.label).join(`, `)}`:``}`,notes:s.length?s.join(` · `):`Nothing written yet`,characters:c?`${c} ${c===1?`character`:`characters`} with a bio`:`No bios yet`}}function L(e,t,n=d){let r=w(e,t);return n({html:F(r),title:r.docTitle})}var R=t();function z({project:e,onClose:t}){let n=(0,f.useRef)(null),[r,i]=(0,f.useState)(m),a=v(r),o=(0,f.useMemo)(()=>I(e),[e]);return(0,f.useEffect)(()=>{let e=n.current;e&&!e.open&&e.showModal()},[]),(0,R.jsx)(`dialog`,{ref:n,className:`eb-modal`,"aria-labelledby":`eb-title`,onCancel:e=>{e.preventDefault(),t()},onMouseDown:e=>{e.target===n.current&&t()},children:(0,R.jsxs)(`form`,{onSubmit:n=>{n.preventDefault(),a&&(t(),L(e,r))},children:[(0,R.jsx)(`h2`,{id:`eb-title`,children:`Export Story Bible (PDF)`}),(0,R.jsxs)(`p`,{className:`eb-sub`,children:[`A formatted dossier: title page header, then each section on its own pages. Choose `,(0,R.jsx)(`b`,{children:`Save as PDF`}),` in the print dialog.`]}),(0,R.jsxs)(`fieldset`,{className:`eb-options`,children:[(0,R.jsx)(`legend`,{className:`eb-legend`,children:`Include`}),p.map(e=>(0,R.jsxs)(`label`,{className:`eb-option${r[e.id]?` is-on`:``}`,children:[(0,R.jsx)(`input`,{type:`checkbox`,checked:!!r[e.id],onChange:t=>i(n=>({...n,[e.id]:t.target.checked}))}),(0,R.jsxs)(`span`,{className:`eb-text`,children:[(0,R.jsxs)(`span`,{className:`eb-label`,children:[e.label,` `,(0,R.jsxs)(`span`,{className:`eb-hint`,children:[`(`,e.hint,`)`]})]}),o[e.id]&&(0,R.jsx)(`span`,{className:`eb-summary`,children:o[e.id]})]})]},e.id))]}),!a&&(0,R.jsx)(`p`,{className:`eb-warn`,role:`status`,children:`Pick at least one section to export.`}),(0,R.jsxs)(`div`,{className:`eb-actions`,children:[(0,R.jsx)(`button`,{type:`button`,className:`btn eb-cancel`,onClick:t,children:`Cancel`}),(0,R.jsx)(`button`,{type:`submit`,className:`btn btn-primary eb-export`,disabled:!a,children:`Export PDF`})]})]})})}export{z as default};