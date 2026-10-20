import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AutoTextarea from './AutoTextarea.jsx';
import Menu from './Menu.jsx';
import SceneRangeModal from './SceneRangeModal.jsx';
import {
  TAGS, actPacing, byAct, formatPageTargets, formatPercentTargets, moveBeat, newBeat, populateByPages, populateByRanges, structureFor,
} from '../lib/beats.js';
import './BeatBoard.css';

/**
 * Beat Board: act columns of index cards (3-Act or 4-Act view of the same cards). Drag cards by their grip (native
 * HTML5 drag-and-drop) to reorder within a column or move across acts. With the
 * grip focused, arrow keys move a card too.
 */

const BeatCard = memo(function BeatCard({
  beat, number, scene, isDragging, onField, onDelete, onDragStart, onDragEnd, onKeyMove, onJump, autoFocus,
}) {
  const cardRef = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    if (autoFocus) titleRef.current?.focus();
  }, [autoFocus]);

  return (
    <article
      ref={cardRef}
      data-beat={beat.id}
      className={`card tag-${beat.tag || 'none'}${isDragging ? ' is-dragging' : ''}${scene ? ' is-linked' : ''}`}
      title={scene ? `Click to go to scene ${scene.number} (p. ${scene.page})` : undefined}
      onClick={(e) => {
        // A scene card jumps to its scene — unless you clicked into its text or a control.
        if (scene && !e.target.closest('textarea, input, button')) onJump(scene.id);
      }}
    >
      <header className="card-head">
        <button
          className="card-grip"
          data-grip={beat.id}
          draggable
          aria-label={`Move beat ${number}. Drag, or use arrow keys.`}
          title="Drag to move · arrow keys also move"
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', beat.id);
            const r = cardRef.current.getBoundingClientRect();
            e.dataTransfer.setDragImage(cardRef.current, e.clientX - r.left, e.clientY - r.top);
            onDragStart(beat.id);
          }}
          onDragEnd={onDragEnd}
          onKeyDown={(e) => {
            const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
            if (dir) {
              e.preventDefault();
              onKeyMove(beat.id, dir);
            }
          }}
        >
          <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
            {[2, 7, 12].map((y) => (
              <g key={y}><circle cx="2.5" cy={y} r="1.3" /><circle cx="7.5" cy={y} r="1.3" /></g>
            ))}
          </svg>
        </button>
        <span className="card-num">{number}</span>
        <AutoTextarea
          ref={titleRef}
          fitOnResize
          className="card-title"
          value={beat.title}
          placeholder="Beat headline"
          aria-label="Beat headline"
          onChange={(e) => onField(beat.id, 'title', e.target.value.replace(/\n/g, ' '))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              cardRef.current.querySelector('.card-syn')?.focus();
            }
          }}
        />
        <button className="card-del" onClick={() => onDelete(beat.id)} aria-label="Delete beat" title="Delete beat">
          ×
        </button>
      </header>
      <AutoTextarea
        fitOnResize
        className="card-syn"
        value={beat.synopsis}
        placeholder="What happens — and what it means emotionally…"
        aria-label="Synopsis"
        onChange={(e) => onField(beat.id, 'synopsis', e.target.value)}
      />
      <footer className="card-foot" role="radiogroup" aria-label="Tag">
        {beat.sceneId && (
          scene ? (
            <button
              type="button"
              className="card-scene"
              onClick={() => onJump(scene.id)}
              title={`Go to scene ${scene.number}: ${scene.heading}`}
            >
              Sc {scene.number} · p. {scene.page} <span aria-hidden="true">↗</span>
            </button>
          ) : (
            <span className="card-scene is-gone" title="This card’s scene heading was deleted">Scene removed</span>
          )
        )}
        {TAGS.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={beat.tag === t.id}
            className={`tag-dot tag-${t.id}${beat.tag === t.id ? ' is-on' : ''}`}
            title={t.label}
            onClick={() => onField(beat.id, 'tag', beat.tag === t.id ? null : t.id)}
          >
            {beat.tag === t.id && <span className="tag-name">{t.label}</span>}
          </button>
        ))}
      </footer>
    </article>
  );
});

const MODES = [
  { id: 3, label: '3 Acts' },
  { id: 4, label: '4 Acts' },
];

export default function BeatBoard({
  beats, onChange, onMoveCard, onExport, compact, actMode = 4, onActModeChange, scenes = [], pageCount = 1, onJump,
}) {
  const [dragId, setDragId] = useState(null);
  const [drop, setDrop] = useState(null); // { act, index } — act is always one of the four underlying acts
  const [focusId, setFocusId] = useState(null);
  const [undo, setUndo] = useState(null); // { message, beats? } — the toast; `beats` is what Undo restores
  const [rangesOpen, setRangesOpen] = useState(false);
  const beatsRef = useRef(beats);
  const structureRef = useRef(null);
  const pendingGrip = useRef(null);
  const boardRef = useRef(null);

  const structure = structureFor(actMode);

  useEffect(() => {
    beatsRef.current = beats;
    structureRef.current = structure;
    if (pendingGrip.current) {
      boardRef.current?.querySelector(`[data-grip="${pendingGrip.current}"]`)?.focus();
      pendingGrip.current = null;
    }
  });

  useEffect(() => {
    if (!undo) return undefined;
    const t = setTimeout(() => setUndo(null), undo.beats ? 8000 : 4000);
    return () => clearTimeout(t);
  }, [undo]);

  const sceneById = new Map(scenes.map((s) => [s.id, s]));

  const acts = byAct(beats);
  const numberOf = {};
  let n = 0;
  for (const col of acts) for (const b of col) numberOf[b.id] = ++n;

  const onField = useCallback((id, key, value) => {
    onChange(beatsRef.current.map((b) => (b.id === id ? { ...b, [key]: value } : b)));
  }, [onChange]);

  const onDelete = useCallback((id) => {
    const cur = beatsRef.current;
    const at = cur.findIndex((b) => b.id === id);
    if (at < 0) return;
    setUndo({ message: `Deleted “${cur[at].title || 'Untitled beat'}”`, beats: cur });
    onChange(cur.filter((b) => b.id !== id));
  }, [onChange]);

  const undoLast = () => {
    if (!undo?.beats) return;
    onChange(undo.beats);
    setUndo(null);
  };

  // ---- Populate from Script ----
  const applyPopulate = (result, how) => {
    if (result.error) {
      setUndo({ message: result.error });
      return;
    }
    const prev = beatsRef.current;
    onChange(result.beats);
    const parts = [`${scenes.length} scene ${scenes.length === 1 ? 'card' : 'cards'} ${how}`];
    if (result.updated) parts.push(`${result.updated} kept your edits`);
    if (result.kept) parts.push(`${result.kept} of your own kept`);
    setUndo({ message: parts.join(' · '), beats: prev });
  };

  const populateByTargets = () => {
    if (!scenes.length) {
      setUndo({ message: 'No scene headings yet — write a few scenes first' });
      return;
    }
    applyPopulate(populateByPages(beatsRef.current, scenes, actMode, pageCount), 'placed by page targets');
  };

  const openRanges = () => {
    if (!scenes.length) {
      setUndo({ message: 'No scene headings yet — write a few scenes first' });
      return;
    }
    setRangesOpen(true);
  };

  /**
   * 3 ↔ 4 Acts never moves a card: each one remembers its Act 2 lane (2A / 2B), so the
   * Midpoint you set in one view is exactly where 2A ends in the other.
   */
  const changeMode = (mode) => {
    if (mode !== actMode) onActModeChange(mode);
  };

  // Pacing badges: pages and share of the script per column, from the scene cards in it.
  const pacing = useMemo(() => actPacing(beats, scenes, actMode), [beats, scenes, actMode]);

  // Act targets come from the script's real length: 25 / 50 / 25 % (3 acts) or 25 % each (4 acts).
  const targets = formatPageTargets(actMode, pageCount);
  const populateItems = [
    { heading: `${actMode} Acts · ${scenes.length} ${scenes.length === 1 ? 'scene' : 'scenes'} · ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}` },
    { label: 'Auto-Distribute (% Targets)', hint: formatPercentTargets(actMode), sub: targets, onSelect: populateByTargets },
    { label: 'Manual Scene Ranges…', sub: 'Type the scene numbers for each act', onSelect: openRanges },
  ];

  const addBeat = (act) => {
    const b = newBeat(act);
    onChange([...beatsRef.current, b]);
    setFocusId(b.id);
  };

  const onDragStart = useCallback((id) => {
    // Defer so the browser snapshots the card before it dims.
    requestAnimationFrame(() => setDragId(id));
  }, []);
  const onDragEnd = useCallback(() => {
    setDragId(null);
    setDrop(null);
  }, []);

  /**
   * Arrow keys on a card's grip. Up/down reorder within a column — in the 3-Act
   * "Act 2" column that includes stepping across the midpoint (2A ↔ 2B). Left/right
   * move to the neighbouring column at the same height.
   */
  const onKeyMove = useCallback((id, dir) => {
    const cur = beatsRef.current;
    const cols = structureRef.current;
    const card = cur.find((b) => b.id === id);
    const byA = byAct(cur);
    const ci = cols.findIndex((c) => c.acts.includes(card.act));
    const segs = cols[ci].acts;
    const k = segs.indexOf(card.act);
    const seg = byA[card.act];
    const idx = seg.indexOf(card);
    let act = card.act;
    let index;

    if (dir === 'up') {
      if (idx > 0) index = idx - 1;
      else if (k > 0) { act = segs[k - 1]; index = byA[act].length; } else return;
    } else if (dir === 'down') {
      if (idx < seg.length - 1) index = idx + 1;
      else if (k < segs.length - 1) { act = segs[k + 1]; index = 0; } else return;
    } else {
      const nci = ci + (dir === 'left' ? -1 : 1);
      if (nci < 0 || nci >= cols.length) return;
      const target = cols[nci].acts;
      act = dir === 'left' ? target[target.length - 1] : target[0];
      index = Math.min(idx, byA[act].length);
    }
    pendingGrip.current = id;
    if (onMoveCard) onMoveCard(id, act, index);
    else onChange(moveBeat(cur, id, act, index));
  }, [onChange, onMoveCard]);

  /** Which underlying act and position the pointer is over inside a column. */
  const dropTargetFor = (colEl, colDef, clientY) => {
    let act = colDef.acts[0];
    if (colDef.acts.length > 1) {
      const r = colEl.querySelector('.midpoint').getBoundingClientRect();
      act = clientY < r.top + r.height / 2 ? colDef.acts[0] : colDef.acts[1];
    }
    const slots = [...colEl.querySelectorAll(`.card-slot[data-act="${act}"]`)]
      .filter((el) => el.dataset.id !== dragId);
    let index = 0;
    for (const el of slots) {
      const r = el.getBoundingClientRect();
      if (clientY > r.top + r.height / 2) index++;
    }
    return { act, index };
  };

  const exportItems = [
    { label: 'Fountain outline', hint: '.fountain', onSelect: () => onExport('fountain') },
    { label: 'Markdown', hint: '.md', onSelect: () => onExport('md') },
  ];

  const dropLine = <div className="drop-line" />;

  return (
    <section className={`board${compact ? ' is-compact' : ''}`} ref={boardRef} aria-label="Beat Board">
      <header className="board-head">
        <div className="board-title">
          <h2>Beat Board</h2>
          <p className="board-sub">
            {beats.length} {beats.length === 1 ? 'beat' : 'beats'} · drag cards by the grip to restructure
          </p>
        </div>
        <div className="board-tools">
          <div className="seg seg-sm" role="radiogroup" aria-label="Act structure">
            {MODES.map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={actMode === m.id}
                className={`seg-btn${actMode === m.id ? ' is-on' : ''}`}
                onClick={() => changeMode(m.id)}
                title={m.id === 3
                  ? 'Act 1 · Act 2 (2A + 2B around the midpoint) · Act 3'
                  : 'Act 1 · Act 2A · Act 2B · Act 3'}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="board-legend" aria-hidden="true">
            {TAGS.map((t) => (
              <span key={t.id} className="legend-item"><span className={`legend-dot tag-${t.id}`} />{t.label}</span>
            ))}
          </div>
          <Menu
            label="Populate from Script"
            items={populateItems}
            align="right"
            className="btn btn-outline"
            title="Make a card for every scene and place them in act columns"
          />
          <Menu label="Export Outline" items={exportItems} align="right" className="btn btn-outline" />
        </div>
      </header>

      <div className="board-cols" style={{ '--cols': structure.length }}>
        {structure.map((colDef, ci) => {
          const pace = pacing[ci];
          const count = colDef.acts.reduce((t, a) => t + acts[a].length, 0);
          const over = !!(dragId && drop && colDef.acts.includes(drop.act));
          return (
            <div
              key={colDef.label}
              className={`col${over ? ' is-over' : ''}`}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const t = dropTargetFor(e.currentTarget, colDef, e.clientY);
                if (!drop || drop.act !== t.act || drop.index !== t.index) setDrop(t);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget) && drop && colDef.acts.includes(drop.act)) setDrop(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = dragId || e.dataTransfer.getData('text/plain');
                if (id && drop) {
                  // A scene card moves its scene in the script too (App → sceneSync.js).
                  if (onMoveCard) onMoveCard(id, drop.act, drop.index);
                  else onChange(moveBeat(beatsRef.current, id, drop.act, drop.index));
                }
                setDragId(null);
                setDrop(null);
              }}
            >
              <header className="col-head">
                <span className="col-act">{colDef.label}</span>
                <span className="col-name">{colDef.name}</span>
                <span className="col-count">{count}</span>
                {pace && (
                  <span className={`col-pace is-${pace.status}`} title={pace.note}>
                    {(pace.status === 'long' || pace.status === 'short') && <span className="pace-dot" aria-hidden="true" />}
                    {pace.status === 'none' ? '— pgs · 0%' : pace.label}
                    {(pace.status === 'long' || pace.status === 'short') && <span className="sr-only"> — {pace.note}</span>}
                  </span>
                )}
              </header>
              <div className="col-list">
                {colDef.acts.map((a, si) => {
                  const segCards = acts[a];
                  const visible = segCards.filter((b) => b.id !== dragId);
                  const dropSeg = !!(dragId && drop && drop.act === a);
                  return (
                    <Fragment key={a}>
                      {si > 0 && (
                        <div className="midpoint" title="Cards above are Act 2A, below are Act 2B">
                          <span>Midpoint</span>
                        </div>
                      )}
                      {segCards.map((b) => {
                        const vi = visible.indexOf(b);
                        return (
                          <div key={b.id} className="card-slot" data-act={a} data-id={b.id}>
                            {dropSeg && vi >= 0 && vi === drop.index && dropLine}
                            <BeatCard
                              beat={b}
                              number={numberOf[b.id]}
                              scene={b.sceneId ? sceneById.get(b.sceneId) || null : null}
                              onJump={onJump}
                              isDragging={b.id === dragId}
                              onField={onField}
                              onDelete={onDelete}
                              onDragStart={onDragStart}
                              onDragEnd={onDragEnd}
                              onKeyMove={onKeyMove}
                              autoFocus={b.id === focusId}
                            />
                          </div>
                        );
                      })}
                      {dropSeg && drop.index >= visible.length && dropLine}
                    </Fragment>
                  );
                })}
                {count === 0 && !over && <p className="col-empty">No beats yet</p>}
                <button className="col-add" onClick={() => addBeat(colDef.acts[colDef.acts.length - 1])}>+ Add Beat</button>
              </div>
            </div>
          );
        })}
      </div>

      {undo && (
        <div className="board-undo" role="status">
          {undo.message}
          {undo.beats && <button className="btn" onClick={undoLast}>Undo</button>}
        </div>
      )}

      {rangesOpen && (
        <SceneRangeModal
          mode={actMode}
          scenes={scenes}
          pageCount={pageCount}
          onClose={() => setRangesOpen(false)}
          onApply={(inputs) => {
            setRangesOpen(false);
            applyPopulate(populateByRanges(beatsRef.current, scenes, actMode, inputs, pageCount), 'placed by scene ranges');
          }}
        />
      )}
    </section>
  );
}
