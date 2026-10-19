import TitlePageSheet from './TitlePageSheet.jsx';
import FormattedText from './FormattedText.jsx';
import { pageLabel } from '../lib/screenplay.js';
import './PrintView.css';

function PrintBlock({ block, sceneNumber, style }) {
  return (
    <div className={`el el-${block.type}`} style={style}>
      {sceneNumber != null && (
        <>
          <span className="scene-no scene-no-left">{sceneNumber}</span>
          <span className="scene-no scene-no-right">{sceneNumber}</span>
        </>
      )}
      <FormattedText className="el-text" text={block.text || '\u00A0'} marks={block.marks} />
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
export default function PrintView({ meta, items, layout, sceneNumbers }) {
  const pages = Array.from({ length: layout.pageCount }, () => []);
  items.forEach((it, k) => {
    const p = layout.place[k];
    if (p) pages[Math.min(p.page, pages.length - 1)].push(k);
  });

  return (
    <div className="print-root">
      {hasTitlePage(meta) && <TitlePageSheet meta={meta} className="print-page print-title" />}

      {pages.map((ks, p) => (
        <section className="print-page" key={p}>
          {p > 0 && <span className="print-page-no">{pageLabel(p)}</span>}
          {ks.map((k, n) => {
            const it = items[k];
            const pl = layout.place[k];
            const prev = n > 0 ? layout.place[ks[n - 1]] : null;
            const gap = prev ? pl.topLine - prev.topLine - prev.lines : pl.topLine;
            const style = gap > 0 ? { marginTop: `calc(var(--line) * ${gap})` } : undefined;
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
            return <PrintBlock key={it.key} block={it.block} sceneNumber={sceneNumbers[it.key]} style={style} />;
          })}
        </section>
      ))}
    </div>
  );
}
