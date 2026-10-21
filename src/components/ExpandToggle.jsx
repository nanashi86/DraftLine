import { EXPAND_ARIA_LABEL, expandTitle } from '../lib/panelExpand.js';

/** The drawer header's expand / collapse button: outward arrows (expand) or inward arrows (collapse). */
export default function ExpandToggle({ expanded, onToggle }) {
  return (
    <button
      type="button"
      className={`btn btn-icon pb-expand${expanded ? ' is-on-subtle' : ''}`}
      onClick={onToggle}
      aria-label={EXPAND_ARIA_LABEL}
      aria-pressed={expanded}
      title={expandTitle(expanded)}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {expanded ? (
          // Minimize2: two arrows pointing in to the centre
          <path d="M2.5 9.5h4v4M13.5 6.5h-4v-4M6.5 9.5l-4.5 4.5M9.5 6.5L14 2" />
        ) : (
          // Maximize2: two arrows pointing out to the corners
          <path d="M10 2.5h3.5V6M6 13.5H2.5V10M13.5 2.5L9 7M2.5 13.5L7 9" />
        )}
      </svg>
    </button>
  );
}
