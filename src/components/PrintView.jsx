import TitlePageSheet from './TitlePageSheet.jsx';
import FormattedText from './FormattedText.jsx';
import { pageLabel } from '../lib/screenplay.js';
import './PrintView.css';

/**
 * One element — or, at a page seam, one page's piece of it: "NAME (CONT'D)" above, "(MORE)" below,
 * and for a dialogue paragraph split mid-way, only lines [from, to) of it (the same clipping the
 * editor uses, so print matches the screen line for line).
 */
function PrintBlock({ block, sceneNumber, style, piece = null, split = false }) {
  return (
    <div className={`el el-${block.type}`} style={style}>
      {piece?.cont && <div className="el-seam el-contd">{piece.cont}</div>}
      {sceneNumber != null && (
        <>
          <span className="scene-no scene-no-left">{sceneNumber}</span>
          <span className="scene-no scene-no-right">{sceneNumber}</span>
        </>
      )}
      <div className="el-clip" style={split ? { height: `calc(var(--line) * ${piece.to - piece.from})`, overflow: 'hidden' } : undefined}>
        <FormattedText
          className="el-text"
          text={block.text || '\u00A0'}
          marks={block.marks}
          style={split && piece.from ? { marginTop: `calc(var(--line) * ${-piece.from})` } : undefined}
        />
      </div>
      {piece?.more && <div className="el-seam el-more">(MORE)</div>}
    </div>
  );
}

function hasTitlePage(meta) {
  return ['title', 'author', 'basedOn', 'contact', 'draftVersion', 'draftDate'].some((k) => meta[k]?.trim());
}

/**
 * Print-only rendering of the script, laid out with the same pagination the editor
 * shows. Mounted just before printing (see App) so it costs nothing while writing.
 * The title page prints first as "page 0" (unnumbered); numbering starts on page 2.
 */
export default function PrintView({ meta, items, layout, sceneNumbers, showSceneNumbers = true }) {
  // Each page lists the pieces on it: [item index, piece] (piece null for an element in one piece).
  const pages = Array.from({ length: layout.pageCount }, () => []);
  items.forEach((it, k) => {
    const p = layout.place[k];
    if (!p) return;
    for (const pc of p.pieces || [null]) pages[Math.min((pc || p).page, pages.length - 1)].push([k, pc]);
  });
  // Where a piece starts (its CONT'D line included) and ends (its MORE line included), in page lines.
  const startOf = (k, pc) => (pc ? pc.topLine - (pc.cont ? 1 : 0) : layout.place[k].topLine);
  const endOf = (k, pc) => (pc ? pc.topLine + (pc.to - pc.from) + (pc.more ? 1 : 0) : layout.place[k].topLine + layout.place[k].lines);

  return (
    // Scene numbers follow File → PDF's "Include Scene Numbers" setting; hidden by the print stylesheet when off.
    <div className={`print-root${showSceneNumbers ? '' : ' hide-print-scene-numbers'}`}>
      {hasTitlePage(meta) && <TitlePageSheet meta={meta} className="print-page print-title" />}

      {pages.map((ks, p) => (
        <section className="print-page" key={p}>
          {p > 0 && <span className="print-page-no">{pageLabel(p)}</span>}
          {ks.map(([k, pc], n) => {
            const it = items[k];
            const gap = n > 0 ? startOf(k, pc) - endOf(...ks[n - 1]) : startOf(k, pc);
            const style = gap > 0 ? { marginTop: `calc(var(--line) * ${gap})` } : undefined;
            const split = (layout.place[k].pieces?.length || 0) > 1;
            if (it.kind === 'dual') {
              return (
                <div key={it.key} className="dual-row" style={style}>
                  <div className="dual-col">
                    {it.left.map((b) => <PrintBlock key={b.id} block={b} />)}
                  </div>
                  <div className="dual-col">
                    {it.right.map((b) => <PrintBlock key={b.id} block={b} />)}
                  </div>
                </div>
              );
            }
            return (
              <PrintBlock
                key={`${it.key}#${pc ? pc.from : 0}`}
                block={it.block}
                sceneNumber={!pc || pc.from === 0 ? sceneNumbers[it.key] : undefined}
                style={style}
                piece={pc}
                split={split}
              />
            );
          })}
        </section>
      ))}
    </div>
  );
}
