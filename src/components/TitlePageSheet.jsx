import { basedOnLine } from '../lib/fountain.js';
import { DEFAULT_CREDIT, draftLines, titleStyle, titleTypography } from '../lib/titleFonts.js';
import { RichLine } from './FormattedText.jsx';
import './TitlePageSheet.css';

/**
 * The title page ("Page 0"), laid out in true page units. Everything is sized from
 * `--in` (one inch), so the same component renders the full-size cover in the editor
 * canvas, the printed / PDF cover (--in: 1in) and the miniature in the Title Page modal.
 * Fields may use Markdown emphasis (**bold**, *italic*, _underline_, ~~strike~~).
 */
export default function TitlePageSheet({ meta, className = '' }) {
  const { size } = titleTypography(meta);
  const titleCss = { ...titleStyle(meta), fontSize: `calc(var(--in) * ${size / 72})` };
  const credit = (meta.credit ?? DEFAULT_CREDIT).trim();
  const author = meta.author?.trim();
  const draft = draftLines(meta); // version above date; a blank one simply isn't rendered

  return (
    <section className={`title-sheet ${className}`} aria-label="Title page">
      <div className="ts-center">
        <div className="ts-title" style={titleCss}><RichLine text={meta.title?.trim() || 'Untitled'} /></div>
        {author && (
          <>
            {credit && <div className="ts-credit"><RichLine text={credit} /></div>}
            <div className="ts-author"><RichLine text={author} /></div>
          </>
        )}
        {meta.basedOn?.trim() && <div className="ts-source"><RichLine text={basedOnLine(meta.basedOn)} /></div>}
      </div>
      {meta.contact?.trim() && <div className="ts-contact"><RichLine text={meta.contact.trim()} /></div>}
      {draft.length > 0 && (
        <div className="ts-draft">
          {draft.map((line, i) => <div key={i}><RichLine text={line} /></div>)}
        </div>
      )}
    </section>
  );
}
