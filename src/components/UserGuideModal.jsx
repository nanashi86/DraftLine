import { useEffect, useMemo, useRef, useState } from 'react';
import userGuideMarkdown from '../content/userGuide.md?raw';
import ExpandToggle from './ExpandToggle.jsx';
import { guideHtml, highlight, inlineTokens, parseGuide, searchGuide } from '../lib/userGuide.js';
import pkg from '../../package.json';
import './HelpModal.css';
import './UserGuideModal.css';

const GUIDE = parseGuide(userGuideMarkdown);

/** Inline Markdown as React elements (never HTML), with search words marked. */
function Inline({ text, query }) {
  return inlineTokens(text).map((tok, i) => {
    const parts = highlight(tok.v, query).map((p, k) => (p.hit ? <mark key={k}>{p.v}</mark> : p.v));
    if (tok.t === 'b') return <strong key={i}>{parts}</strong>;
    if (tok.t === 'i') return <em key={i}>{parts}</em>;
    if (tok.t === 'code') return <kbd key={i}>{parts}</kbd>;
    return <span key={i}>{parts}</span>;
  });
}

function Blocks({ blocks, query }) {
  return blocks.map((b, i) => {
    if (b.type === 'p') return <p key={i}><Inline text={b.text} query={query} /></p>;
    const Tag = b.type;
    return (
      <Tag key={i} start={b.type === 'ol' && b.start !== 1 ? b.start : undefined}>
        {b.items.map((t, k) => <li key={k}><Inline text={t} query={query} /></li>)}
      </Tag>
    );
  });
}

/** Print / Save PDF: the guide alone, in a hidden frame — the script's own print view is untouched. */
function printGuide(returnFocusTo) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  frame.srcdoc = guideHtml(GUIDE, { version: pkg.version });
  frame.onload = () => {
    const w = frame.contentWindow;
    const done = () => setTimeout(() => frame.remove(), 500);
    w.addEventListener('afterprint', done);
    w.focus();
    w.print(); // blocks until the print dialog closes
    returnFocusTo?.focus(); // keep Esc and the keyboard working in the guide
    setTimeout(done, 60_000); // in case afterprint never comes
  };
  document.body.appendChild(frame);
}

/**
 * User Guide (⋮ → User Guide, F1): the manual from src/content/userGuide.md, with a contents
 * list, search across headings and text, expand to full screen, and Print / Save PDF.
 */
export default function UserGuideModal({ onClose }) {
  const dialogRef = useRef(null);
  const bodyRef = useRef(null);
  const searchRef = useRef(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const shown = useMemo(() => searchGuide(GUIDE, query), [query]);
  const searching = shown.count != null;

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    searchRef.current?.focus();
  }, []);

  const goTo = (id) => {
    bodyRef.current?.querySelector(`#ug-${CSS.escape(id)}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <dialog
      ref={dialogRef}
      className={`hm-modal ug-modal${expanded ? ' is-expanded' : ''}`}
      aria-labelledby="ug-title"
      onCancel={(e) => {
        e.preventDefault();
        // Esc: clear the search first, then collapse, then close.
        if (query) setQuery('');
        else if (expanded) setExpanded(false);
        else onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <header className="hm-head ug-head">
        <h2 id="ug-title">User Guide</h2>
        <input
          ref={searchRef}
          className="ug-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            bodyRef.current?.scrollTo({ top: 0 });
          }}
          placeholder="Search the guide…"
          aria-label="Search the User Guide"
        />
        <div className="ug-actions">
          <button type="button" className="btn" onClick={(e) => printGuide(e.currentTarget)} title="Print the whole guide, or choose Save as PDF">
            Print / Save PDF
          </button>
          <ExpandToggle expanded={expanded} onToggle={() => setExpanded((x) => !x)} />
          <button type="button" className="btn" onClick={onClose}>Close</button>
        </div>
      </header>

      <div className="ug-main">
        <nav className="ug-toc" aria-label="Contents">
          <div className="micro-label">Contents</div>
          <ol>
            {GUIDE.chapters.map((c) => {
              const hit = shown.chapters.some((x) => x.id === c.id);
              return (
                <li key={c.id}>
                  <button type="button" className={`ug-toc-ch${searching && !hit ? ' is-dim' : ''}`} onClick={() => goTo(c.id)} disabled={searching && !hit}>
                    {c.title}
                  </button>
                  {expanded && !searching && (
                    <ol>
                      {c.topics.map((t) => (
                        <li key={t.id}><button type="button" className="ug-toc-topic" onClick={() => goTo(t.id)}>{t.title}</button></li>
                      ))}
                    </ol>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <article className="ug-body" ref={bodyRef} aria-live="polite">
          {searching ? (
            <p className="ug-count">
              {shown.count ? `${shown.count} ${shown.count === 1 ? 'topic matches' : 'topics match'} “${query.trim()}”` : `Nothing in the guide matches “${query.trim()}”.`}
            </p>
          ) : (
            <>
              <h1 className="ug-title">{GUIDE.title}</h1>
              <Blocks blocks={GUIDE.intro} query="" />
            </>
          )}
          {shown.chapters.map((c) => (
            <section key={c.id} className="ug-chapter" aria-labelledby={`ug-${c.id}`}>
              <h2 id={`ug-${c.id}`}><Inline text={c.title} query={query} /></h2>
              <Blocks blocks={c.blocks} query={query} />
              {c.topics.map((t) => (
                <section key={t.id} className="ug-topic" aria-labelledby={`ug-${t.id}`}>
                  <h3 id={`ug-${t.id}`}><Inline text={t.title} query={query} /></h3>
                  <Blocks blocks={t.blocks} query={query} />
                </section>
              ))}
            </section>
          ))}
        </article>
      </div>
    </dialog>
  );
}
