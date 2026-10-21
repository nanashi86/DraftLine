import { basedOnLine } from '../lib/fountain.js';
import { DEFAULT_CREDIT, draftLines, titleStyle, titleTypography } from '../lib/titleFonts.js';
import { RichLine } from './FormattedText.jsx';
import { SPEC_STAMP_TEXT } from '../lib/specStamp.js';
import { AUTHOR_PLACEHOLDER, CONTACT_PLACEHOLDER } from '../lib/authorDefaults.js';
import './TitlePageSheet.css';

/**
 * The title page ("Page 0"), laid out in true page units. Everything is sized from
 * `--in` (one inch), so the same component renders the full-size cover in the editor
 * canvas, the printed / PDF cover (--in: 1in) and the miniature in the Title Page modal.
 * Fields may use Markdown emphasis (**bold**, *italic*, _underline_, ~~strike~~).
 */
/** The Spec Stamp (Title Page → "Spec stamp"): an on-screen joke, never printed (PrintView doesn't pass it). */
export { SPEC_STAMP_TEXT };

/**
 * `placeholders` (the on-screen cover and the Title Page preview, never print): an empty author or
 * contact shows Chilli Palmer's, faint — placeholder text, not part of the script.
 */
export default function TitlePageSheet({ meta, className = '', specStamp = false, placeholders = false }) {
  const { size } = titleTypography(meta);
  const titleCss = { ...titleStyle(meta), fontSize: `calc(var(--in) * ${size / 72})` };
  const credit = (meta.credit ?? DEFAULT_CREDIT).trim();
  const typedAuthor = meta.author?.trim();
  const author = typedAuthor || (placeholders ? AUTHOR_PLACEHOLDER : '');
  const typedContact = meta.contact?.trim();
  const contact = typedContact || (placeholders ? CONTACT_PLACEHOLDER : '');
  const draft = draftLines(meta); // version above date; a blank one simply isn't rendered

  return (
    <section className={`title-sheet ${className}`} aria-label="Title page">
      {specStamp && <div className="ts-spec-stamp" aria-hidden="true">{SPEC_STAMP_TEXT}</div>}
      <div className="ts-center">
        <div className="ts-title" style={titleCss}><RichLine text={meta.title?.trim() || 'Untitled'} /></div>
        {author && (
          <>
            {credit && <div className="ts-credit"><RichLine text={credit} /></div>}
            <div className={`ts-author${typedAuthor ? '' : ' is-placeholder'}`}><RichLine text={author} /></div>
          </>
        )}
        {meta.basedOn?.trim() && <div className="ts-source"><RichLine text={basedOnLine(meta.basedOn)} /></div>}
      </div>
      {/* No phone auto-linking or translating here (see also index.html's format-detection meta). Keyed
          by its text, so a changed contact gets a fresh element: anything a browser extension injected
          into the old one (click-to-call links, icons) goes with it instead of lingering. */}
      {contact && (
        <div key={contact} className={`ts-contact${typedContact ? '' : ' is-placeholder'}`} data-no-autolink="true" translate="no">
          <RichLine text={contact} />
        </div>
      )}
      {draft.length > 0 && (
        <div className="ts-draft">
          {draft.map((line, i) => <div key={i}><RichLine text={line} /></div>)}
        </div>
      )}
    </section>
  );
}
