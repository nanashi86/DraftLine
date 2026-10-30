import { Search, X } from 'lucide-react';
import { EMPTY_PLAN_FILTER, planFilterActive, toggleIn } from '../../lib/planFilter.js';
import './PlanFilter.css';

const SETTINGS = [['INT', 'INT', 'Interior scenes (INT./EXT. counts as both)'], ['EXT', 'EXT', 'Exterior scenes (INT./EXT. counts as both)']];
const PERIODS = [['day', 'DAY', 'Day scenes (CONTINUOUS takes the light of the scene before)'], ['night', 'NIGHT', 'Night scenes (CONTINUOUS takes the light of the scene before)']];

/**
 * Plan's scene filter (lib/planFilter.js): Find scenes… · INT | EXT · DAY | NIGHT, and while anything
 * is set, "4 of 53 scenes ✕". In the header on wide windows (place 'bar', closing with a divider like
 * Write's Element · B I U S), at the top of the workspace on narrower ones (place 'workspace'), where
 * only ✕ shows: the summary line under it carries the count.
 *   filter: { q, ie, dn } · onChange(next) · count: { shown, total } (header only; null until Plan has rows)
 */
export default function PlanFilter({ filter, onChange, count, place = 'bar' }) {
  const active = planFilterActive(filter);
  const clear = (
    <button type="button" className="btn btn-icon pf-clear" onClick={() => onChange(EMPTY_PLAN_FILTER)} aria-label="Clear the scene filter" title="Clear the scene filter">
      <X size={13} strokeWidth={1.75} aria-hidden />
    </button>
  );
  const seg = (items, key) => (
    <div className="pf-seg" role="group" aria-label={key === 'ie' ? 'Interior or exterior' : 'Day or night'}>
      {items.map(([v, label, title]) => {
        const on = filter[key].includes(v);
        return (
          <button
            key={v}
            type="button"
            className={`pf-btn${on ? ' is-on' : ''}`}
            aria-pressed={on}
            title={title}
            onClick={() => onChange({ ...filter, [key]: toggleIn(filter[key], v) })}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
  return (
    <div className={`plan-filter is-${place}`} role="search" aria-label="Filter scenes">
      <label className="pf-find">
        <Search size={14} strokeWidth={1.75} aria-hidden />
        <input
          type="search"
          value={filter.q}
          onChange={(e) => onChange({ ...filter, q: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && filter.q) {
              e.stopPropagation();
              onChange({ ...filter, q: '' });
            }
          }}
          placeholder="Find scenes…"
          aria-label="Find scenes by heading, location, character or number"
          title="Heading, location, speaking character or scene number"
        />
      </label>
      {seg(SETTINGS, 'ie')}
      {seg(PERIODS, 'dn')}
      {/* While set: the header shows "4 of 53 scenes ✕". At the top of the workspace only ✕ — the
          summary line right under it already says "4 of 53 scenes · …", so the count isn't shown twice. */}
      {active && place === 'bar' && count && (
        <span className="pf-count" role="status">
          <b>{count.shown} of {count.total}</b> {count.total === 1 ? 'scene' : 'scenes'}
          {clear}
        </span>
      )}
      {active && place === 'workspace' && clear}
      {place === 'bar' && <span className="bar-sep pf-sep" aria-hidden="true" />}
    </div>
  );
}
