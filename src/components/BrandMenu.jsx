import { useEffect, useRef, useState } from 'react';
import { BookOpen, Columns2, ExternalLink, House, Info, ListChecks } from 'lucide-react';
import BrandMark from './BrandMark.jsx';
import { openInThemedTab } from '../lib/themedTab.js';
import { BRAND_PAGES } from '../lib/brandMenu.js';

const ICONS = { House, BookOpen, ListChecks, Columns2 };

/**
 * The DraftLine logo in the top bar opens this small menu: the website's pages (each in a new tab, so the
 * script stays open here) and, after a separator, About DraftLine. Same look as every other dropdown
 * (.menu-pop / .menu-item / .menu-divider). About also stays in ⋮.
 */
export default function BrandMenu({ onAbout, aboutOpen = false, base = import.meta.env.BASE_URL }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="menu brand-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`brand${open || aboutOpen ? ' is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title="DraftLine"
        aria-label="DraftLine menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <BrandMark />
        <span className="brand-name">DraftLine</span>
      </button>
      {open && (
        <div className="menu-pop menu-left brand-menu-pop" role="menu" aria-label="DraftLine">
          {BRAND_PAGES.map(({ label, path, icon }) => {
            const Icon = ICONS[icon];
            return (
              <a
                key={path}
                role="menuitem"
                className="menu-item"
                href={`${base}${path}`}
                target="_blank"
                rel="noopener"
                onClick={(e) => {
                  openInThemedTab(e, e.currentTarget.href);
                  setOpen(false);
                }}
              >
                <span className="menu-icon-label">
                  <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                  <span>{label}</span>
                </span>
                <ExternalLink className="menu-hint" size={12} strokeWidth={1.75} aria-label="opens in a new tab" />
              </a>
            );
          })}
          <div className="menu-divider" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setOpen(false);
              onAbout();
            }}
          >
            <span className="menu-icon-label">
              <Info size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>About DraftLine</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
