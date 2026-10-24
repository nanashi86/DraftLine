// The body of Snapshots → Compare: the rows of a script comparison (lib/scriptDiff.js), drawn
// either inline (one column: deletions struck through in red, additions highlighted in green)
// or side by side (the snapshot on the left, the current draft on the right).
//
// Plain createElement rather than JSX so node:test can render it as is (react-dom/server).
// Read-only: it shows copies of text; the only thing it can do is open a folded stretch.

import { createElement as h, Fragment } from 'react';
import { ELEMENT_META } from '../lib/screenplay.js';

export const COMPARE_MODES = ['unified', 'split'];

const label = (type) => ELEMENT_META[type]?.label || 'Element';
const MARK = { add: '+', del: '−', change: '~', same: '' };
const SAYS = { add: 'Added: ', del: 'Deleted: ', change: 'Changed: ', same: '' };

/** One element's text, as screenplay type, made of [{ op, text }] pieces. */
function element(type, pieces, key) {
  const empty = pieces.every((p) => !p.text.trim());
  return h(
    'div',
    { className: `df-el df-${ELEMENT_META[type] ? type : 'action'}`, key },
    empty
      ? h('span', { className: 'df-empty' }, '(empty)')
      : pieces.map((p, i) => (p.op === 'del'
        ? h('del', { key: i }, p.text)
        : p.op === 'add'
          ? h('ins', { key: i }, p.text)
          : h(Fragment, { key: i }, p.text))),
  );
}

const retype = (row) => (row.typeChanged
  ? h('span', { className: 'df-retype' }, `${label(row.old.type)} → ${label(row.new.type)}`)
  : null);

/** Pieces for one side of a row: the snapshot's ('old') or the current draft's ('new'). */
function sidePieces(row, side) {
  if (row.kind === 'change') return row.words.filter((p) => p.op === 'eq' || p.op === (side === 'old' ? 'del' : 'add'));
  const b = row[side];
  if (row.kind === 'del') return [{ op: 'del', text: b.text }];
  if (row.kind === 'add') return [{ op: 'add', text: b.text }];
  return [{ op: 'eq', text: b.text }];
}

function fold(r, onOpenFold) {
  return h(
    'button',
    {
      type: 'button',
      className: 'df-fold',
      key: `fold-${r.from}`,
      'data-from': r.from,
      onClick: onOpenFold ? () => onOpenFold(r.from) : undefined,
    },
    `${r.count.toLocaleString('en-US')} unchanged ${r.count === 1 ? 'element' : 'elements'} · Show`,
  );
}

function unifiedRow(r) {
  const b = r.new || r.old;
  const pieces = r.kind === 'change' ? r.words : sidePieces(r, r.new ? 'new' : 'old');
  return h(
    'div',
    { className: `df-row is-${r.kind}`, key: r.index, 'data-kind': r.kind },
    h('span', { className: 'df-mark', 'aria-hidden': 'true' }, MARK[r.kind]),
    h(
      'div',
      { className: 'df-cell' },
      SAYS[r.kind] && h('span', { className: 'sr-only' }, SAYS[r.kind]),
      retype(r),
      element(b.type, pieces),
    ),
  );
}

function side(r, which) {
  const b = r[which];
  if (!b) return h('div', { className: `df-side is-${which} is-blank`, 'aria-hidden': 'true' });
  const says = r.kind === 'change' ? (which === 'old' ? 'Before: ' : 'After: ') : SAYS[r.kind];
  return h(
    'div',
    { className: `df-side is-${which}` },
    says && h('span', { className: 'sr-only' }, says),
    which === 'new' ? retype(r) : null,
    element(b.type, sidePieces(r, which)),
  );
}

function splitRow(r) {
  return h(
    'div',
    { className: `df-row df-pair is-${r.kind}`, key: r.index, 'data-kind': r.kind },
    side(r, 'old'),
    h('span', { className: 'df-mark', 'aria-hidden': 'true' }, MARK[r.kind]),
    side(r, 'new'),
  );
}

/**
 * rows: foldRows(diffScripts(…).rows) — elements plus { kind: 'fold' } markers.
 * mode: 'unified' | 'split'. oldLabel / newLabel name the two sides (split view's headings).
 */
export function CompareRows({ rows, mode = 'unified', oldLabel = 'Snapshot', newLabel = 'Current draft', onOpenFold }) {
  const split = mode === 'split';
  return h(
    'div',
    { className: `df-rows is-${split ? 'split' : 'unified'}`, 'data-mode': split ? 'split' : 'unified' },
    split && h(
      'div',
      { className: 'df-row df-pair df-heads', 'aria-hidden': 'true' },
      h('div', { className: 'df-side is-old' }, oldLabel),
      h('span', { className: 'df-mark' }),
      h('div', { className: 'df-side is-new' }, newLabel),
    ),
    rows.map((r) => (r.kind === 'fold' ? fold(r, onOpenFold) : split ? splitRow(r) : unifiedRow(r))),
  );
}
