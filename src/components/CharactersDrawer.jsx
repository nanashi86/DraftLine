import { Fragment, useEffect, useRef, useState } from 'react';
import { UserRoundPen } from 'lucide-react';
import ExpandToggle from './ExpandToggle.jsx';
import { useExpandedPanel } from '../hooks/useExpandedPanel.js';
import { escapeAction } from '../lib/panelExpand.js';
import AutoTextarea from './AutoTextarea.jsx';
import TabIcon from './TabIcon.jsx';
import DialogueTuner from './DialogueTuner.jsx';
import { InfoTip } from './StoryDna.jsx';
import {
  CHARACTER_FIELDS, CHARACTER_TABS, DEFAULT_CHARACTER_TAB, PRIMARY_ROLES, SECONDARY_ROLES, addCharacter, bibleTabBadge,
  filterCharacters, missingFromScript, moveCharacter, primaryRole, removeCharacter, roleSummary, secondaryRole, sortCharacters,
  updateCharacter,
} from '../lib/bible.js';
import { dictionaryEntry } from '../lib/structureDictionary.js';
import { populateSummary } from '../lib/characterIntros.js';
import './ProjectBibleDrawer.css';

// ---- Character Bios -----------------------------------------------------------------------

/**
 * The (i) beside a role picker: the chosen role's Glossary definition — or, before one is chosen,
 * a summary of every option — and a click opens it in Story Bible → Glossary.
 */
function roleTipEntry(dictionary, roles, chosen, term, intro) {
  const pick = chosen?.dict ? dictionaryEntry(dictionary, chosen.dict) : null;
  if (pick) return pick;
  const items = roles.filter((r) => r.dict).map((r) => dictionaryEntry(dictionary, r.dict)).filter(Boolean);
  if (!items.length) return null;
  return { id: items[0].id, term, definition: intro, items };
}

function RolePickers({ c, onChange, dictionary, onOpenTerm }) {
  const p = primaryRole(c.primaryRole);
  const s = secondaryRole(c.secondaryRole);
  const tips = dictionary?.length && onOpenTerm;
  return (
    <div className="pb-roles">
      <label className="pb-field">
        <span className="pb-role-label">
          Primary Role
          {tips && <InfoTip entry={roleTipEntry(dictionary, PRIMARY_ROLES, p, 'Primary Role', 'Where the character ranks in the story — from the protagonist who drives it to a one-scene cameo.')} onOpen={onOpenTerm} />}
        </span>
        <select value={c.primaryRole || ''} onChange={(e) => onChange({ primaryRole: e.target.value })} aria-label="Primary Role">
          <option value="">Choose…</option>
          {PRIMARY_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </label>
      <label className="pb-field">
        <span className="pb-role-label">
          Secondary Function
          {tips && <InfoTip entry={roleTipEntry(dictionary, SECONDARY_ROLES, s, 'Secondary Function', 'What the character does for the protagonist’s story — reflect, disrupt, guide, listen, tempt, block…')} onOpen={onOpenTerm} />}
        </span>
        <select value={c.secondaryRole || 'none'} onChange={(e) => onChange({ secondaryRole: e.target.value })} aria-label="Secondary Function">
          {SECONDARY_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </label>
    </div>
  );
}

function CharacterCard({ c, open, canMove, onToggle, onChange, onMove, onDelete, onRename, autoFocus, dictionary, onOpenTerm }) {
  const nameRef = useRef(null);
  useEffect(() => {
    if (autoFocus) nameRef.current?.focus();
  }, [autoFocus]);
  const name = c.name.trim();
  return (
    <li className={`pb-char${open ? ' is-open' : ''}`} data-character={c.id}>
      <div className="pb-char-head">
        <button type="button" className="pb-char-toggle" onClick={onToggle} aria-expanded={open}>
          <span className="pb-chev" aria-hidden="true">▸</span>
          <span className="pb-char-name">{name || 'Unnamed character'}</span>
          <span className="pb-char-meta" title={c.age?.trim() ? `Age: ${c.age.trim()}` : undefined}>
            {roleSummary(c) ? <><span aria-hidden="true">· </span>{roleSummary(c)}</> : (c.age?.trim() || '')}
          </span>
        </button>
        {onRename && name && (
          <button
            type="button"
            className="btn btn-outline pb-char-rename"
            onClick={() => onRename(name)}
            aria-label={`Rename ${name}`}
            title={`Rename ${name} in cues, dialogue, action, the Scene Board and the Story Bible`}
          >
            Rename
          </button>
        )}
        {canMove && (
          <span className="pb-move">
            <button type="button" onClick={() => onMove(-1)} aria-label={`Move ${name || 'character'} up`} title="Move up">↑</button>
            <button type="button" onClick={() => onMove(1)} aria-label={`Move ${name || 'character'} down`} title="Move down">↓</button>
          </span>
        )}
      </div>
      {open && (
        <div className="pb-char-body">
          {CHARACTER_FIELDS.map((f) => (
            <Fragment key={f.key}>
            {f.key === 'relationship' && <RolePickers c={c} onChange={onChange} dictionary={dictionary} onOpenTerm={onOpenTerm} />}
            <label className="pb-field">
              <span>{f.label}</span>
              {f.multiline ? (
                <AutoTextarea
                  value={c[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => onChange({ [f.key]: e.target.value })}
                />
              ) : (
                <input
                  ref={f.key === 'name' ? nameRef : undefined}
                  value={c[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => onChange({ [f.key]: e.target.value })}
                />
              )}
            </label>
            </Fragment>
          ))}
          <div className="pb-char-foot">
            <button type="button" className="btn pb-danger" onClick={onDelete}>Delete character</button>
          </div>
        </div>
      )}
    </li>
  );
}

function CharacterBios({ characters, onChange, speakers, onUndoable, onRename, reveal = null, dictionary, onOpenTerm }) {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  // "Edit in Bios →" from a cue in the script: open that character's card (and clear the filter).
  const [revealed, setRevealed] = useState(reveal);
  if (reveal !== revealed) {
    setRevealed(reveal);
    if (reveal?.id) {
      setOpenId(reveal.id);
      setQuery('');
    }
  }
  const listRef = useRef(null);
  useEffect(() => {
    if (!reveal?.id) return;
    const t = requestAnimationFrame(() => {
      listRef.current?.querySelector(`[data-character="${CSS.escape(reveal.id)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(t);
  }, [reveal]);
  const shown = filterCharacters(characters, query);
  const missing = missingFromScript(characters, speakers);

  const add = (fields = {}) => {
    const { list, character } = addCharacter(characters, fields);
    onChange(list);
    setQuery('');
    setOpenId(character.id);
    setFocusId(character.id);
  };

  return (
    <div className="pb-pane">
      <div className="pb-tools">
        <input
          className="pb-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name…"
          aria-label="Filter characters by name"
        />
        <button
          type="button"
          className="btn pb-sort"
          onClick={() => onChange(sortCharacters(characters))}
          disabled={characters.length < 2}
          title="Sort A–Z by name"
        >
          A–Z
        </button>
        <button type="button" className="btn btn-primary" onClick={() => add()}>+ Add Character</button>
      </div>

      {missing.length > 0 && (
        <div className="pb-suggest" role="group" aria-labelledby="pb-missing-bios">
          <span className="micro-label" id="pb-missing-bios">Missing bios</span>
          <div className="pb-suggest-pills">
            {missing.slice(0, 8).map((n) => (
              <button key={n} type="button" className="pill pb-chip" onClick={() => add({ name: n })} title={`Add a bio for ${n}`}>
                + {n}
              </button>
            ))}
            {missing.length > 8 && <span className="pb-more">and {missing.length - 8} more</span>}
          </div>
        </div>
      )}

      {characters.length === 0 ? (
        <p className="pb-empty">No characters yet. Add one, or pick a name from the script above.</p>
      ) : shown.length === 0 ? (
        <p className="pb-empty">No character matches “{query}”.</p>
      ) : (
        <ul className="pb-chars" ref={listRef}>
          {shown.map((c) => (
            <CharacterCard
              key={c.id}
              c={c}
              open={openId === c.id}
              canMove={!query && characters.length > 1}
              autoFocus={focusId === c.id}
              onToggle={() => setOpenId((o) => (o === c.id ? null : c.id))}
              onChange={(patch) => onChange(updateCharacter(characters, c.id, patch))}
              onMove={(dir) => onChange(moveCharacter(characters, c.id, dir))}
              onRename={onRename}
              dictionary={dictionary}
              onOpenTerm={onOpenTerm}
              onDelete={() => {
                onUndoable(`Deleted ${c.name.trim() || 'character'}`, characters);
                onChange(removeCharacter(characters, c.id));
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- Drawer -----------------------------------------------------------------------------

/**
 * Characters: a right-hand drawer (sharing the dock with the Story Bible) with two tabs —
 * Bios (profiles, traits, backstory, rename across the script) and Dialogue (every line a
 * character speaks, editable in place). Bios are stored on the project as `characters`.
 */
export default function CharactersDrawer({
  open, onClose, tab = DEFAULT_CHARACTER_TAB, onTabChange, characters, onCharactersChange, speakers,
  onRenameCharacter, revealBio = null, dialogue, dictionary = [], onOpenGlossary, onPopulateBios,
}) {
  const [undo, setUndo] = useState(null); // { message, restore }
  const panelRef = useRef(null);
  // Expanded over the whole workspace (lib/panelExpand.js, hooks/useExpandedPanel.js).
  const [expanded, setExpanded] = useExpandedPanel(open);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented && panelRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        if (escapeAction(expanded) === 'collapse') setExpanded(false); // first Esc collapses, the next one closes
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, expanded, setExpanded]);

  useEffect(() => {
    if (!undo) return undefined;
    const t = setTimeout(() => setUndo(null), 7000);
    return () => clearTimeout(t);
  }, [undo]);

  const speaking = speakers.length;
  return (
    <aside
      ref={panelRef}
      className={`pb pb-characters${open ? ' is-open' : ''}${expanded ? ' is-expanded' : ''}`}
      aria-label="Characters"
      aria-hidden={!open}
      inert={open ? undefined : true}
    >
      <header className="pb-head">
        <div>
          <h2>Characters</h2>
          <div className="pb-sub">
            {speaking} speaking · {characters.length} {characters.length === 1 ? 'bio' : 'bios'}
          </div>
        </div>
        <div className="pb-head-actions">
          {/* Bios only: fill blank Age and Physical Description from the script's introductions. */}
          {onPopulateBios && tab !== 'dialogue' && (
            <button
              type="button"
              className="btn btn-outline pb-populate"
              onClick={() => {
                const prev = characters;
                const r = onPopulateBios();
                setUndo({ message: populateSummary(r), restore: r.filled.length ? () => onCharactersChange(prev) : null });
              }}
              title="Fill empty Age / Timeline and Physical Description fields from how the script introduces each character, e.g. MARJORIE (30s)--warm-dark skin. Nothing you've typed is changed."
            >
              <UserRoundPen size={13} strokeWidth={1.75} aria-hidden />Populate Bio
            </button>
          )}
          <ExpandToggle expanded={expanded} onToggle={() => setExpanded((x) => !x)} />
          <button type="button" className="btn btn-icon pb-close" onClick={onClose} aria-label="Close Characters" title="Close (Esc)">×</button>
        </div>
      </header>

      <div className="pb-tabs" role="tablist" aria-label="Characters sections">
        {CHARACTER_TABS.map((t) => {
          const badge = bibleTabBadge(t.id, { characters, speakers });
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`pb-tab${tab === t.id ? ' is-on' : ''}`}
              onClick={() => onTabChange(t.id)}
              title={t.title}
            >
              <TabIcon name={t.id} />{t.label}{badge != null && <b>{badge}</b>}
            </button>
          );
        })}
      </div>

      {tab === 'dialogue' ? (
        <div className="pb-dialogue" role="tabpanel">
          <DialogueTuner {...dialogue} open={open && tab === 'dialogue'} onRename={onRenameCharacter} />
        </div>
      ) : (
        <div className="pb-scroll" role="tabpanel">
          <CharacterBios
            dictionary={dictionary}
            onOpenTerm={onOpenGlossary}
            characters={characters}
            onChange={onCharactersChange}
            speakers={speakers}
            onUndoable={(message, prev) => setUndo({ message, restore: () => onCharactersChange(prev) })}
            onRename={onRenameCharacter}
            reveal={revealBio}
          />
        </div>
      )}

      {undo && (
        <div className="pb-undo" role="status">
          {undo.message}
          {undo.restore && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                undo.restore();
                setUndo(null);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
