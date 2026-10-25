import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { buildReports } from '../../lib/reports.js';

const ICON = { size: 14, strokeWidth: 1.75, 'aria-hidden': true };
const TABS = [
  { id: 'scenes', label: 'Scenes' },
  { id: 'characters', label: 'Characters' },
  { id: 'locations', label: 'Locations' },
  { id: 'script', label: 'Script' },
];

/** Columns per report: [key, label, { num, sort(row) }]. */
const COLUMNS = {
  scenes: [
    ['number', '#', { num: true }],
    ['heading', 'Slugline'],
    ['setting', 'INT/EXT'],
    ['time', 'Time'],
    ['page', 'Page', { num: true }],
    ['eighths', 'Length', { num: true }],
    ['cast', 'Speaking cast', { sort: (r) => r.cast.length }],
  ],
  characters: [
    ['name', 'Character'],
    ['speeches', 'Speeches', { num: true }],
    ['lines', 'Lines', { num: true }],
    ['words', 'Words', { num: true }],
    ['scenes', 'Scenes', { num: true }],
    ['firstPage', 'Pages', { num: true }],
    ['share', 'Share of dialogue', { num: true }],
  ],
  locations: [
    ['location', 'Location'],
    ['setting', 'INT/EXT'],
    ['times', 'Times'],
    ['count', 'Scenes', { num: true }],
    ['eighths', 'Screen time', { num: true }],
  ],
};

function sorted(rows, cols, sort) {
  if (!sort) return rows;
  const col = cols.find(([k]) => k === sort.key);
  const get = col?.[2]?.sort || ((r) => r[sort.key]);
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * dir;
  });
}

/**
 * Plan → Reports: quiet tables in the Plan workspace — Scenes, Characters, Locations, and the
 * Script at a glance. Every row leads somewhere: a scene opens in Write, a character turns on
 * their Dialogue spotlight, a location lists its scenes. Click a column to sort; .csv exports it.
 */
export default function Reports({ rows, blocks, analysis, layout, onOpenScene, onOpenCharacter, onCsv }) {
  const reports = useMemo(() => buildReports({ rows, blocks, analysis, layout }), [rows, blocks, analysis, layout]);
  const [tab, setTab] = useState('scenes');
  const [sorts, setSorts] = useState({});
  const [openLoc, setOpenLoc] = useState(null);
  const sort = sorts[tab] || null;
  const setSort = (key) => setSorts((s) => {
    const cur = s[tab];
    const num = COLUMNS[tab].find(([k]) => k === key)?.[2]?.num;
    const first = num ? 'desc' : 'asc';
    const next = !cur || cur.key !== key ? { key, dir: first } : cur.dir === first ? { key, dir: first === 'asc' ? 'desc' : 'asc' } : null;
    return { ...s, [tab]: next };
  });

  const head = (cols) => (
    <thead>
      <tr>
        {cols.map(([key, label, o]) => (
          <th key={key} className={o?.num ? 'is-num' : undefined} aria-sort={sort?.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
            <button type="button" className="rp-sort" onClick={() => setSort(key)} title={`Sort by ${label.toLowerCase()}`}>
              {label}
              {sort?.key === key && <span className="rp-dir" aria-hidden="true">{sort.dir === 'asc' ? '↑' : '↓'}</span>}
            </button>
          </th>
        ))}
      </tr>
    </thead>
  );

  const s = reports.script;
  return (
    <div className="plan-reports" role="region" aria-label="Reports">
      <div className="rp-bar">
        <div className="seg rp-tabs" role="tablist" aria-label="Report">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`seg-btn${tab === t.id ? ' is-on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="seg-label">{t.label}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn rp-csv" onClick={() => onCsv(tab, reports)} title={`This report as a spreadsheet (.csv)`}>
          <Download {...ICON} />
          .csv
        </button>
      </div>

      {tab === 'scenes' && (
        <table className="rp-table">
          {head(COLUMNS.scenes)}
          <tbody>
            {sorted(reports.scenes, COLUMNS.scenes, sort).map((r) => (
              <tr key={r.id} className="rp-row" tabIndex={0} onClick={() => onOpenScene(r.id)} onKeyDown={(e) => e.key === 'Enter' && onOpenScene(r.id)} title="Open this scene in Write">
                <td className="is-num rp-mono">{r.number}</td>
                <td className="rp-slug">{r.heading}</td>
                <td>{r.setting || <span className="rp-none">—</span>}</td>
                <td>{r.time || <span className="rp-none">—</span>}</td>
                <td className="is-num">{r.page ?? '—'}</td>
                <td className="is-num">{r.length}</td>
                <td className="rp-cast">{r.cast.length ? r.cast.join(', ') : <span className="rp-none">No one speaks</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'characters' && (reports.characters.length ? (
        <table className="rp-table">
          {head(COLUMNS.characters)}
          <tbody>
            {sorted(reports.characters, COLUMNS.characters, sort).map((c) => (
              <tr key={c.name} className="rp-row" tabIndex={0} onClick={() => onOpenCharacter(c.name)} onKeyDown={(e) => e.key === 'Enter' && onOpenCharacter(c.name)} title="Spotlight their dialogue in Write">
                <td className="rp-name">{c.name}</td>
                <td className="is-num">{c.speeches}</td>
                <td className="is-num">{c.lines}</td>
                <td className="is-num">{c.words.toLocaleString('en-US')}</td>
                <td className="is-num">{c.scenes}</td>
                <td className="is-num">{c.firstPage == null ? '—' : c.firstPage === c.lastPage ? c.firstPage : `${c.firstPage}–${c.lastPage}`}</td>
                <td className="is-num rp-share">
                  <span className="rp-bar-track" aria-hidden="true"><span className="rp-bar-fill" style={{ width: `${c.share}%` }} /></span>
                  {c.share}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="plan-empty">No one speaks yet. Characters appear here once they have a line of dialogue.</p>)}

      {tab === 'locations' && (
        <table className="rp-table">
          {head(COLUMNS.locations)}
          <tbody>
            {sorted(reports.locations, COLUMNS.locations, sort).map((l) => {
              const open = openLoc === l.location;
              return (
                <Fragment key={l.location}>
                  <tr
                    className={`rp-row${open ? ' is-open' : ''}`}
                    tabIndex={0}
                    aria-expanded={open}
                    onClick={() => setOpenLoc(open ? null : l.location)}
                    onKeyDown={(e) => e.key === 'Enter' && setOpenLoc(open ? null : l.location)}
                    title="Show the scenes set here"
                  >
                    <td className="rp-slug">
                      <span className="rp-slug-in">
                        {open ? <ChevronDown {...ICON} /> : <ChevronRight {...ICON} />}
                        {l.location}
                      </span>
                    </td>
                    <td>{l.setting || <span className="rp-none">—</span>}</td>
                    <td>{l.times || <span className="rp-none">—</span>}</td>
                    <td className="is-num">{l.count}</td>
                    <td className="is-num">{l.length}</td>
                  </tr>
                  {open && (
                    <tr className="rp-sub">
                      <td colSpan={5}>
                        {l.scenes.map((sc) => (
                          <button key={sc.id} type="button" className="pill rp-scene" onClick={() => onOpenScene(sc.id)} title="Open this scene in Write">
                            Scene {sc.number}
                          </button>
                        ))}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      {tab === 'script' && (
        <dl className="rp-facts">
          <div><dt>Pages</dt><dd>{s.pages}</dd></div>
          <div><dt>Scenes</dt><dd>{s.scenes}</dd></div>
          <div><dt>Words</dt><dd>{s.words.toLocaleString('en-US')}</dd></div>
          <div><dt>Speaking characters</dt><dd>{s.speaking}</dd></div>
          <div><dt>Dialogue · Action</dt><dd>{s.dialogueShare}% · {100 - s.dialogueShare}%<small>{s.dialogueWords.toLocaleString('en-US')} · {s.actionWords.toLocaleString('en-US')} words</small></dd></div>
          <div><dt>Interior · Exterior</dt><dd>{s.interior} · {s.exterior}<small>scenes</small></dd></div>
          <div><dt>Day · Night</dt><dd>{s.day} · {s.night}<small>scenes</small></dd></div>
          <div><dt>Average scene</dt><dd>{s.averageLength}<small>pages</small></dd></div>
          {s.longest && (
            <div className="rp-wide">
              <dt>Longest scene</dt>
              <dd>
                <button type="button" className="rp-link" onClick={() => onOpenScene(s.longest.id)}>
                  {s.longest.number}. {s.longest.heading}
                </button>
                <small>{s.longest.length} pages</small>
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
