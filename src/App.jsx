import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Editor from './components/Editor.jsx';
import CharactersDrawer from './components/CharactersDrawer.jsx';
import Navigator from './components/Navigator.jsx';
import TitlePageModal from './components/TitlePageModal.jsx';
import ImportModal from './components/ImportModal.jsx';
import FormatDoctorModal from './components/FormatDoctorModal.jsx';
import { applyFixes, auditScript } from './lib/formatDoctor.js';
import TitlePageSheet from './components/TitlePageSheet.jsx';
import PrintView from './components/PrintView.jsx';
import BeatBoard from './components/BeatBoard.jsx';
import Menu from './components/Menu.jsx';
import { useHistory } from './hooks/useHistory.js';
import HelpModal from './components/HelpModal.jsx';
import ProjectsDrawer from './components/ProjectsDrawer.jsx';
import ProjectBibleDrawer from './components/ProjectBibleDrawer.jsx';
import RenameCharacterModal from './components/RenameCharacterModal.jsx';
import NotesDrawer from './components/NotesDrawer.jsx';
import CueBioCard from './components/CueBioCard.jsx';
import { RestorePrompt, SnapshotPrompt, SnapshotsDrawer } from './components/Snapshots.jsx';
import { addRevision, createRevision, getRevision, removeRevision } from './lib/revisions.js';
import { endNoteSession, hasNote, restoreNoteVersion, setNoteText, startNote } from './lib/editorialNotes.js';
import { renameCharacter, revertRename } from './lib/renameCharacter.js';
import { moveCardAndScene } from './lib/sceneSync.js';
import { dialogueFilter, filterLabel } from './lib/dialogueFilter.js';
import { canvasThemeInfo, nextCanvasTheme, readCanvasTheme, writeCanvasTheme } from './lib/canvasTheme.js';
import { mergeDictionary } from './lib/structureDictionary.js';
import { characterTabFromPrefs, closeDock, dockFromPrefs, openDock, toggleDock } from './lib/dock.js';
import { DEFAULT_BIBLE_TAB } from './lib/bible.js';
import {
  DICTIONARY_KEY, EMPTY_META, bootLibrary, clearJournal, projects, revisionToDoc, toDoc, toRecord, writeJournal,
} from './lib/projectStorage.js';
import {
  BACKUP_MIME, backupFileName, isBackupFile, mergeBackupDictionary, parseBackup, serializeBackup,
} from './lib/backup.js';
import pkg from '../package.json';
import { STYLES, STYLE_INFO, reconcileMarks } from './lib/formatting.js';
import {
  ELEMENT_META,
  analyzeScript,
  buildItems,
  flowHints,
  formatEighths,
  linesToEighths,
  makeBlock,
  paginate,
} from './lib/screenplay.js';
import { DUAL_SHORTCUT, ELEMENT_MENU } from './lib/shortcuts.js';
import { isOnBar, moreMenuItems } from './lib/toolbar.js';
import { newProjectMeta, rememberAuthorDefaults } from './lib/authorDefaults.js';
import { parseFountain, toFountain } from './lib/fountain.js';
import { parseFDX, toFDX } from './lib/fdx.js';
import { beatsToFountain, beatsToMarkdown, byAct, moveBeat, sampleBeats } from './lib/beats.js';
import { SAMPLE_SCRIPT } from './lib/sampleScript.js';
import { effectiveZoomFor } from './lib/zoom.js';
import { actionDensity, riskLocations, stepRisk } from './lib/pacing.js';
import DensityNav from './components/DensityNav.jsx';
import './App.css';

// Scripts live in IndexedDB (lib/projectStorage.js); localStorage keeps only UI prefs.
const PREFS_KEY = 'draftline:prefs:v1';
const SAVE_DEBOUNCE_MS = 500;
const ZOOM_STEPS = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const VIEWS = [
  { id: 'page', label: 'Page', title: 'Script only' },
  { id: 'split', label: 'Split', title: 'Script + Scene Board side by side' },
  { id: 'board', label: 'Board', title: 'Scene Board only' },
];

function sampleDoc() {
  return {
    meta: { ...EMPTY_META, ...SAMPLE_SCRIPT.meta },
    blocks: SAMPLE_SCRIPT.blocks.map(([type, text, extra]) => makeBlock(type, text, extra)),
    beats: sampleBeats(),
  };
}

/** localStorage, or null where it's blocked (only prefs and the crash journal use it). */
const LOCAL = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function slugify(s) {
  return (s || 'untitled').trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').toLowerCase() || 'untitled';
}

function download(filename, content, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Narrower than this, the header's author field hides rather than showing a sliver. */
const AUTHOR_MIN_WIDTH = 90;

function timeLabel(ts) {
  return ts ? new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
}

/** Carries dual dialogue, margin notes and inline formatting over from a parsed element. */
function blockExtras(b) {
  const extra = {};
  if (b.dual) extra.dual = true;
  if (b.note != null && b.note !== '') extra.note = b.note;
  if (b.marks) extra.marks = b.marks;
  return Object.keys(extra).length ? extra : null;
}

// ---- Boot: open the project library before the editor mounts ----
let bootPromise = null;
/** Once per page load (StrictMode runs effects twice; migration must not). */
function bootOnce() {
  bootPromise ??= bootLibrary({ store: projects, storage: LOCAL, makeFirstDoc: sampleDoc });
  return bootPromise;
}

export default function App() {
  const [boot, setBoot] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let live = true;
    bootOnce().then((b) => live && setBoot(b), (e) => live && setError(e));
    return () => {
      live = false;
    };
  }, []);
  if (error) {
    return <div className="boot-screen" role="alert">DraftLine couldn’t open your scripts: {error.message}</div>;
  }
  if (!boot) return <div className="boot-screen" aria-busy="true">Opening your scripts…</div>;
  return <Workspace boot={boot} />;
}

function bootMessage(boot) {
  if (!boot.persistent) return 'This browser is blocking storage — nothing will be kept. Use Export to save files.';
  if (boot.recovered) return 'Recovered changes from your last session';
  if (boot.migrated) return 'Your script is now in Projects — open the library from its title';
  return null;
}

/** The editor workspace for one project at a time; switching projects swaps its document. */
function Workspace({ boot }) {
  const [initialDoc] = useState(() => {
    const d = toDoc(boot.project);
    return { ...d, blocks: d.blocks.length ? d.blocks : [makeBlock('scene')] };
  });
  const [initialPrefs] = useState(() => readJSON(PREFS_KEY) || {});
  const [projectId, setProjectId] = useState(boot.project.id);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [meta, setMeta] = useState(initialDoc.meta);
  const { present: blocks, set, undo, redo, reset, canUndo, canRedo } = useHistory(initialDoc.blocks, reconcileMarks);
  const [beats, setBeats] = useState(initialDoc.beats);
  const [characters, setCharacters] = useState(initialDoc.characters); // Story Bible
  const [storyNotes, setStoryNotes] = useState(initialDoc.storyNotes);
  const [storyDna, setStoryDna] = useState(initialDoc.storyDna);
  const [revisions, setRevisions] = useState(initialDoc.revisions); // Snapshots (lib/revisions.js)
  const [snapshotPrompt, setSnapshotPrompt] = useState(false);
  const [restoreId, setRestoreId] = useState(null); // the snapshot waiting on "Restore?"
  const [noteId, setNoteId] = useState(null); // the element whose margin note the Notes drawer shows
  const noteSession = useRef(null); // { id, start } — the note's text when this editing stretch began
  const [dictOverrides, setDictOverrides] = useState(boot.dictionary || {}); // Glossary wording (all projects)

  const [lineMap, setLineMap] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [view, setView] = useState(VIEWS.some((v) => v.id === initialPrefs.view) ? initialPrefs.view : 'page');
  // Right dock: the Story Bible (DNA · Notes) or Characters (Bios · Dialogue) — one at a time (lib/dock.js).
  const [dock, setDock] = useState(() => dockFromPrefs(initialPrefs));
  const charactersOpen = dock === 'characters';
  const bibleOpen = dock === 'bible';
  const snapshotsOpen = dock === 'snapshots';
  const notesOpen = dock === 'notes';
  const [bibleTab, setBibleTab] = useState(DEFAULT_BIBLE_TAB); // DNA unless you pick another this session
  const [characterTab, setCharacterTab] = useState(() => characterTabFromPrefs(initialPrefs));
  /** Alt+T / ⋮: show Characters on its Dialogue tab (or close it if that's what's showing). */
  const toggleDialogueTab = useCallback(() => {
    setDock(dock === 'characters' && characterTab === 'dialogue' ? null : 'characters');
    setCharacterTab('dialogue');
  }, [dock, characterTab]);
  const [navOpen, setNavOpen] = useState(initialPrefs.navOpen ?? true);
  const [selectedChar, setSelectedChar] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [zoom, setZoom] = useState(initialPrefs.zoom ?? 1);
  const [actMode, setActMode] = useState(initialPrefs.actMode === 3 ? 3 : 4);
  const [coverVisible, setCoverVisible] = useState(initialPrefs.coverVisible ?? false); // Page 0 above the script
  const [scrollerWidth, setScrollerWidth] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [titleOpen, setTitleOpen] = useState(false);
  const [importSeed, setImportSeed] = useState(null); // { text, name } while the Import modal is open
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [fmtState, setFmtState] = useState({ b: false, i: false, u: false, s: false }); // toolbar B I U S
  const [helpKind, setHelpKind] = useState(null); // 'shortcuts' | 'about' while that dialog is open
  const [printing, setPrinting] = useState(false);
  // Page colour: Paper (default) or Midnight — on screen only; print is always black on white.
  const [canvasTheme, setCanvasTheme] = useState(() => readCanvasTheme());
  const toggleCanvasTheme = () => {
    const next = nextCanvasTheme(canvasTheme);
    setCanvasTheme(next);
    writeCanvasTheme(next);
  };
  const themeNext = canvasThemeInfo(nextCanvasTheme(canvasTheme));
  const barRef = useRef(null);
  // The author field gives way to the toolbar; with only a sliver left it hides (staying in the
  // layout, invisible, so it can tell when there's room again).
  const authorRef = useRef(null);
  const [authorCramped, setAuthorCramped] = useState(false);
  useLayoutEffect(() => {
    const el = authorRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const check = () => setAuthorCramped(el.offsetParent !== null && el.clientWidth < Math.min(AUTHOR_MIN_WIDTH, el.scrollWidth));
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const charactersBtnRef = useRef(null);
  const bibleBtnRef = useRef(null);
  const [toast, setToast] = useState(() => bootMessage(boot));
  const [saved, setSaved] = useState(() => ({
    blocks: initialDoc.blocks,
    meta: initialDoc.meta,
    beats: initialDoc.beats,
    characters: initialDoc.characters,
    storyNotes: initialDoc.storyNotes,
    storyDna: initialDoc.storyDna,
    revisions: initialDoc.revisions,
    at: initialDoc.updatedAt,
    ok: boot.persistent,
  }));

  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const toastTimer = useRef(null);
  const scrollerRO = useRef(null);

  // ---- Derived layout ----
  const items = useMemo(() => buildItems(blocks), [blocks]);
  const layout = useMemo(() => paginate(items, lineMap), [items, lineMap]);
  const analysis = useMemo(() => analyzeScript(blocks), [blocks]);
  const activeBlock = blocks.find((b) => b.id === activeId) || null;
  const activeInDual = items.some((it) => it.kind === 'dual' && it.blocks.some((b) => b.id === activeId));
  // Focus mode is always the bare script page.
  const showEditor = view !== 'board' || focusMode;
  const showBoard = view !== 'page' && !focusMode;

  // Page and Split: the page shrinks to fit beside the open drawers — never sideways scrolling,
  // never zoomed in past the writer's own zoom (lib/zoom.js).
  const effectiveZoom = effectiveZoomFor({ view: focusMode ? 'page' : view, zoom, width: scrollerWidth });
  const zoomPct = (z) => Math.round((Math.max(6, Math.round(16 * z)) / 16) * 100); // matches the editor's whole-pixel lines
  const isFitted = zoomPct(effectiveZoom) !== zoomPct(zoom);

  const scrollerEl = useRef(null); // the script pane itself (the cue bio card listens there)
  const scrollerRef = useCallback((el) => {
    scrollerEl.current = el;
    if (!el) return undefined;
    scrollerRO.current = new ResizeObserver(([en]) => {
      const w = Math.floor(en.contentRect.width); // width available to the page
      if (w > 0) setScrollerWidth(w);
    });
    scrollerRO.current.observe(el);
    return () => scrollerRO.current.disconnect();
  }, []);

  const scenes = useMemo(() => {
    const idx = [];
    items.forEach((it, k) => {
      if (it.type === 'scene') idx.push(k);
    });
    return idx.map((k, n) => {
      const pl = layout.place[k];
      const nextPos = n + 1 < idx.length ? layout.place[idx[n + 1]].pos : layout.endPos;
      let snippet = '';
      for (let j = k + 1; j < items.length && items[j].type !== 'scene'; j++) {
        if (items[j].type === 'action' && items[j].block.text.trim()) {
          snippet = items[j].block.text.trim();
          break;
        }
      }
      return {
        id: items[k].key,
        number: analysis.sceneNumbers[items[k].key],
        heading: items[k].block.text.trim(),
        page: pl.page + 1,
        length: formatEighths(Math.max(1, nextPos - pl.pos)),
        eighths: linesToEighths(Math.max(1, nextPos - pl.pos)), // length in eighths of a page (Scene Board pacing)
        snippet,
      };
    });
  }, [items, layout, analysis]);

  // Speakers in the script (for the Bible's "add from script" chips), most lines first.
  const speakers = useMemo(() => analysis.characterList.map((c) => c.name), [analysis]);
  // Characters → Dialogue: a character picked there spotlights their speeches in the script.
  const filter = useMemo(() => dialogueFilter(analysis, selectedChar), [analysis, selectedChar]);

  // Scenes the Scene Board can turn into cards: numbered headings with text.
  const boardScenes = useMemo(() => scenes.filter((s) => s.number && s.heading), [scenes]);

  // ---- Toasts ----
  const notify = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);
  useEffect(() => {
    if (!toast || toast !== bootMessage(boot)) return undefined;
    const t = setTimeout(() => setToast(null), boot.persistent ? 3200 : 8000);
    return () => clearTimeout(t);
  }, [toast, boot]);

  // Glossary: starter text with your own wording laid over it, kept for all projects.
  const dictionary = useMemo(() => mergeDictionary(dictOverrides), [dictOverrides]);
  const editDictionary = useCallback((id, override) => {
    const next = { ...dictOverrides };
    if (override) next[id] = override;
    else delete next[id];
    setDictOverrides(next);
    projects.setSetting(DICTIONARY_KEY, next).catch(() => notify('Could not save the dictionary — browser storage is blocked'));
  }, [dictOverrides, notify]);

  // ---- Auto-save to the project library (IndexedDB), debounced ----
  const dirty = saved.blocks !== blocks || saved.meta !== meta || saved.beats !== beats
    || saved.characters !== characters || saved.storyNotes !== storyNotes || saved.storyDna !== storyDna
    || saved.revisions !== revisions;
  const latest = useRef(null);
  useLayoutEffect(() => {
    latest.current = {
      projectId, meta, blocks, beats, characters, storyNotes, storyDna, revisions, pages: layout.pageCount, scenes: analysis.sceneCount, dirty,
    };
  });

  /** Save the open project now. Resolves with the stored record (or null on failure). */
  const saveNow = useCallback(() => {
    const s = latest.current;
    const snap = {
      meta: s.meta, blocks: s.blocks, beats: s.beats, characters: s.characters, storyNotes: s.storyNotes, storyDna: s.storyDna,
      revisions: s.revisions,
    };
    return projects.saveActiveProject({ id: s.projectId, ...snap, pages: s.pages, scenes: s.scenes })
      .then(async (rec) => {
        const ok = await projects.isPersistent();
        clearJournal(LOCAL);
        if (latest.current.projectId === s.projectId) setSaved({ ...snap, at: rec.updatedAt, ok });
        return rec;
      })
      .catch(() => {
        if (latest.current.projectId === s.projectId) setSaved((prev) => ({ ...prev, ok: false }));
        return null;
      });
  }, []);

  /** Save only if there are unsaved changes (before switching projects). */
  const flushSave = useCallback(() => (latest.current.dirty ? saveNow() : Promise.resolve(null)), [saveNow]);

  useEffect(() => {
    if (!dirty) return undefined;
    const t = setTimeout(saveNow, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [dirty, meta, blocks, beats, characters, storyNotes, storyDna, revisions, saveNow]);

  // Tab hidden or closing inside the debounce window: start the save, and journal the state
  // synchronously in case the browser kills the page before IndexedDB commits.
  useEffect(() => {
    const flush = () => {
      const s = latest.current;
      if (!s.dirty) return;
      writeJournal(LOCAL, {
        id: s.projectId, meta: s.meta, blocks: s.blocks, beats: s.beats, characters: s.characters, storyNotes: s.storyNotes, storyDna: s.storyDna,
      });
      saveNow();
    };
    const onVis = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [saveNow]);

  useEffect(() => {
    document.title = `${meta.title.trim() || 'Untitled'} — DraftLine`;
  }, [meta.title]);

  useEffect(() => {
    writeJSON(PREFS_KEY, { zoom, dock, characterTab, navOpen, view, actMode, coverVisible });
  }, [zoom, dock, characterTab, navOpen, view, actMode, coverVisible]);

  const saveLabel = !saved.ok ? 'Not saved — browser storage blocked or full' : dirty ? 'Saving…' : 'Saved locally';

  // ---- Script mutations (shared by the Editor and the Dialogue panel) ----
  const commitBlocks = useCallback((next) => {
    set(next.length ? next : [makeBlock('action')]);
  }, [set]);

  const updateBlockText = useCallback((id, text) => {
    set((prev) => prev.map((b) => (b.id === id ? { ...b, text } : b)), `text:${id}`);
  }, [set]);

  // ---- Margin notes (Notes drawer) ----
  /** End the current note-editing stretch: log the version it started from, drop it if left empty. */
  const endNoteEditing = useCallback(() => {
    const sess = noteSession.current;
    noteSession.current = null;
    if (!sess) return;
    const b = latest.current.blocks.find((x) => x.id === sess.id);
    if (!b) return;
    const next = endNoteSession(b, sess.start);
    if (next !== b) set((prev) => prev.map((x) => (x.id === sess.id ? next : x)), `note:${sess.id}`);
  }, [set]);

  /** Open element `id`'s note in the drawer — starting one (or quoting a selection into it) as needed. */
  const openNote = useCallback((id, { quote = '' } = {}) => {
    if (noteSession.current?.id !== id) endNoteEditing();
    const b = latest.current.blocks.find((x) => x.id === id);
    if (!b) return;
    if (!noteSession.current) noteSession.current = { id, start: hasNote(b) ? b.note : null };
    const next = startNote(b, { quote });
    if (next !== b) set((prev) => prev.map((x) => (x.id === id ? next : x)), `note:${id}`);
    setNoteId(id);
    setDock('notes');
  }, [endNoteEditing, set]);

  const changeNote = useCallback((id, text) => {
    set((prev) => prev.map((b) => (b.id === id ? setNoteText(b, text) : b)), `note:${id}`);
  }, [set]);

  const deleteNote = useCallback((id) => {
    if (noteSession.current?.id === id) noteSession.current = null;
    set((prev) => prev.map((b) => (b.id === id ? setNoteText(b, null) : b)));
    setNoteId(null);
    notify('Note deleted · Ctrl+Z to undo');
  }, [set, notify]);

  const restoreNote = useCallback((id, index) => {
    set((prev) => prev.map((b) => (b.id === id ? restoreNoteVersion(b, index) : b)));
    if (noteSession.current?.id === id) noteSession.current = null; // the restore logged the old text itself
    const b = latest.current.blocks.find((x) => x.id === id);
    noteSession.current = { id, start: b?.noteLog?.[index]?.text ?? null };
  }, [set]);

  /** Close the drawer; `refocus` returns the caret to the note's line. */
  const closeNotes = useCallback((refocus) => {
    const id = noteId;
    endNoteEditing();
    setDock((d) => closeDock(d, 'notes'));
    if (refocus && id) requestAnimationFrame(() => editorRef.current?.focusBlock(id));
  }, [noteId, endNoteEditing]);

  // Another drawer took the dock: the note being edited is done.
  useEffect(() => {
    if (dock !== 'notes') endNoteEditing();
  }, [dock, endNoteEditing]);

  // ---- Format Doctor ----
  const issues = useMemo(() => auditScript(blocks, { skipId: activeId }), [blocks, activeId]);
  // Action density (skim risk): long action paragraphs, from the measured lines when known.
  const density = useMemo(() => actionDensity(blocks, lineMap), [blocks, lineMap]);
  const [densityMode, setDensityMode] = useState(false);
  const [densityIndex, setDensityIndex] = useState(-1); // which skim risk the stepper is on (-1: none yet)
  const noteCount = useMemo(() => blocks.filter((b) => hasNote(b) && b.note.trim()).length, [blocks]);
  const fixIssues = useCallback((list) => {
    if (!list.length) return;
    set(applyFixes(blocks, list));
    notify(list.length === 1 ? 'Fixed · Ctrl+Z to undo' : `Fixed ${list.length} elements · Ctrl+Z to undo`);
  }, [blocks, set, notify]);

  const onMeasure = useCallback((changes) => {
    setLineMap((prev) => {
      let diff = false;
      for (const k in changes) if (prev[k] !== changes[k]) diff = true;
      return diff ? { ...prev, ...changes } : prev;
    });
  }, []);

  // ---- File actions ----
  const base = slugify(meta.title);
  const exportFountain = () => {
    download(`${base}.fountain`, toFountain({ meta, blocks }), 'text/plain;charset=utf-8');
    notify('Exported .fountain');
  };
  const exportFDX = () => {
    download(`${base}.fdx`, toFDX({ meta, blocks }), 'application/xml;charset=utf-8');
    notify('Exported .fdx');
  };
  const exportOutline = useCallback((kind) => {
    if (kind === 'md') {
      download(`${base}-outline.md`, beatsToMarkdown(beats, meta.title, actMode), 'text/markdown;charset=utf-8');
      notify('Exported outline .md');
    } else {
      download(`${base}-outline.fountain`, beatsToFountain(beats, meta.title, actMode), 'text/plain;charset=utf-8');
      notify('Exported outline .fountain');
    }
  }, [base, beats, meta.title, actMode, notify]);

  // ---- Projects ----
  /** Show a stored project: script, title page, beats, Bible; fresh undo history; nothing unsaved. */
  const applyProject = useCallback((rec) => {
    const doc = toDoc(rec);
    const m = { ...EMPTY_META, ...doc.meta };
    const bl = doc.blocks.length ? doc.blocks : [makeBlock('scene')];
    setMeta(m);
    reset(bl);
    setBeats(doc.beats);
    setCharacters(doc.characters);
    setStoryNotes(doc.storyNotes);
    setStoryDna(doc.storyDna);
    setRevisions(doc.revisions);
    noteSession.current = null;
    setNoteId(null);
    setRestoreId(null);
    setLineMap({});
    setSelectedChar(null);
    setActiveId(null);
    setProjectId(rec.id);
    setSaved({
      meta: m, blocks: bl, beats: doc.beats, characters: doc.characters, storyNotes: doc.storyNotes, storyDna: doc.storyDna,
      revisions: doc.revisions, at: rec.updatedAt, ok: true,
    });
    projects.setActiveProjectId(rec.id);
  }, [reset]);

  /** Save what's open, then switch to project `id`. */
  const switchProject = useCallback(async (id) => {
    if (id === latest.current.projectId) {
      setDrawerOpen(false);
      return;
    }
    await flushSave();
    const rec = await projects.getProject(id);
    if (!rec) {
      notify('That script no longer exists');
      return;
    }
    applyProject(rec);
    setDrawerOpen(false);
    notify(`Switched to “${rec.title?.trim() || 'Untitled'}”`);
  }, [applyProject, flushSave, notify]);

  /** Save what's open, store `doc` as a new project and open it. */
  const openAsNewProject = useCallback(async (doc, message) => {
    await flushSave();
    const rec = await projects.saveActiveProject(doc);
    applyProject(rec);
    setDrawerOpen(false);
    if (message) notify(message);
    return rec;
  }, [applyProject, flushSave, notify]);

  const newScript = async (title = 'Untitled') => {
    await openAsNewProject({ meta: { ...EMPTY_META, ...newProjectMeta({ title }) }, blocks: [makeBlock('scene')], beats: [] }, `New script “${title}” · your other scripts are in Projects`);
    if (view === 'board') setView('page');
    requestAnimationFrame(() => document.querySelector('.sheet .el-input')?.focus());
  };

  const loadSample = () => openAsNewProject(sampleDoc(), 'Sample script added to your Projects');

  // ---- Scene Board → script: moving a scene card moves its scene (one undo step) ----
  const moveCard = (id, act, index) => {
    const s = latest.current;
    const r = moveCardAndScene(s.beats, s.blocks, id, act, index);
    if (!r.scriptMoved) {
      setBeats(r.beats); // your own cards, or a move that keeps the scene order: board only
      return;
    }
    const before = s.beats;
    const after = r.beats;
    const old = before.find((b) => b.id === id);
    const oldIndex = byAct(before)[old.act].indexOf(old);
    // Script and board change together; Ctrl+Z / Ctrl+Shift+Z take both back and forth.
    set(r.blocks, null, {
      undo: () => {
        const cur = latest.current.beats;
        setBeats(cur === after ? before : moveBeat(cur, id, old.act, oldIndex));
      },
      redo: () => {
        const cur = latest.current.beats;
        setBeats(cur === before ? after : moveBeat(cur, id, act, index));
      },
    });
    setBeats(after);
    const heading = r.blocks.find((b) => b.id === old.sceneId)?.text.trim() || 'Scene';
    notify(`Moved ${heading} in the script · Ctrl+Z to undo`);
  };

  // ---- Rename a character everywhere (one undo step) ----
  const [renameFrom, setRenameFrom] = useState(null); // the name being renamed, while the review is open
  const [revealBio, setRevealBio] = useState(null); // { id } — a bio the Characters drawer should open to
  /** Cue bio card → "Edit in Bios →": Characters, Bios tab, that character's card open. */
  const editBio = useCallback((id) => {
    setCharacterTab('bios');
    setDock('characters');
    setRevealBio({ id });
  }, []);
  const renameSource = useMemo(
    () => ({ blocks, beats, characters, storyNotes, storyDna }),
    [blocks, beats, characters, storyNotes, storyDna],
  );
  const renameCharacterEverywhere = (oldName, newName, categories) => {
    const s = latest.current;
    const before = { blocks: s.blocks, beats: s.beats, characters: s.characters, storyNotes: s.storyNotes, storyDna: s.storyDna };
    const { project: after, changed, total } = renameCharacter(before, oldName, newName, categories);
    if (!total) return;
    const applyAux = (direction) => {
      const cur = latest.current;
      const next = revertRename(
        { beats: cur.beats, characters: cur.characters, storyNotes: cur.storyNotes, storyDna: cur.storyDna }, changed, direction,
      );
      setBeats(next.beats);
      setCharacters(next.characters);
      setStoryNotes(next.storyNotes);
      setStoryDna(next.storyDna);
    };
    // The script step carries the board / Bible changes, so one Ctrl+Z undoes everything.
    set(after.blocks === before.blocks ? before.blocks.slice() : after.blocks, null, {
      undo: () => applyAux('undo'),
      redo: () => applyAux('redo'),
    });
    setBeats(after.beats);
    setCharacters(after.characters);
    setStoryNotes(after.storyNotes);
    setStoryDna(after.storyDna);
    const oldCue = oldName.trim().toUpperCase();
    setSelectedChar((c) => (c && c.toUpperCase() === oldCue ? newName.trim().toUpperCase() : c));
    setRenameFrom(null);
    notify(`Renamed ${oldName.trim()} → ${newName.trim()} · ${total} ${total === 1 ? 'change' : 'changes'} · Ctrl+Z to undo`);
  };

  // ---- Backup (.draftline): the whole project, restorable with nothing lost ----
  const downloadBackup = (rec) => {
    const name = backupFileName(rec.title);
    download(name, serializeBackup(rec, { actMode, dictionary: dictOverrides, appVersion: pkg.version }), BACKUP_MIME);
    notify(`Backed up ${name}`);
  };

  /** Back up the open project: saved first, so the file matches what's on screen. */
  const backupProject = async () => {
    const s = latest.current;
    const live = {
      id: s.projectId, meta: s.meta, blocks: s.blocks, beats: s.beats, characters: s.characters,
      storyNotes: s.storyNotes, storyDna: s.storyDna, revisions: s.revisions, pages: s.pages, scenes: s.scenes,
    };
    // If storage is blocked the save fails, but the backup is still made from what's open.
    const rec = (await saveNow().catch(() => null)) || toRecord(live);
    downloadBackup(rec);
  };

  // ---- Snapshots (Revisions): labelled checkpoints of the whole project, kept with it ----
  const takeSnapshot = useCallback((label) => {
    const s = latest.current;
    const rev = createRevision(s, { label, pages: s.pages });
    setRevisions((list) => addRevision(list, rev));
    setSnapshotPrompt(false);
    notify(`Snapshot saved · “${rev.label}”`);
    return rev;
  }, [notify]);

  const deleteSnapshot = useCallback((id) => {
    const rev = getRevision(latest.current.revisions, id);
    setRevisions((list) => removeRevision(list, id));
    if (rev) notify(`Deleted snapshot “${rev.label}”`);
  }, [notify]);

  /** Put snapshot `id` back (one undo step), first snapshotting what's on screen if `keepCurrent`. */
  const restoreSnapshot = useCallback((id, keepCurrent) => {
    const s = latest.current;
    const rev = getRevision(s.revisions, id);
    setRestoreId(null);
    if (!rev) return;
    endNoteEditing();
    let list = s.revisions;
    if (keepCurrent) {
      list = addRevision(list, createRevision(s, { label: `Before restoring “${rev.label}”`, pages: s.pages }));
    }
    const doc = revisionToDoc(rev);
    const before = { meta: s.meta, beats: s.beats, characters: s.characters, storyNotes: s.storyNotes, storyDna: s.storyDna };
    const after = {
      meta: { ...EMPTY_META, ...doc.meta }, beats: doc.beats, characters: doc.characters, storyNotes: doc.storyNotes, storyDna: doc.storyDna,
    };
    const applyParts = (x) => {
      setMeta(x.meta);
      setBeats(x.beats);
      setCharacters(x.characters);
      setStoryNotes(x.storyNotes);
      setStoryDna(x.storyDna);
    };
    // The script step carries the rest, so Ctrl+Z takes the whole restore back at once.
    set(doc.blocks.length ? doc.blocks : [makeBlock('scene')], null, { undo: () => applyParts(before), redo: () => applyParts(after) });
    applyParts(after);
    setRevisions(list);
    setSelectedChar(null);
    setNoteId(null);
    notify(`Restored “${rev.label}”${keepCurrent ? ' · your previous draft is saved as a snapshot' : ''} · Ctrl+Z to undo`);
  }, [set, notify, endNoteEditing]);

  /**
   * Restore a .draftline backup as a project (never overwriting one) and open it. Resolves
   * true, or with the reason it couldn't (shown in the Import dialog; toasted when `toastErrors`).
   */
  const restoreBackup = async (text, fileName, { toastErrors = false } = {}) => {
    let parsed;
    try {
      parsed = parseBackup(text);
    } catch (err) {
      if (toastErrors) notify(err.message);
      return err.message;
    }
    await flushSave();
    const { record, newId } = await projects.restoreProject(parsed.record);
    applyProject(record);
    if (parsed.actMode) setActMode(parsed.actMode);
    const { dictionary: merged, added } = mergeBackupDictionary(dictOverrides, parsed.dictionary);
    if (added) {
      setDictOverrides(merged);
      projects.setSetting(DICTIONARY_KEY, merged).catch(() => {});
    }
    setImportSeed(null);
    setDrawerOpen(false);
    const title = record.title?.trim() || 'Untitled';
    notify(newId
      ? `Restored “${title}” from ${fileName} · added beside the existing copy`
      : `Restored “${title}” from ${fileName}`);
    return true;
  };

  /** Export any project — the open one from live state, others from the library. */
  const exportProject = async (id, kind) => {
    if (kind === 'draftline') {
      if (id === projectId) {
        backupProject();
        return;
      }
      const rec = await projects.getProject(id);
      if (rec) downloadBackup(rec);
      return;
    }
    let doc = { meta, blocks };
    if (id !== projectId) {
      const rec = await projects.getProject(id);
      if (!rec) return;
      doc = toDoc(rec);
    }
    const name = slugify(doc.meta.title);
    if (kind === 'fdx') download(`${name}.fdx`, toFDX(doc), 'application/xml;charset=utf-8');
    else download(`${name}.fountain`, toFountain(doc), 'text/plain;charset=utf-8');
    notify(`Exported ${name}.${kind}`);
  };

  const renameProject = async (id, title) => {
    if (id === projectId) setMeta((m) => ({ ...m, title }));
    else await projects.renameProject(id, title);
  };

  const duplicateProject = async (id) => {
    if (id === projectId) await flushSave();
    const copy = await projects.duplicateProject(id);
    notify(`Duplicated as “${copy.title}”`);
  };

  const deleteProject = async (id, title) => {
    if (!window.confirm(`Delete “${title}”? This removes the script and its Scene Board cards from this browser and can’t be undone. Export it first if you might want it back.`)) return;
    if (id === projectId) {
      // Move to the most recently edited other script first, then delete.
      const next = (await projects.getAllProjects()).find((p) => p.id !== id);
      if (!next) return;
      await flushSave();
      applyProject(next);
    }
    try {
      await projects.deleteProject(id);
      notify(`Deleted “${title}”`);
    } catch (e) {
      notify(e.message);
    }
  };

  const openFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      if (isBackupFile(file.name)) {
        await restoreBackup(text, file.name, { toastErrors: true });
        return;
      }
      // Plain .txt scripts (Docs/Word exports) go through the importer so they can be previewed.
      if (/\.(txt|text)$/i.test(file.name)) {
        setImportSeed({ text, name: file.name });
        return;
      }
      const parsed = /\.fdx$/i.test(file.name) ? parseFDX(text) : parseFountain(text);
      if (!parsed.blocks.length) {
        notify('No screenplay elements found in that file');
        return;
      }
      await openAsNewProject({
        meta: { ...EMPTY_META, ...parsed.meta, title: parsed.meta.title || file.name.replace(/\.[^.]+$/, '') },
        blocks: parsed.blocks.map((b) => makeBlock(b.type, b.text, blockExtras(b))),
        beats: [],
      }, `Opened ${file.name} as a new project`);
    } catch (err) {
      notify(err.message || 'Could not open that file');
    }
  };

  /** Load parsed text into the editor. Replacing is one undoable step (Ctrl+Z restores the old script). */
  const importScript = ({ blocks: parsed, meta: detected, mode, stats }) => {
    const incoming = parsed.map((b) => makeBlock(b.type, b.text, blockExtras(b)));
    if (mode === 'append') set((prev) => [...prev, ...incoming]);
    else set(incoming);
    if (detected) {
      setMeta((m) => ({
        ...m,
        title: detected.title || m.title,
        credit: detected.credit || m.credit,
        author: detected.author || m.author,
        basedOn: detected.basedOn || m.basedOn,
        draftVersion: detected.draftVersion || m.draftVersion,
        draftDate: detected.draftDate || m.draftDate,
        contact: detected.contact || m.contact,
      }));
    }
    setImportSeed(null);
    setSelectedChar(null);
    setActiveId(null);
    if (view === 'board') setView('page');
    notify(`${mode === 'append' ? 'Appended' : 'Imported'} ${stats.scene} scenes · ${stats.dialogue} dialogue blocks · Ctrl+Z to undo`);
  };

  const printScript = () => {
    flushSync(() => setPrinting(true));
    window.print();
  };

  const zoomBy = (dir) => {
    const i = ZOOM_STEPS.findIndex((z) => z >= zoom - 0.001);
    setZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, (i < 0 ? 2 : i) + dir))]);
  };

  // ---- Title page as Page 0 ----
  const showCover = useCallback(() => {
    setCoverVisible(true);
    setFocusMode(false);
    if (view === 'board') setView('page');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelector('.cover-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }, [view]);

  const backToScript = useCallback(() => {
    document.querySelector('.sheet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const first = document.querySelector('.sheet .el-input');
    first?.focus({ preventScroll: true });
  }, []);

  const jumpTo = useCallback((id) => {
    if (view === 'board') {
      setView('split');
      requestAnimationFrame(() => requestAnimationFrame(() => editorRef.current?.focusBlock(id)));
    } else {
      editorRef.current?.focusBlock(id);
    }
  }, [view]);

  const cycleView = useCallback(() => {
    setView((v) => VIEWS[(VIEWS.findIndex((x) => x.id === v) + 1) % VIEWS.length].id);
  }, []);

  // Print view is only mounted while printing (Export → Print Script / PDF, or Ctrl+P).
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  // ---- Global shortcuts ----
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const t = e.target;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveNow().then((rec) => notify(rec ? 'Saved to Projects · use Export for files' : 'Could not save — browser storage is full or blocked'));
      } else if (e.altKey && !mod && e.code === 'KeyI') {
        e.preventDefault();
        setDock((d) => toggleDock(d, 'bible'));
      } else if (e.altKey && !mod && e.code === 'KeyP') {
        e.preventDefault();
        setDrawerOpen((o) => !o);
      } else if (e.altKey && !mod && e.code === 'KeyC') {
        e.preventDefault();
        setDock((d) => toggleDock(d, 'characters'));
      } else if (e.altKey && !mod && e.code === 'KeyT') {
        e.preventDefault();
        toggleDialogueTab();
      } else if (e.altKey && !mod && e.code === 'KeyS') {
        e.preventDefault();
        setNavOpen((o) => !o);
      } else if (mod && !e.altKey && e.code === 'Slash') {
        e.preventDefault();
        setHelpKind((k) => (k === 'shortcuts' ? null : 'shortcuts'));
      } else if (e.altKey && !mod && e.code === 'KeyB') {
        e.preventDefault();
        cycleView();
      } else if (e.key === 'Escape' && filter && !e.defaultPrevented && !titleOpen && !importSeed && !doctorOpen && !renameFrom) {
        setSelectedChar(null); // clear the Dialogue filter first; the next Esc can leave Focus mode
      } else if (e.key === 'Escape' && focusMode && !titleOpen && !importSeed && !doctorOpen) {
        setFocusMode(false);
      } else if (mod && !e.defaultPrevented && !titleOpen && !importSeed && !doctorOpen && !renameFrom
        && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')
        // Script undo covers the editor, the Dialogue panel and Scene Board moves (focus on a card's grip
        // or the board itself) — but a card's own title / synopsis text keeps the browser's text undo.
        && !['INPUT', 'SELECT'].includes(t.tagName) && !(t.tagName === 'TEXTAREA' && t.closest?.('.board'))) {
        e.preventDefault();
        if (e.key.toLowerCase() === 'y' || e.shiftKey) redo(); else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode, titleOpen, importSeed, doctorOpen, renameFrom, notify, undo, redo, cycleView, saveNow, toggleDialogueTab, filter]);

  const hints = activeBlock ? flowHints(activeBlock.type) : null;
  const currentSceneId = activeId ? analysis.sceneOfBlock[activeId] : null;
  const currentPage = activeId ? layout.pageOfBlock[activeId] : null;
  const navVisible = navOpen && !focusMode && showEditor;
  const elementControlsEnabled = !!activeBlock && showEditor;

  // Density: jump to skim risk `i` — scroll it to the middle and pulse it (Editor.pulseBlock).
  const densityLocations = useMemo(
    () => riskLocations(density, { sceneOf: analysis.sceneOfBlock, scenes, pageOf: layout.pageOfBlock }),
    [density, analysis, scenes, layout],
  );
  const jumpToRisk = (i) => {
    const target = density.list[i];
    if (!target) return;
    setDensityIndex(i);
    if (view === 'board' && !focusMode) setView('page');
    // After this render (highlights on, editor shown), so the element exists and is marked.
    requestAnimationFrame(() => requestAnimationFrame(() => editorRef.current?.pulseBlock(target.id)));
  };

  const exportItems = [
    { heading: 'Screenplay' },
    { label: 'Fountain', hint: '.fountain', onSelect: exportFountain },
    { label: 'Final Draft', hint: '.fdx', onSelect: exportFDX },
    { divider: true },
    { heading: 'Scene outline' },
    { label: 'Fountain outline', hint: '.fountain', onSelect: () => exportOutline('fountain') },
    { label: 'Markdown', hint: '.md', onSelect: () => exportOutline('md') },
    { divider: true },
    { heading: 'Document' },
    { label: 'Print Script / PDF', hint: 'Ctrl+P', onSelect: printScript },
    { divider: true },
    { heading: 'Project' },
    { label: 'Backup Project', hint: '.draftline', onSelect: backupProject },
  ];

  return (
    <>
      <div
        className={[
          'app',
          `view-${focusMode ? 'page' : view}`,
          dock && !focusMode ? 'dock-open' : '',
          navVisible ? 'nav-open' : '',
          focusMode ? 'focus-mode' : '',
        ].filter(Boolean).join(' ')}
        data-canvas={canvasTheme}
      >
        <header className="bar" ref={barRef}>
          {/* 1 · Identity & metadata */}
          <div className="bar-group g-identity">
            <button
              className={`btn btn-icon${navVisible ? ' is-on-subtle' : ''}`}
              onClick={() => setNavOpen((o) => !o)}
              disabled={!showEditor}
              title="Scenes (Alt+S)"
              aria-label="Toggle scene list"
              aria-pressed={navVisible}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="currentColor" />
                <line x1="6" y1="2.5" x2="6" y2="13.5" stroke="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              className={`brand${drawerOpen ? ' is-open' : ''}`}
              onClick={() => setDrawerOpen((o) => !o)}
              title="Switch Project (Alt+P)"
              aria-label="Projects"
              aria-expanded={drawerOpen}
            >
              <span className="brand-mark">D</span>
              <span className="brand-name">DraftLine</span>
            </button>
            <div className={`doc-meta${authorCramped ? ' is-cramped' : ''}`}>
              <div className={`doc-switch${drawerOpen ? ' is-open' : ''}`}>
                <input
                  className="doc-title"
                  style={{ width: `calc(${Math.max(6, meta.title.length)} * 0.6em + 14px)` }}
                  value={meta.title}
                  onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
                  placeholder="Untitled"
                  aria-label="Script title"
                />
                <button
                  type="button"
                  className="doc-switch-btn"
                  onClick={() => setDrawerOpen((o) => !o)}
                  title="Switch Project (Alt+P)"
                  aria-label="Switch Project"
                  aria-expanded={drawerOpen}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
              <span className="doc-by">by</span>
              <input
                ref={authorRef}
                className="doc-author"
                style={{ width: `calc(${Math.max(6, meta.author.length)} * 0.58em + 14px)` }}
                value={meta.author}
                onChange={(e) => setMeta((m) => ({ ...m, author: e.target.value }))}
                placeholder="Author"
                aria-label="Author"
              />
            </div>
          </div>

          <span className="bar-sep" aria-hidden="true" />

          {/* 2 · Document operations */}
          <div className="bar-group">
            <button className="btn" onClick={() => newScript()} title="Start a new script (your others stay in Projects)">New</button>
            <button className="btn" onClick={() => fileInputRef.current?.click()} title="Open .fountain, .fdx, .txt or a .draftline backup">Open</button>
            <button className="btn" onClick={() => setImportSeed({ text: '', name: '' })} title="Import a script from Google Docs, Word, a PDF or plain text">Import</button>
            <button className="btn" onClick={() => setTitleOpen(true)}>
              Title Page
            </button>
            <input ref={fileInputRef} type="file" accept=".fountain,.spmd,.txt,.fdx,.draftline" hidden onChange={openFile} />
          </div>

          <span className="bar-sep" aria-hidden="true" />

          {/* 3 · Active element & formatting */}
          <div className="bar-group">
            <select
              className="type-select"
              value={elementControlsEnabled ? activeBlock.type : ''}
              disabled={!elementControlsEnabled}
              onChange={(e) => {
                // "Dual Dialogue" is an action on the speech, not a type: the select keeps showing the type.
                if (e.target.value === DUAL_SHORTCUT.action) editorRef.current?.toggleDual(activeId);
                else editorRef.current?.setType(activeId, e.target.value);
              }}
              aria-label="Element type"
              title="Element type (Alt+1…8) · Dual Dialogue (Alt+D)"
            >
              {!elementControlsEnabled && <option value="">Element</option>}
              {ELEMENT_MENU.map((s) => (s.action ? (
                <option key={s.action} value={s.action}>
                  {`${activeInDual && elementControlsEnabled ? '✓ ' : ''}${s.label}  ·  ${s.combo}`}
                </option>
              ) : (
                <option key={s.type} value={s.type}>{`${s.label}  ·  ${s.combo}`}</option>
              )))}
            </select>
            <div className="fmt-seg" role="group" aria-label="Text formatting">
              {STYLES.map((k) => {
                const on = fmtState[k] && elementControlsEnabled;
                return (
                  <button
                    key={k}
                    type="button"
                    className={`fmt-btn fmt-${k}${on ? ' is-on' : ''}`}
                    disabled={!elementControlsEnabled}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editorRef.current?.format(k)}
                    title={`${STYLE_INFO[k].label} (${STYLE_INFO[k].keys}) · Clear formatting: Ctrl+\\`}
                    aria-label={STYLE_INFO[k].label}
                    aria-pressed={on}
                  >
                    {k.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <span className="bar-sep" aria-hidden="true" />

          {/* 4 · Workspace views */}
          <div className="seg" role="radiogroup" aria-label="Workspace view (Alt+B cycles)">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                role="radio"
                aria-checked={view === v.id}
                className={`seg-btn${view === v.id ? ' is-on' : ''}`}
                onClick={() => setView(v.id)}
                title={`${v.title} · Alt+B cycles`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* 5 · Output & side panels */}
          <div className="bar-group bar-right">
            <Menu label="Export" items={exportItems} align="right" title="Export the screenplay or scene outline, print / save as PDF, or back up the project" />
            <button
              className={`btn btn-snapshot${snapshotsOpen ? ' is-on-subtle' : ''}`}
              onClick={() => setSnapshotPrompt(true)}
              title={`Snapshot this draft — a labelled checkpoint you can restore${revisions.length ? ` · ${revisions.length} saved (⋮ → View Snapshots)` : ''}`}
              aria-label="Snapshot"
            >
              <svg className="snap-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2.5 5h2l1.2-1.6h4.6L11.5 5h2a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                <circle cx="8" cy="9.2" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              <span className="snap-label">Snapshot</span>
              {revisions.length > 0 && <span className="btn-count" aria-label={`${revisions.length} saved`}>{revisions.length}</span>}
            </button>
            <button className="btn" onClick={() => setFocusMode(true)} title="Hide everything but the page (Esc to exit)">Focus</button>
            <button
              ref={bibleBtnRef}
              className={`btn btn-bible${bibleOpen ? ' is-on-subtle' : ''}`}
              onClick={() => setDock((d) => toggleDock(d, 'bible'))}
              title="Story Bible: DNA (Blueprint & Glossary) · Notes (Alt+I)"
              aria-pressed={bibleOpen}
            >
              Story Bible
            </button>
            <button
              ref={charactersBtnRef}
              className={`btn btn-accent${charactersOpen ? ' is-on' : ''}`}
              onClick={() => setDock((d) => toggleDock(d, 'characters'))}
              title="Characters: Bios · Dialogue (Alt+C · Alt+T opens Dialogue)"
              aria-pressed={charactersOpen}
            >
              Characters
            </button>
            <Menu
              label={<span className="kebab" aria-hidden="true">⋮</span>}
              caret={false}
              className="btn btn-kebab"
              align="right"
              title="More: snapshots, margin notes, keyboard shortcuts, sample script, about"
              ariaLabel="More"
              items={() => moreMenuItems({
                // Checked as the menu opens: panels the toolbar is showing aren't repeated here.
                bibleOnBar: isOnBar(bibleBtnRef.current, barRef.current),
                charactersOnBar: isOnBar(charactersBtnRef.current, barRef.current),
                onBible: () => setDock((d) => openDock(d, 'bible')),
                onCharacters: () => setDock((d) => openDock(d, 'characters')),
                onSnapshots: () => setDock((d) => openDock(d, 'snapshots')),
                snapshotCount: revisions.length,
                onNotes: () => {
                  setNoteId(null);
                  setDock((d) => openDock(d, 'notes'));
                },
                noteCount,
                onShortcuts: () => setHelpKind('shortcuts'),
                onSample: loadSample,
                onAbout: () => setHelpKind('about'),
              })}
            />
          </div>
        </header>

        <Navigator
          open={navVisible}
          scenes={scenes}
          pageCount={layout.pageCount}
          currentSceneId={currentSceneId}
          onJump={jumpTo}
          onClose={() => setNavOpen(false)}
          coverVisible={coverVisible}
          onShowCover={showCover}
        />

        <div className="workspace">
          <main className="scroller" ref={scrollerRef} hidden={!showEditor}>
            {filter && (
              <div className="filter-banner" role="status">
                <span className="filter-dot" aria-hidden="true" />
                <span>{filterLabel(filter)}</span>
                <button type="button" className="filter-clear" onClick={() => setSelectedChar(null)} title="Show the whole script again (Esc)">
                  Clear Filter ✕
                </button>
              </div>
            )}
            {coverVisible && (
              <div
                className="cover-wrap"
                style={{ '--in': `${Math.max(6, Math.round(16 * effectiveZoom)) * 6}px` }}
              >
                <div className="cover-tools">
                  <span className="cover-label">Page 0 · Title Page</span>
                  <button className="cover-btn" onClick={() => setTitleOpen(true)}>Edit</button>
                  <button className="cover-btn cover-primary" onClick={backToScript}>Back to Script ↓</button>
                  <button
                    className="cover-btn cover-close"
                    onClick={() => setCoverVisible(false)}
                    aria-label="Hide the title page"
                    title="Hide the title page (it still prints)"
                  >
                    ×
                  </button>
                </div>
                <TitlePageSheet meta={meta} className="cover-sheet" />
              </div>
            )}
            <Editor
              key={projectId}
              ref={editorRef}
              blocks={blocks}
              items={items}
              layout={layout}
              sceneNumbers={analysis.sceneNumbers}
              activeId={activeId}
              highlightId={hoverId}
              spotlight={filter?.ids ?? null}
              dense={densityMode && density.dense ? density.ids : null}
              zoom={effectiveZoom}
              hidden={!showEditor}
              onCommit={commitBlocks}
              onTextChange={updateBlockText}
              onFormatState={setFmtState}
              openNoteId={notesOpen && !focusMode ? noteId : null}
              onOpenNote={openNote}
              onUndo={undo}
              onRedo={redo}
              onActiveChange={setActiveId}
              onMeasure={onMeasure}
              onNotice={notify}
            />
          </main>
          {showBoard && (
            <BeatBoard
              key={projectId}
              beats={beats}
              onChange={setBeats}
              onMoveCard={moveCard}
              onExport={exportOutline}
              compact={view === 'split'}
              actMode={actMode}
              onActModeChange={setActMode}
              scenes={boardScenes}
              pageCount={layout.pageCount}
              onJump={jumpTo}
            />
          )}
        </div>

        <CharactersDrawer
          key={`characters-${projectId}`}
          open={charactersOpen && !focusMode}
          onClose={() => setDock((d) => closeDock(d, 'characters'))}
          tab={characterTab}
          onTabChange={setCharacterTab}
          characters={characters}
          onCharactersChange={setCharacters}
          speakers={speakers}
          onRenameCharacter={setRenameFrom}
          revealBio={revealBio}
          dialogue={{
            analysis,
            pageOfBlock: layout.pageOfBlock,
            selected: selectedChar,
            onSelect: setSelectedChar,
            onEditText: updateBlockText,
            onJump: jumpTo,
            onHover: setHoverId,
          }}
        />

        <footer className="status">
          <span className="status-type">{activeBlock && showEditor ? ELEMENT_META[activeBlock.type].label : VIEWS.find((v) => v.id === view).label}</span>
          {hints && showEditor && (
            <span className="status-hints">
              <kbd>Enter</kbd> {hints.enter}
              <kbd>Tab</kbd> {hints.tab}
            </span>
          )}
          <button
            className={`status-doctor${issues.length ? ' has-issues' : ''}`}
            onClick={() => setDoctorOpen(true)}
            title="Format Doctor: find mis-tagged sluglines, cues and dialogue"
          >
            <span className="doctor-dot" aria-hidden="true" />
            Format Doctor{issues.length ? ` · ${issues.length}` : ''}
          </button>
          <span className="status-spacer" />
          <span className={`status-save${dirty ? ' is-pending' : ''}${saved.ok ? '' : ' is-error'}`} title={saved.at ? `Last saved ${timeLabel(saved.at)}` : ''}>
            <span className="save-dot" aria-hidden="true" />
            {saveLabel}
          </span>
          <span>{analysis.sceneCount} scenes</span>
          {noteCount > 0 && (
            <button
              type="button"
              className="status-btn"
              onClick={() => {
                if (notesOpen) closeNotes(false);
                else {
                  setNoteId(null);
                  setDock((d) => openDock(d, 'notes'));
                }
              }}
              title="Margin notes — private, never printed or exported"
            >
              {noteCount} {noteCount === 1 ? 'note' : 'notes'}
            </button>
          )}
          <span>{analysis.words.toLocaleString()} words</span>
          <DensityNav
            density={density}
            on={densityMode}
            index={densityIndex}
            locations={densityLocations}
            onStart={({ jump }) => {
              setDensityMode(true);
              if (jump) jumpToRisk(stepRisk(-1, density.dense, 'first'));
            }}
            onStep={(dir) => jumpToRisk(stepRisk(densityIndex, density.dense, dir))}
            onGo={(i) => jumpToRisk(stepRisk(densityIndex, density.dense, { type: 'go', index: i }))}
            onOff={() => {
              setDensityMode(false);
              setDensityIndex(-1);
            }}
          />
          <span title="54 lines per page">
            {currentPage && showEditor ? `p. ${currentPage} of ${layout.pageCount}` : `${layout.pageCount} ${layout.pageCount === 1 ? 'page' : 'pages'}`}
          </span>
          <button
            type="button"
            className={`mini status-canvas is-${canvasTheme}`}
            onClick={toggleCanvasTheme}
            title={`Page colour: ${canvasThemeInfo(canvasTheme).label}. Switch to ${themeNext.label} — ${themeNext.hint}`}
            aria-label={`Page colour: ${canvasThemeInfo(canvasTheme).label}. Switch to ${themeNext.label}`}
          >
            <span className="canvas-swatch" aria-hidden="true" />
            {canvasThemeInfo(canvasTheme).label}
          </button>
          <span className="status-history">
            <button className="mini" onClick={undo} disabled={!canUndo} title="Undo script edit (Ctrl+Z)">↶</button>
            <button className="mini" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">↷</button>
          </span>
          <span className="status-zoom">
            <button className="mini" onClick={() => zoomBy(-1)} aria-label="Zoom out">−</button>
            <button
              className="mini zoom-val"
              onClick={() => setZoom(1)}
              title={isFitted ? 'Shrunk to fit beside the open panels · click to reset zoom' : 'Reset zoom'}
            >
              {zoomPct(effectiveZoom)}%{isFitted ? ' fit' : ''}
            </button>
            <button className="mini" onClick={() => zoomBy(1)} aria-label="Zoom in">+</button>
          </span>
        </footer>

        {focusMode && (
          <div className="focus-controls">
            <button type="button" className="focus-exit" onClick={toggleCanvasTheme} title={`Switch to ${themeNext.label}`}>
              {themeNext.label}
            </button>
            <button type="button" className="focus-exit" onClick={() => setFocusMode(false)}>Exit focus · Esc</button>
          </div>
        )}
        {toast && <div className="toast" role="status">{toast}</div>}
        <CueBioCard root={scrollerEl} characters={characters} onEdit={editBio} disabled={!showEditor || printing} />

        <ProjectBibleDrawer
          key={`bible-${projectId}`}
          open={bibleOpen && !focusMode}
          onClose={() => setDock((d) => closeDock(d, 'bible'))}
          tab={bibleTab}
          onTabChange={setBibleTab}
          projectTitle={meta.title}
          storyNotes={storyNotes}
          onStoryNotesChange={setStoryNotes}
          storyDna={storyDna}
          onStoryDnaChange={setStoryDna}
          dictionary={dictionary}
          onDictionaryEdit={editDictionary}
        />

        <SnapshotsDrawer
          open={snapshotsOpen && !focusMode}
          revisions={revisions}
          projectTitle={meta.title}
          onClose={() => setDock((d) => closeDock(d, 'snapshots'))}
          onSnapshot={() => setSnapshotPrompt(true)}
          onRestore={(id) => setRestoreId(id)}
          onDelete={deleteSnapshot}
        />

        <NotesDrawer
          open={notesOpen && !focusMode}
          blocks={blocks}
          noteId={noteId}
          pageOf={layout.pageOfBlock}
          projectTitle={meta.title}
          onSelect={(id) => {
            openNote(id);
            editorRef.current?.revealBlock?.(id);
          }}
          onChange={changeNote}
          onDelete={deleteNote}
          onRestoreVersion={restoreNote}
          onJump={(id) => editorRef.current?.focusBlock(id)}
          onClose={closeNotes}
        />

        {snapshotPrompt && (
          <SnapshotPrompt
            count={revisions.length}
            onSave={takeSnapshot}
            onViewAll={() => {
              setSnapshotPrompt(false);
              setDock((d) => openDock(d, 'snapshots'));
            }}
            onClose={() => setSnapshotPrompt(false)}
          />
        )}
        {restoreId && getRevision(revisions, restoreId) && (
          <RestorePrompt
            revision={getRevision(revisions, restoreId)}
            dirty={!revisions.length || JSON.stringify(revisions[revisions.length - 1].script) !== JSON.stringify(blocks)}
            onRestore={(keep) => restoreSnapshot(restoreId, keep)}
            onClose={() => setRestoreId(null)}
          />
        )}

        <ProjectsDrawer
          open={drawerOpen}
          activeId={projectId}
          live={{ title: meta.title, author: meta.author, pages: layout.pageCount, scenes: analysis.sceneCount, updatedAt: saved.at, dirty }}
          loadProjects={projects.getAllProjects}
          onClose={() => setDrawerOpen(false)}
          onSwitch={switchProject}
          onCreate={newScript}
          onRename={renameProject}
          onDuplicate={duplicateProject}
          onExport={exportProject}
          onDelete={deleteProject}
        />

        {helpKind && (
          <HelpModal
            kind={helpKind}
            storage={{ ok: saved.ok, savedAt: saved.at, bytes: JSON.stringify({ meta, blocks, beats, characters, storyNotes, storyDna }).length, countProjects: () => projects.getAllProjects().then((l) => l.length) }}
            onBackup={backupProject}
            onClose={() => setHelpKind(null)}
          />
        )}

        {doctorOpen && (
          <FormatDoctorModal
            issues={issues}
            pageOfBlock={layout.pageOfBlock}
            onFix={(it) => fixIssues([it])}
            onFixAll={() => fixIssues(issues)}
            onShow={(id) => {
              setDoctorOpen(false);
              requestAnimationFrame(() => jumpTo(id));
            }}
            onClose={() => setDoctorOpen(false)}
          />
        )}
        {importSeed && (
          <ImportModal
            initialText={importSeed.text}
            initialName={importSeed.name}
            currentBlockCount={blocks.length}
            onImport={importScript}
            onBackup={restoreBackup}
            onClose={() => setImportSeed(null)}
          />
        )}
        {renameFrom && (
          <RenameCharacterModal
            oldName={renameFrom}
            project={renameSource}
            speakers={speakers}
            onConfirm={(newName, categories) => renameCharacterEverywhere(renameFrom, newName, categories)}
            onClose={() => setRenameFrom(null)}
          />
        )}
        {titleOpen && (
          <TitlePageModal
            meta={meta}
            onClose={() => setTitleOpen(false)}
            onSave={(next) => {
              setMeta((m) => ({ ...m, ...next }));
              rememberAuthorDefaults(next); // the next new script starts with this author / contact
              setTitleOpen(false);
              notify('Title page updated');
            }}
            onViewCover={(next) => {
              setMeta((m) => ({ ...m, ...next }));
              rememberAuthorDefaults(next);
              setTitleOpen(false);
              showCover();
            }}
          />
        )}
      </div>

      {printing && (
        <PrintView meta={meta} items={items} layout={layout} sceneNumbers={analysis.sceneNumbers} />
      )}
    </>
  );
}
