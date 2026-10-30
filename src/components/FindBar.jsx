import { useEffect, useRef } from 'react';
import { CaseSensitive, ChevronDown, ChevronRight, ChevronUp, Replace, ReplaceAll, Search, WholeWord, X } from 'lucide-react';
import { FIND_SCOPES, MATCH_LIMIT } from '../lib/findReplace.js';
import './FindBar.css';

const ICON = { size: 14, strokeWidth: 1.75, 'aria-hidden': true };

/**
 * Find & Replace (Ctrl+F / Ctrl+H): one slim card floating at the top right of the page, not a
 * dialog — the script stays visible and editable. A second row (Ctrl+H, or the chevron) replaces.
 *
 *   [›] [⌕ ferry        ] 3 of 12  ↑ ↓  Aa  W  [All elements ▾]  ✕
 *       [⇄ boat         ]  Replace   All
 *
 * Find box: Enter next · Shift+Enter previous · Esc closes (the match is selected in the script).
 * Replace box: Enter replaces this one · Ctrl+Enter replaces all. Viewing: Find works, Replace is off.
 */
export default function FindBar({
  state, total, index, locked = false, focusSignal = 0,
  onChange, onStep, onReplace, onReplaceAll, onClose,
}) {
  const findRef = useRef(null);
  const replaceRef = useRef(null);
  const { query, replacement, matchCase, wholeWord, scope, replace } = state;

  // Ctrl+F (again) puts the cursor back in the Find box with its text selected.
  useEffect(() => {
    const el = findRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [focusSignal]);

  // Esc anywhere in the bar (a box, a button, the scope list) closes it — only it: not Focus mode, not
  // the Dialogue filter.
  const onBarKey = (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };
  const keys = (e, where) => {
    if (e.key === 'Enter' && where === 'find') {
      e.preventDefault();
      onStep(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Enter' && where === 'replace') {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) onReplaceAll();
      else onReplace();
    }
  };

  const count = !query ? '' : total === 0 ? 'No results'
    : `${index + 1} of ${total >= MATCH_LIMIT ? `${MATCH_LIMIT}+` : total}`;
  const replaceTitle = locked ? 'Viewing — switch to Editing (Ctrl+Alt+L) to replace' : undefined;

  return (
    <div className="find-bar" role="search" aria-label="Find and replace in the script" onKeyDown={onBarKey}>
      <div className="fb-row">
        <button
          type="button"
          className="fb-icon fb-toggle"
          aria-expanded={replace}
          aria-label={replace ? 'Hide Replace' : 'Show Replace (Ctrl+H)'}
          title={replace ? 'Hide Replace' : 'Replace (Ctrl+H)'}
          onClick={() => onChange({ replace: !replace })}
        >
          {replace ? <ChevronDown {...ICON} /> : <ChevronRight {...ICON} />}
        </button>
        <label className="fb-field">
          <Search {...ICON} />
          <input
            ref={findRef}
            value={query}
            placeholder="Find"
            aria-label="Find"
            spellCheck={false}
            onChange={(e) => onChange({ query: e.target.value })}
            onKeyDown={(e) => keys(e, 'find')}
          />
        </label>
        <span className={`fb-count${query && !total ? ' is-none' : ''}`} aria-live="polite">{count}</span>
        <button type="button" className="fb-icon" disabled={!total} onClick={() => onStep(-1)} aria-label="Previous match" title="Previous (Shift+Enter)">
          <ChevronUp {...ICON} />
        </button>
        <button type="button" className="fb-icon" disabled={!total} onClick={() => onStep(1)} aria-label="Next match" title="Next (Enter)">
          <ChevronDown {...ICON} />
        </button>
        <button
          type="button"
          className={`fb-icon fb-opt${matchCase ? ' is-on' : ''}`}
          aria-pressed={matchCase}
          aria-label="Match case"
          title="Match case"
          onClick={() => onChange({ matchCase: !matchCase })}
        >
          <CaseSensitive {...ICON} />
        </button>
        <button
          type="button"
          className={`fb-icon fb-opt${wholeWord ? ' is-on' : ''}`}
          aria-pressed={wholeWord}
          aria-label="Whole words only"
          title="Whole words only"
          onClick={() => onChange({ wholeWord: !wholeWord })}
        >
          <WholeWord {...ICON} />
        </button>
        <select
          className="fb-scope"
          value={scope}
          aria-label="Search in"
          title="Search in"
          onChange={(e) => onChange({ scope: e.target.value })}
        >
          {FIND_SCOPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button type="button" className="fb-icon fb-close" onClick={onClose} aria-label="Close Find" title="Close (Esc)">
          <X {...ICON} />
        </button>
      </div>
      {replace && (
        <div className="fb-row fb-replace">
          <span className="fb-icon fb-spacer" aria-hidden="true" />
          <label className="fb-field">
            <Replace {...ICON} />
            <input
              ref={replaceRef}
              value={replacement}
              placeholder="Replace with"
              aria-label="Replace with"
              spellCheck={false}
              disabled={locked}
              title={replaceTitle}
              onChange={(e) => onChange({ replacement: e.target.value })}
              onKeyDown={(e) => keys(e, 'replace')}
            />
          </label>
          <button type="button" className="btn fb-btn" disabled={locked || !total} onClick={onReplace} title={replaceTitle || 'Replace this one (Enter)'}>
            Replace
          </button>
          <button type="button" className="btn fb-btn" disabled={locked || !total} onClick={onReplaceAll} title={replaceTitle || 'Replace every match — one Ctrl+Z undoes it (Ctrl+Enter)'}>
            <ReplaceAll {...ICON} />
            All
          </button>
        </div>
      )}
    </div>
  );
}
