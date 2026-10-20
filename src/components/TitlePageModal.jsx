import { useEffect, useRef, useState } from 'react';
import TitlePageSheet from './TitlePageSheet.jsx';
import {
  CREDIT_SUGGESTIONS,
  DRAFT_VERSIONS,
  DEFAULT_CREDIT,
  DEFAULT_TITLE_BOLD,
  DEFAULT_TITLE_FONT,
  DEFAULT_TITLE_SIZE,
  TITLE_FONTS,
  TITLE_FONT_GROUPS,
  TITLE_SIZES,
  titleStyle,
  titleTypography,
} from '../lib/titleFonts.js';
import { titlePageSeed } from '../lib/authorDefaults.js';
import './TitlePageModal.css';

const FIELDS = [
  { key: 'title', label: 'Title', placeholder: 'The Last Ferry' },
  { key: 'credit', label: 'Credit / Subtitle', placeholder: DEFAULT_CREDIT, list: 'tp-credits' },
  { key: 'author', label: 'Author', placeholder: 'Your name' },
  { key: 'basedOn', label: 'Based on', placeholder: 'the novel by …  (optional)' },
  { key: 'draftVersion', label: 'Draft Version', placeholder: 'e.g. First Draft, Sixth & Final Draft', list: 'tp-versions' },
  { key: 'draftDate', label: 'Draft date', placeholder: 'e.g. October 19, 2026' },
  { key: 'contact', label: 'Contact / Copyright', placeholder: 'Name\nEmail · Phone\n© 2026', multiline: true },
];

/** Form for the title page, with a live miniature of how it will print. */
export default function TitlePageModal({ meta, onSave, onClose, onViewCover }) {
  const dialogRef = useRef(null);
  // A title page with no author and no contact yet starts from the writer's defaults.
  const [seed] = useState(() => titlePageSeed(meta));
  const [form, setForm] = useState(() => ({
    title: meta.title || '',
    credit: meta.credit ?? DEFAULT_CREDIT,
    author: seed.meta.author || '',
    basedOn: meta.basedOn || '',
    draftVersion: meta.draftVersion || '',
    draftDate: meta.draftDate || '',
    contact: seed.meta.contact || '',
    titleFont: meta.titleFont || DEFAULT_TITLE_FONT,
    titleSize: meta.titleSize || DEFAULT_TITLE_SIZE,
    titleBold: meta.titleBold ?? DEFAULT_TITLE_BOLD,
  }));
  const type = titleTypography(form);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <dialog
      ref={dialogRef}
      className="tp-modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <form className="tp-body" onSubmit={submit}>
        <div className="tp-form">
          <h2>Title Page</h2>
          <p className="tp-sub">Prints as the cover page and is included in .fountain and .fdx exports.</p>
          {FIELDS.slice(0, 1).map((f) => (
            <label key={f.key} className="tp-field">
              <span>{f.label}</span>
              {f.multiline ? (
                <textarea rows={4} value={form[f.key]} placeholder={f.placeholder} onChange={set(f.key)} />
              ) : (
                <input
                  value={form[f.key]}
                  placeholder={f.placeholder}
                  onChange={set(f.key)}
                  autoFocus={f.key === 'title'}
                />
              )}
            </label>
          ))}
          <div className="tp-field tp-font">
            <div className="tp-type-row">
              <label className="tp-control tp-grow">
                <span>Title Font</span>
                <select id="tp-font-select" value={form.titleFont} onChange={set('titleFont')}>
                  {TITLE_FONT_GROUPS.map((g, gi) => (
                    <optgroup key={g} label={g}>
                      {TITLE_FONTS.filter((f) => f.group === gi).map((f) => (
                        <option key={f.id} value={f.id} style={{ fontFamily: f.family }}>
                          {f.label} — {f.note}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="tp-control">
                <span>Title Size</span>
                <select
                  id="tp-size-select"
                  value={form.titleSize}
                  onChange={(e) => setForm((f) => ({ ...f, titleSize: Number(e.target.value) }))}
                >
                  {TITLE_SIZES.map((sz) => <option key={sz.pt} value={sz.pt}>{sz.label}</option>)}
                </select>
              </label>
              <div className="tp-control">
                <span>Bold</span>
                <button
                  type="button"
                  className={`tp-bold${type.bold ? ' is-on' : ''}`}
                  aria-pressed={type.bold}
                  aria-label="Bold title"
                  disabled={!type.font.bold}
                  title={type.font.bold ? `Bold (${type.font.bold})` : `${type.font.label} has a single weight`}
                  onClick={() => setForm((f) => ({ ...f, titleBold: !type.bold }))}
                >
                  B
                </button>
              </div>
            </div>
            <div
              className="tp-specimen"
              style={{ ...titleStyle(form, 1, 'px'), fontSize: `${Math.min(44, Math.max(18, type.size))}px`, textDecoration: 'none' }}
            >
              {form.title || 'Untitled'}
            </div>
            <span className="tp-note">
              {type.font.bold ? '' : `${type.font.label} comes in one weight, so Bold is off. `}
              Title only — the script itself stays Courier Prime 12pt.
            </span>
          </div>
          {FIELDS.slice(1).map((f) => (
            <label key={f.key} className="tp-field">
              <span>{f.label}</span>
              {f.multiline ? (
                <textarea rows={4} value={form[f.key]} placeholder={f.placeholder} onChange={set(f.key)} />
              ) : (
                <input value={form[f.key]} placeholder={f.placeholder} onChange={set(f.key)} list={f.list} />
              )}
              {f.key === 'contact' && seed.suggested && (
                <span className="tp-note tp-suggested">Author and contact filled in from your defaults — edit or clear them freely.</span>
              )}
            </label>
          ))}
          <datalist id="tp-credits">
            {CREDIT_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
          </datalist>
          <datalist id="tp-versions">
            {DRAFT_VERSIONS.map((v) => <option key={v} value={v} />)}
          </datalist>
          <div className="tp-actions">
            <button
              type="button"
              className="btn btn-outline tp-cover-btn"
              onClick={() => onViewCover(form)}
              title="Save and show the title page at full size above Page 1"
            >
              View Full Cover
            </button>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </div>

        <div className="tp-preview" aria-hidden="true">
          <div className="tp-mini">
            <TitlePageSheet meta={form} />
          </div>
        </div>
      </form>
    </dialog>
  );
}
