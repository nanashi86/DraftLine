import { STRIP_COLORS } from '../../lib/productionEngine.js';

// The Stripboard's pieces, shared by Script view and Schedule view so a strip is the same everywhere:
// same columns, colours, modifiers and click (open the scene in Write). The markup is exactly the
// Stripboard's from before Scheduling (tests/browser/stripboard.browser.js holds it to that).

/** The colour key: INT. DAY · 20 … (No day / night only when there is one). */
export function StripLegend({ totals }) {
  return (
    <div className="strip-legend">
      {Object.entries(STRIP_COLORS).filter(([k]) => k !== 'unknown' || totals.colors.unknown).map(([k, c]) => (
        <span key={k} className="strip-key"><span className={`strip-swatch strip-${k}`} aria-hidden="true" />{c.label} · {totals.colors[k]}</span>
      ))}
    </div>
  );
}

/** SC. · I/E · SLUGLINE · D/N · PAGES · CAST */
export function StripHead() {
  return (
    <div className="strip strip-head" role="row">
      <span role="columnheader">Sc.</span>
      <span role="columnheader">I/E</span>
      <span role="columnheader">Slugline</span>
      <span role="columnheader">D/N</span>
      <span role="columnheader">Pages</span>
      <span role="columnheader">Cast</span>
    </div>
  );
}

/**
 * One scene's strip: a button that opens the scene in Write. `day` (Script view, once there's a
 * schedule) adds a quiet D3 at the end of the slugline cell, after any modifier, never over it.
 */
export function StripRow({ r, onOpenScene, day = null, ...rest }) {
  return (
    <button
      type="button"
      role="row"
      className={`strip strip-${r.color}`}
      onClick={() => onOpenScene(r.id)}
      title={`${STRIP_COLORS[r.color].label} — open scene ${r.number} in Write`}
      {...rest}
    >
      <span role="cell" className="strip-num">{r.number}</span>
      <span role="cell" className="strip-ie">{r.setting || '–'}</span>
      <span role="cell" className="strip-slug">
        <span className="strip-loc">{r.location || r.heading}</span>
        {r.modifier && <span className="strip-mod">{r.modifier}</span>}
        {day != null && <span className="strip-day" title={`Shooting day ${day}`}>D{day}</span>}
      </span>
      <span role="cell" title={r.time && r.time !== r.timeOfDay ? `${r.time}${r.timeOfDay ? ` → ${r.timeOfDay}` : ''}` : undefined}>
        {r.timeOfDay || '–'}
      </span>
      <span role="cell" className="strip-len">{r.length}</span>
      <span role="cell" className="strip-cast" title={r.cast.map((c) => `${c.number}. ${c.name}`).join(', ')}>
        {r.cast.map((c) => c.number).join(', ') || '–'}
      </span>
    </button>
  );
}
