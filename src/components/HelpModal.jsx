import { useEffect, useRef, useState } from 'react';
import { Check, CodeXml, Coffee, ExternalLink, Heart, MessageCircle } from 'lucide-react';
import { SHORTCUT_SECTIONS as SECTIONS, keycaps } from '../lib/shortcuts.js';
import pkg from '../../package.json';
import BrandMark from './BrandMark.jsx';
import { loadCredits, normalizeCredits } from '../lib/credits.js';
import './HelpModal.css';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** A shortcut as keycaps, with ⌘ / ⌥ / ⇧ on a Mac. */
function Keys({ combo }) {
  return (
    <span className="hm-keys">
      {keycaps(combo, IS_MAC).map((k, i) => <kbd key={i}>{k}</kbd>)}
    </span>
  );
}

/** About → Support & Community: where DraftLine lives outside the app. */
const COMMUNITY_LINKS = [
  { href: 'https://ko-fi.com/draftline', label: 'Ko-fi', sub: 'Tip Jar & Goals', Icon: Coffee },
  { href: 'https://patreon.com/DraftLine', label: 'Patreon', sub: 'Monthly Tiers & Roadmap', Icon: Heart },
  { href: 'https://discord.gg/8ytSsSWsPX', label: 'Discord', sub: "Writers' Room", Icon: MessageCircle },
  { href: 'https://github.com/nanashi86/DraftLine', label: 'GitHub', sub: 'Source & Issues', Icon: CodeXml },
];
const PATREON_URL = COMMUNITY_LINKS[1].href;
const LICENSE_URL = 'https://github.com/nanashi86/DraftLine/blob/main/LICENSE';

/** About → Credits: the names live in public/credits.json (see lib/credits.js); nothing here changes to add one. */
const CREDITS_URL = `${import.meta.env.BASE_URL}credits.json`;

function Invite({ children }) {
  return (
    <p className="hm-credits-invite">
      <a href={PATREON_URL} target="_blank" rel="noopener noreferrer">{children}</a>
    </p>
  );
}

function Credits({ credits }) {
  const { catalyst, executiveProducers, screeningRoom } = credits;
  return (
    <>
      {catalyst.length > 0 && (
        <div className="hm-credits-sec is-catalyst">
          <h4>The Catalyst</h4>
          <p className="hm-credits-sub">First Supporter</p>
          <ul>{catalyst.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      )}
      <div className="hm-credits-sec is-producers">
        <h4>Executive Producers</h4>
        <p className="hm-credits-sub">Executive Support</p>
        {executiveProducers.length > 0
          ? <ul>{executiveProducers.map((n) => <li key={n}>{n}</li>)}</ul>
          : <Invite>Become an Executive Producer on Patreon</Invite>}
      </div>
      <div className="hm-credits-sec is-room">
        <h4>The Screening Room</h4>
        <p className="hm-credits-sub">Community Supporters</p>
        {screeningRoom.length > 0
          ? <ul className="hm-credits-grid">{screeningRoom.map((n) => <li key={n}>{n}</li>)}</ul>
          : <Invite>Take a seat in the Screening Room on Patreon</Invite>}
      </div>
    </>
  );
}

function fmtBytes(n) {
  return n < 1024 ? `${n} bytes` : `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
}

/** Keyboard Shortcuts or About DraftLine, from the ⋮ menu. */
export default function HelpModal({ kind, storage, onClose, tipsFinished = 0, tipsTotal = 0, onResetTips }) {
  const [tipsReset, setTipsReset] = useState(false); // Show tips again was just clicked: say so
  const dialogRef = useRef(null);
  const [lib, setLib] = useState({ count: null, persisted: null, usage: null });
  const [credits, setCredits] = useState(() => normalizeCredits(null));

  // About: how many scripts, whether the browser has promised not to evict them, space used.
  useEffect(() => {
    if (kind !== 'about') return;
    storage.countProjects?.().then((count) => setLib((l) => ({ ...l, count })), () => {});
    navigator.storage?.persisted?.().then((persisted) => setLib((l) => ({ ...l, persisted })), () => {});
    navigator.storage?.estimate?.().then(({ usage }) => setLib((l) => ({ ...l, usage })), () => {});
  }, [kind, storage]);

  // About: the credits, fetched each time About opens. Any failure (offline, missing file, bad JSON)
  // just leaves the Patreon invitations showing; loadCredits never rejects.
  useEffect(() => {
    if (kind !== 'about') return undefined;
    const ctrl = new AbortController();
    loadCredits(CREDITS_URL, { signal: ctrl.signal }).then((next) => {
      if (!ctrl.signal.aborted) setCredits(next);
    });
    return () => ctrl.abort();
  }, [kind]);

  const askPersist = () => {
    navigator.storage?.persist?.().then((persisted) => setLib((l) => ({ ...l, persisted })), () => {});
  };

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`hm-modal is-${kind}`}
      aria-labelledby="hm-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <header className="hm-head">
        <h2 id="hm-title">{kind === 'about' ? 'About DraftLine' : 'Keyboard Shortcuts'}</h2>
        <button type="button" className="btn" onClick={onClose} autoFocus>Close</button>
      </header>

      {kind === 'shortcuts' ? (
        <div className="hm-grid">
          {SECTIONS.map((sec) => (
            <section key={sec.title}>
              <h3>{sec.title}</h3>
              <dl>
                {sec.rows.map(([combo, what]) => (
                  <div key={combo} className="hm-row">
                    <dt><Keys combo={combo} /></dt>
                    <dd>{what}</dd>
                  </div>
                ))}
              </dl>
              {sec.note && <p className="hm-note">{sec.note}</p>}
            </section>
          ))}
        </div>
      ) : (
        <div className="hm-about">
          <div className="hm-brand">
            <BrandMark />
            <div>
              <div className="hm-name">DraftLine™</div>
              <div className="hm-version">Version {pkg.version}</div>
            </div>
          </div>
          <p>
            A fast, distraction‑free screenwriting app designed for pure flow. Write natively in your browser, maintain
            absolute focus, and export effortlessly to Fountain or Final Draft (.fdx).
          </p>
          <section className="hm-origin" aria-labelledby="hm-origin-title">
            <h3 id="hm-origin-title">Origin Story</h3>
            <p>
              I began storytelling at eight on my father&apos;s electric typewriter. Decades later, while writing my first
              feature, <em>What Happened to Haiti?</em>, I refused to pay bloated subscriptions and wrote all six
              drafts in raw Google Docs. That grind taught me structure and what tools screenwriters truly need. So I
              built DraftLine: a clean, fast, distraction‑free editor with dramatic architecture built right in.
            </p>
          </section>
          <section className="hm-community" aria-labelledby="hm-community-title">
            <h3 id="hm-community-title">Support &amp; Community</h3>
            <ul className="hm-links">
              {COMMUNITY_LINKS.map(({ href, label, sub, Icon }) => (
                <li key={label}>
                  <a className="hm-pill" href={href} target="_blank" rel="noopener noreferrer">
                    <span className="hm-pill-icon"><Icon size={16} strokeWidth={1.75} aria-hidden /></span>
                    <span className="hm-pill-text">
                      <b>{label}</b>
                      <small>{sub}</small>
                    </span>
                    <ExternalLink className="hm-pill-out" size={13} strokeWidth={1.75} aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </section>
          <section className="hm-credits" aria-labelledby="hm-credits-title">
            <h3 id="hm-credits-title" className="hm-credits-title">Credits</h3>
            <Credits credits={credits} />
          </section>
          <dl className="hm-facts">
            <div><dt>Created by</dt><dd>Eric Lemaire Jr.</dd></div>
            <div>
              <dt>Storage</dt>
              <dd>
                {!storage.ok
                  ? 'Not saving — browser storage is blocked or full'
                  : storage.sync?.active
                    ? `Synced folder (${storage.sync.folderName}) · Dual-saved locally`
                    : storage.sync?.needsPermission
                      ? `Synced folder (${storage.sync.folderName}) · paused until you allow access (click the status bar) · Saved locally`
                      : 'Project library in this browser (IndexedDB)'}
                {!storage.sync?.active && !storage.sync?.needsPermission && lib.count != null
                  && ` · ${lib.count} ${lib.count === 1 ? 'script' : 'scripts'}`}
              </dd>
            </div>
            <div><dt>Last saved</dt><dd>{storage.savedAt ? new Date(storage.savedAt).toLocaleString() : 'Not yet'}</dd></div>
            <div>
              <dt>This script</dt>
              <dd>{fmtBytes(storage.bytes)}{lib.usage != null && ` · ${fmtBytes(lib.usage)} used by DraftLine in total`}</dd>
            </div>
            {lib.persisted != null && (
              <div>
                <dt>Protected</dt>
                <dd>
                  {lib.persisted
                    ? 'Yes — the browser won’t clear your scripts to free up space'
                    : (
                      <>
                        Not yet — the browser may clear site data when the disk is nearly full.{' '}
                        <button type="button" className="hm-link" onClick={askPersist}>Ask it to keep them</button>
                      </>
                    )}
                </dd>
              </div>
            )}
            <div><dt>Network</dt><dd>
                {navigator.onLine ? 'Online' : 'Offline'} – {storage.sync?.active
                  ? `DraftLine uploads nothing – if "${storage.sync.folderName}" is a Drive folder, your Drive app syncs it`
                  : 'your script never leaves this computer'}
              </dd></div>
            {/* Always here, so it's never a mystery: how many tips you've seen, and a way to see them again. */}
            {onResetTips && (
              <div>
                <dt>Tips</dt>
                <dd>
                  {tipsReset ? (
                    <span className="hm-tips-done" role="status">
                      <Check size={13} strokeWidth={2} aria-hidden /> Reset. Tips will show again as you write, one at a time.
                    </span>
                  ) : tipsFinished > 0 ? (
                    <>
                      {tipsFinished} of {tipsTotal} seen ·{' '}
                      <button
                        type="button"
                        className="hm-tips-reset"
                        onClick={() => {
                          onResetTips();
                          setTipsReset(true);
                        }}
                      >
                        Show tips again
                      </button>
                    </>
                  ) : (
                    <span className="hm-tips-note">None seen yet: each one shows once, when its tool would help.</span>
                  )}
                </dd>
              </div>
            )}
          </dl>
          <section className="hm-privacy" aria-labelledby="hm-privacy-title">
            <h3 id="hm-privacy-title">Your Data</h3>
            <ul>
              <li><b>100% Local:</b> Scripts never touch an external server; zero cloud telemetry or account logins.</li>
              <li><b>Drive Sync:</b> Linking a Google Drive or local folder autosaves changes and snapshots straight to disk.</li>
              <li>
                <b>Browser Data Notice:</b> Clearing browser site data removes local drafts unless synced or backed up via
                .draftline, .fountain, or .fdx.
              </li>
            </ul>
          </section>
          <p className="hm-license">
            DraftLine is free &amp; open source under the{' '}
            <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer">MIT License</a>
          </p>
          <p className="hm-trademark">
            DraftLine™ is an open-source, local-first screenwriting application developed by Eric{'\u00a0'}Lemaire{'\u00a0'}Jr.
          </p>
        </div>
      )}
    </dialog>
  );
}
