import {
  Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
} from 'react';
import { flushSync } from 'react-dom';
import Editor from './components/Editor.jsx';
import CharactersDrawer from './components/CharactersDrawer.jsx';
import Navigator from './components/Navigator.jsx';
import TitlePageModal from './components/TitlePageModal.jsx';
import DeleteProjectModal from './components/DeleteProjectModal.jsx';
import DialogueStepper from './components/DialogueStepper.jsx';
import { Clapperboard, Columns2, FileText, LayoutList, PenLine, Rows3, SquareKanban } from 'lucide-react';
import { addAsset, removeAsset, setSceneNotes } from './lib/productionData.js';
import { csvOutlineFileName, outlineCsv } from './lib/exportCsvOutline.js';
import FormatStepper from './components/FormatStepper.jsx';
import { applyFixes, auditScript, canFix } from './lib/formatDoctor.js';
import TitlePageSheet from './components/TitlePageSheet.jsx';
import PrintView from './components/PrintView.jsx';
import Menu from './components/Menu.jsx';
import { useHistory } from './hooks/useHistory.js';
// The User Guide (and its text) loads the first time it's opened; the service worker caches it for offline use.
const UserGuideModal = lazy(() => import('./components/UserGuideModal.jsx'));
const ExportBibleModal = lazy(() => import('./components/ExportBibleModal.jsx'));
const SnapshotCompare = lazy(() => import('./components/SnapshotCompare.jsx'));
// The Scene Board (Board / Split views) loads the first time it's shown.
const BeatBoard = lazy(() => import('./components/BeatBoard.jsx'));
// The Plan workspace (Breakdowns · Stripboard) loads the first time you switch to it.
const PlanningWorkspace = lazy(() => import('./components/planning/PlanningWorkspace.jsx'));
// So do the occasional dialogs — About / Shortcuts, Import, Format Doctor, Rename — keeping the app's first load small.
const HelpModal = lazy(() => import('./components/HelpModal.jsx'));
const ImportModal = lazy(() => import('./components/ImportModal.jsx'));
const FormatDoctorModal = lazy(() => import('./components/FormatDoctorModal.jsx'));
const RenameCharacterModal = lazy(() => import('./components/RenameCharacterModal.jsx'));
import LockBadge from './components/LockBadge.jsx';
import { LOCK_COMBO, isLockShortcut } from './lib/lock.js';
import ProjectsDrawer from './components/ProjectsDrawer.jsx';
import ProjectBibleDrawer from './components/ProjectBibleDrawer.jsx';
import NotesDrawer from './components/NotesDrawer.jsx';
import CueBioCard from './components/CueBioCard.jsx';
import { RestorePrompt, SnapshotPrompt, SnapshotsDrawer } from './components/Snapshots.jsx';
import { addRevision, changedSince, createRevision, getRevision, partsOf, removeRevision } from './lib/revisions.js';
import { endNoteSession, hasNote, restoreNoteVersion, setNoteText, startNote } from './lib/editorialNotes.js';
import { renameCharacter, revertRename } from './lib/renameCharacter.js';
import { moveCardStep, relinkSceneCards } from './lib/sceneSync.js';
import { dialogueFilter, dialogueKeyAction, dialogueStops } from './lib/dialogueFilter.js';
import { canvasThemeInfo, nextCanvasTheme, readCanvasTheme, writeCanvasTheme } from './lib/canvasTheme.js';
import { mergeDictionary } from './lib/structureDictionary.js';
import { characterTabFromPrefs, closeDock, dockFromPrefs, openDock, toggleDock } from './lib/dock.js';
import { ACT_STRUCTURES, DEFAULT_ACT_STRUCTURE, DEFAULT_BIBLE_TAB, convertNotesActs, realignActs } from './lib/bible.js';
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
import { fileMenuItems, isOnBar, moreMenuItems } from './lib/toolbar.js';
import { newProjectMeta, rememberAuthorDefaults } from './lib/authorDefaults.js';
import { parseFountain, toFountain } from './lib/fountain.js';
import { parseFDX, toFDX } from './lib/fdx.js';
import { beatsToFountain, beatsToMarkdown, sampleBeats } from './lib/beats.js';
import { SAMPLE_SCRIPT } from './lib/sampleScript.js';
import { effectiveZoomFor } from './lib/zoom.js';
import { actionDensity, riskLocations, stepRisk } from './lib/pacing.js';
import DensityStepper from './components/DensityStepper.jsx';
import BrandMark from './components/BrandMark.jsx';
import { MILESTONES, MILESTONE_TOAST_MS, finishedSentence, milestonesReached } from './lib/milestones.js';
import { createNoirAudio } from './lib/noirAudio.js';
import { NOIR_CLASS, NOIR_COMBO, noirGenrePicked, noirKeyAction } from './lib/noir.js';
import {
  AUTO_SNAPSHOT_INTERVAL_MS, TRASH_DIR, createFolderSync, mergeProjectLists, saveProjectEverywhere, storageStatus,
} from './lib/folderSync.js';
import './App.css';

// Scripts live in IndexedDB (lib/projectStorage.js); localStorage keeps only UI prefs.
const PREFS_KEY = 'draftline:prefs:v1';
const SAVE_DEBOUNCE_MS = 500;

// Folder sync (lib/folderSync.js): an optional linked folder — Google Drive or any local folder —
// that gets a .draftline copy of each script after every browser save. Its settings (the folder
// handle, Browser vs Synced Folder) live in the library's IndexedDB settings store.
const folderSync = createFolderSync({ settings: { get: (k) => projects.getSetting(k), set: (k, v) => projects.setSetting(k, v) } });
const ZOOM_STEPS = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
/** The top-level switch: writing the script, or planning its production (derived from the script). */
const WORKSPACES = [
  { id: 'write', label: 'Write', title: 'The script, Scene Board and Story Bible', Icon: PenLine },
  { id: 'plan', label: 'Plan', title: 'Production planning: breakdowns and stripboard, from the script', Icon: Clapperboard },
];
const PLAN_VIEWS = [
  { id: 'breakdowns', label: 'Breakdowns', title: 'Every scene’s cast, setting, length and the props, wardrobe, vehicles and extras you add', Icon: LayoutList },
  { id: 'stripboard', label: 'Stripboard', title: 'One colour-coded strip per scene, in script order', Icon: Rows3 },
];
const VIEWS = [
  { id: 'page', label: 'Page', title: 'Script only', Icon: FileText },
  { id: 'split', label: 'Split', title: 'Script + Scene Board side by side', Icon: Columns2 },
  { id: 'board', label: 'Board', title: 'Scene Board only', Icon: SquareKanban },
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
    const bl = d.blocks.length ? d.blocks : [makeBlock('scene')];
    return { ...d, blocks: bl, beats: relinkSceneCards(d.beats, bl) };
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
  // Plan workspace: per-scene asset lists (lib/productionEngine.js), saved with the project.
  const [production, setProduction] = useState(initialDoc.production); // toDoc normalized it
  // Project Lock (Projects → padlock) on the open script: saved on its record by setProjectLock, read here
  // to guard imports and snapshot restores. Not the View Only lock (isLocked: this session's editing).
  const [projectLocked, setProjectLocked] = useState(initialDoc.isLocked === true);
  const [revisions, setRevisions] = useState(initialDoc.revisions); // Snapshots (lib/revisions.js)
  const [snapshotPrompt, setSnapshotPrompt] = useState(false);
  const [restoreId, setRestoreId] = useState(null); // the snapshot waiting on "Restore?"
  const [compareId, setCompareId] = useState(null); // the snapshot open in Compare (read-only)
  const [noteId, setNoteId] = useState(null); // the element whose margin note the Notes drawer shows
  const noteSession = useRef(null); // { id, start } — the note's text when this editing stretch began
  const [dictOverrides, setDictOverrides] = useState(boot.dictionary || {}); // Glossary wording (all projects)
  // Folder sync: where scripts are kept (browser only, or browser + a linked folder).
  const sync = useSyncExternalStore(folderSync.subscribe, folderSync.getState);
  const [folderSnaps, setFolderSnaps] = useState({ projectId: null, list: [] }); // <folder>/Snapshots files
  const [autoSnapCount, setAutoSnapCount] = useState(0); // bumped per automatic snapshot: the drawer re-reads the folder
  const [focusStorage, setFocusStorage] = useState(0); // bumped by the status bar → Projects' storage block

  const [lineMap, setLineMap] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [view, setView] = useState(VIEWS.some((v) => v.id === initialPrefs.view) ? initialPrefs.view : 'page');
  // Right dock: the Story Bible (DNA · Notes) or Characters (Bios · Dialogue) — one at a time (lib/dock.js).
  const [dock, setDock] = useState(() => dockFromPrefs(initialPrefs));
  const charactersOpen = dock === 'characters';
  const bibleOpen = dock === 'bible';
  const snapshotsOpen = dock === 'snapshots';
  // Snapshot files in the synced folder that this browser's copy doesn't have (another computer's,
  // or deleted here): listed beside the rest, restorable like any snapshot.
  const shownFolderSnaps = useMemo(() => {
    if (!sync.active || folderSnaps.projectId !== projectId) return [];
    const mine = new Set(revisions.map((r) => r.id));
    return folderSnaps.list.filter((f) => !mine.has(f.rev.id)).map((f) => ({ ...f.rev, source: 'folder', fileName: f.fileName }));
  }, [sync.active, folderSnaps, projectId, revisions]);
  const allSnapshots = useMemo(() => [...revisions, ...shownFolderSnaps], [revisions, shownFolderSnaps]);
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
  const [actMode, setActMode] = useState(ACT_STRUCTURES.includes(initialPrefs.actMode) ? initialPrefs.actMode : DEFAULT_ACT_STRUCTURE);
  // Switching 3 ⇄ 4 acts (Scene Board or Notes: it's one setting) splits Act II into 2A / 2B, or
  // joins them (remembering the boundary out of sight), in the Synopsis and the Treatment (lib/bible.js convertNotesActs).
  const changeActMode = useCallback((next) => {
    if (!ACT_STRUCTURES.includes(next) || next === actMode) return;
    setStoryNotes((notes) => convertNotesActs(notes, actMode, next, { beats, blocks }));
    setActMode(next);
  }, [actMode, beats, blocks]);
  // Notes → Auto-Align Acts (4 acts): re-split Act 2A / 2B from the Scene Board and the midpoint.
  const realignStoryActs = () => {
    const r = realignActs(storyNotes, { beats, blocks });
    if (!r.changed.length) {
      notify('Act 2A and 2B already start where the Scene Board and midpoint say');
      return;
    }
    setStoryNotes(r.notes);
    notify(`Re-aligned Act 2A / 2B in the ${r.changed.map((c) => (c === 'synopsis' ? 'Synopsis' : 'Treatment')).join(' and ')}`);
  };
  const [coverVisible, setCoverVisible] = useState(initialPrefs.coverVisible ?? false); // Page 0 above the script
  const [specStamp, setSpecStamp] = useState(initialPrefs.specStamp === true); // Title Page → Spec stamp (screen only)
  const [scrollerWidth, setScrollerWidth] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [titleOpen, setTitleOpen] = useState(false);
  const [importSeed, setImportSeed] = useState(null); // { text, name } while the Import modal is open
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [fmtState, setFmtState] = useState({ b: false, i: false, u: false, s: false }); // toolbar B I U S
  const [helpKind, setHelpKind] = useState(null); // 'shortcuts' | 'about' while that dialog is open
  const [guideOpen, setGuideOpen] = useState(false); // User Guide (⋮ → User Guide, F1)
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
  const focusBtnRef = useRef(null);
  const [toast, setToast] = useState(() => bootMessage(boot));
  const [saved, setSaved] = useState(() => ({
    blocks: initialDoc.blocks,
    meta: initialDoc.meta,
    beats: initialDoc.beats,
    characters: initialDoc.characters,
    storyNotes: initialDoc.storyNotes,
    storyDna: initialDoc.storyDna,
    production: initialDoc.production,
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
  // [ Write | Plan ]: Plan hides the writing surfaces without unmounting them, so nothing unsaved
  // or scrolled is lost; switching back puts the page where it was.
  const [workspace, setWorkspace] = useState('write');
  const [planView, setPlanView] = useState('breakdowns');
  // Breakdown cards' open / folded state (Plan): all open or all folded, except the ones toggled by hand.
  // Kept here because Collapse All is on the header; a card is open when closed !== except.has(id).
  const [planFold, setPlanFold] = useState(() => ({ closed: false, except: new Set() }));
  const planAllFolded = planFold.closed && planFold.except.size === 0;
  const foldAllPlan = () => setPlanFold({ closed: !planAllFolded, except: new Set() });
  const togglePlanCard = useCallback((id) => setPlanFold((f) => {
    const except = new Set(f.except);
    if (except.has(id)) except.delete(id);
    else except.add(id);
    return { ...f, except };
  }), []);
  const planFoldBtnRef = useRef(null);
  const planExportBtnRef = useRef(null);
  const planSegRef = useRef(null);
  const inPlan = workspace === 'plan' && !focusMode;
  const showEditor = (view !== 'board' || focusMode) && !inPlan;
  const formatBarShown = showEditor; // Element ▾ and B I U S: Page and Split (and Focus), never Board or Plan
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
  const getBlocks = useCallback(() => latest.current.blocks, []); // Scene Board → Analyze Value Shifts

  // ---- Toasts ----
  const notify = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  // ---- Writing milestones & the FADE OUT. bell (lib/milestones.js) ----
  // Only your own edits count (an edit sets lastEdit), measured from where this session started on
  // this script; each milestone shows once per session, in a corner toast for 3.5 s.
  const lastEdit = useRef({ at: 0, sentence: false });
  const milestonesFired = useRef(new Set());
  const writingSession = useRef(null); // { projectId, startWords, words, pages, blocks }
  const milestoneQueue = useRef([]);
  const milestoneShowing = useRef(false);
  const [milestone, setMilestone] = useState(null);
  // Show queued milestones one after another, 3.5 s each.
  const showNextMilestone = useCallback(function next() {
    const msg = milestoneQueue.current.shift() || null;
    milestoneShowing.current = !!msg;
    setMilestone(msg);
    if (msg) setTimeout(next, MILESTONE_TOAST_MS);
  }, []);

  // ---- View Only lock (Ctrl+Alt+L or the status bar badge; lib/lock.js) ----
  const [isLocked, setIsLocked] = useState(false);
  const toggleLock = useCallback(() => {
    setIsLocked(!isLocked);
    notify(isLocked ? 'Editing on' : `View Only — the script can’t be changed · ${LOCK_COMBO} to edit`);
  }, [isLocked, notify]);
  const notifyLocked = useCallback(() => notify(`View Only · ${LOCK_COMBO} or the View Only badge to edit`), [notify]);
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
    || saved.production !== production
    || saved.revisions !== revisions;
  const latest = useRef(null);
  useLayoutEffect(() => {
    latest.current = {
      projectId, meta, blocks, beats, characters, storyNotes, storyDna, production, revisions, pages: layout.pageCount, scenes: analysis.sceneCount, dirty,
      createdAt: saved.createdAt,
      savedAt: saved.at,
      // What a synced .draftline file carries beside the project (same as Backup Project).
      fileOptions: { actMode, dictionary: dictOverrides, appVersion: pkg.version },
      folderSnaps: shownFolderSnaps,
      projectLocked,
    };
  });

  /** Save the open project now. Resolves with the stored record (or null on failure). */
  const saveNow = useCallback(() => {
    const s = latest.current;
    const snap = {
      meta: s.meta, blocks: s.blocks, beats: s.beats, characters: s.characters, storyNotes: s.storyNotes, storyDna: s.storyDna,
      production: s.production, revisions: s.revisions,
    };
    // The browser first (the ground truth), then — if a folder is synced — its .draftline file.
    // "Saving…" clears as soon as the browser copy is safe; the folder write follows on its own.
    const markSaved = async (rec) => {
      const ok = await projects.isPersistent();
      clearJournal(LOCAL);
      if (latest.current.projectId === s.projectId) setSaved({ ...snap, at: rec.updatedAt, createdAt: rec.createdAt, ok });
    };
    let marked = null;
    return saveProjectEverywhere({
      store: projects,
      sync: folderSync,
      data: { id: s.projectId, ...snap, pages: s.pages, scenes: s.scenes },
      options: s.fileOptions,
      onLocal: (rec) => { marked = markSaved(rec); },
    })
      .then(async ({ record }) => {
        await marked;
        return record;
      })
      .catch(() => {
        if (latest.current.projectId === s.projectId) setSaved((prev) => ({ ...prev, ok: false }));
        return null;
      });
  }, []);

  /** Save only if there are unsaved changes (before switching projects). */
  const flushSave = useCallback(() => (latest.current.dirty ? saveNow() : Promise.resolve(null)), [saveNow]);

  // ---- Folder sync ----
  // Start-up: bring back the linked folder (never prompts — that needs a click on the status bar).
  useEffect(() => {
    folderSync.init();
  }, []);

  // Whenever sync turns on (linked, allowed, chosen): if the folder has a newer copy of the open
  // script — edited on another computer — and nothing here is unsaved, open that; then write
  // the open script out so the folder is current.
  const pullNewer = useRef(null);
  useEffect(() => {
    if (!sync.active) return;
    const id = latest.current.projectId;
    (async () => {
      const there = await folderSync.readProject(id).catch(() => null);
      const s = latest.current;
      if (there && s.projectId === id && !s.dirty && (there.updatedAt || 0) > (s.savedAt || 0)) {
        pullNewer.current?.(there);
        return;
      }
      saveNow();
    })();
  }, [sync.active, sync.folderName, saveNow]);

  // The Snapshots drawer open with sync on: read <folder>/Snapshots for this script.
  useEffect(() => {
    if (!snapshotsOpen || !sync.active) return undefined;
    let live = true;
    folderSync.listSnapshots(projectId).then((list) => live && setFolderSnaps({ projectId, list }));
    return () => {
      live = false;
    };
  }, [snapshotsOpen, sync.active, projectId, revisions.length, autoSnapCount]);

  useEffect(() => {
    if (!dirty) return undefined;
    const t = setTimeout(saveNow, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [dirty, meta, blocks, beats, characters, storyNotes, storyDna, production, revisions, saveNow]);

  // Tab hidden or closing inside the debounce window: start the save, and journal the state
  // synchronously in case the browser kills the page before IndexedDB commits.
  useEffect(() => {
    const flush = () => {
      const s = latest.current;
      if (!s.dirty) return;
      writeJournal(LOCAL, {
        id: s.projectId, meta: s.meta, blocks: s.blocks, beats: s.beats, characters: s.characters, storyNotes: s.storyNotes, storyDna: s.storyDna,
        production: s.production,
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
    writeJSON(PREFS_KEY, { zoom, dock, characterTab, navOpen, view, actMode, coverVisible, specStamp });
  }, [zoom, dock, characterTab, navOpen, view, actMode, coverVisible, specStamp]);

  // Status bar: where the script is saved — browser, synced folder, or "click to allow folder sync".
  const saveStatus = storageStatus({ saveOk: saved.ok, dirty, sync });
  const onSaveStatusClick = () => {
    if (saveStatus.action === 'permission') {
      folderSync.requestPermission().then((ok) => notify(ok ? `Syncing to ${folderSync.getState().folderName}` : 'Folder sync is still off — the browser didn’t get permission'));
      return;
    }
    setDrawerOpen(true);
    setFocusStorage((n) => n + 1);
  };
  // Projects: the browser library plus scripts found only in the synced folder (newest copy wins).
  const loadLibrary = useCallback(async () => mergeProjectLists(await projects.getAllProjects(), await folderSync.listProjects()), []);
  const storageControls = {
    sync,
    onChoose: async (dest) => {
      const ok = await folderSync.setDestination(dest);
      if (dest === 'browser') notify('Saving to this browser only · the folder keeps its files');
      else if (ok) notify(`Syncing to ${folderSync.getState().folderName}`);
    },
    onLink: async () => {
      try {
        if (await folderSync.link()) notify(`Linked “${folderSync.getState().folderName}” · scripts sync there as .draftline files`);
      } catch (e) {
        notify(e.message || 'Couldn’t link that folder');
      }
    },
    onDisconnect: async () => {
      const name = folderSync.getState().folderName;
      await folderSync.disconnect();
      notify(`Disconnected “${name}” · its files stay where they are`);
    },
    onAllow: async () => {
      if (await folderSync.requestPermission()) notify(`Syncing to ${folderSync.getState().folderName}`);
    },
  };

  // ---- Script mutations (shared by the Editor and the Dialogue panel) ----
  const commitBlocks = useCallback((next) => {
    lastEdit.current = { ...lastEdit.current, at: Date.now() };
    set(next.length ? next : [makeBlock('action')]);
  }, [set]);

  const updateBlockText = useCallback((id, text) => {
    const before = latest.current?.blocks.find((b) => b.id === id)?.text ?? '';
    lastEdit.current = { at: Date.now(), sentence: lastEdit.current.sentence || finishedSentence(before, text) };
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
  // Ignore (Format stepper): hidden for this session, per element and kind of finding.
  const [ignoredIssues, setIgnoredIssues] = useState(() => new Set());
  const issueKey = (it) => `${it.id}|${it.kind}`;
  const issues = useMemo(() => auditScript(blocks, { skipId: activeId, ignore: ignoredIssues }), [blocks, activeId, ignoredIssues]);
  // Action density (skim risk): long action paragraphs, from the measured lines when known.
  const density = useMemo(() => actionDensity(blocks, lineMap), [blocks, lineMap]);
  const [densityMode, setDensityMode] = useState(false);
  const [densityIndex, setDensityIndex] = useState(-1); // which skim risk the stepper is on (-1: none yet)
  const noteCount = useMemo(() => blocks.filter((b) => hasNote(b) && b.note.trim()).length, [blocks]);
  const fixIssues = useCallback((all, { bulk = false } = {}) => {
    const list = all.filter((it) => canFix(it.kind)); // e.g. a heading missing its time of day: yours to write
    if (!list.length) return;
    if (bulk) autoSnapshotRef.current('Fix All', { force: true }); // Fix All: the script as it was, first
    set(applyFixes(blocks, list));
    notify(list.length === 1 ? 'Fixed · Ctrl+Z to undo' : `Fixed ${list.length} elements · Ctrl+Z to undo`);
  }, [blocks, set, notify]);
  const ignoreIssue = useCallback((it) => {
    setIgnoredIssues((prev) => new Set(prev).add(`${it.id}|${it.kind}`));
    notify('Ignored for this session');
  }, [notify]);

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
    if (kind === 'csv') {
      const name = csvOutlineFileName(meta.title);
      download(name, outlineCsv(beats, { scenes: boardScenes, mode: actMode }), 'text/csv;charset=utf-8');
      notify(`Exported ${name}`);
    } else if (kind === 'md') {
      download(`${base}-outline.md`, beatsToMarkdown(beats, meta.title, actMode), 'text/markdown;charset=utf-8');
      notify('Exported outline .md');
    } else if (kind === 'fountain') {
      download(`${base}-outline.fountain`, beatsToFountain(beats, meta.title, actMode), 'text/plain;charset=utf-8');
      notify('Exported outline .fountain');
    }
  }, [base, beats, meta.title, actMode, boardScenes, notify]);

  // ---- Projects ----
  /** Show a stored project: script, title page, beats, Bible; fresh undo history; nothing unsaved. */
  const applyProject = useCallback((rec) => {
    const doc = toDoc(rec);
    const m = { ...EMPTY_META, ...doc.meta };
    const bl = doc.blocks.length ? doc.blocks : [makeBlock('scene')];
    setMeta(m);
    reset(bl);
    setBeats(relinkSceneCards(doc.beats, bl)); // scene cards a replaced script left unlinked find their scenes again
    setCharacters(doc.characters);
    setStoryNotes(doc.storyNotes);
    setStoryDna(doc.storyDna);
    setProduction(doc.production);
    setRevisions(doc.revisions);
    setProjectLocked(doc.isLocked === true);
    noteSession.current = null;
    setNoteId(null);
    setRestoreId(null);
    setCompareId(null);
    setLineMap({});
    setSelectedChar(null);
    setActiveId(null);
    setProjectId(rec.id);
    setSaved({
      meta: m, blocks: bl, beats: doc.beats, characters: doc.characters, storyNotes: doc.storyNotes, storyDna: doc.storyDna,
      production: doc.production, revisions: doc.revisions, at: rec.updatedAt, ok: true,
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
    let rec = await projects.getProject(id);
    // Synced folder: a copy there that's newer (or the only copy) is the one to open.
    const there = await folderSync.readProject(id).catch(() => null);
    const fromFolder = !!there && (!rec || (there.updatedAt || 0) > (rec.updatedAt || 0));
    if (fromFolder) rec = await projects.importRecord(there);
    if (!rec) {
      notify('That script no longer exists');
      return;
    }
    applyProject(rec);
    setDrawerOpen(false);
    const title = rec.title?.trim() || 'Untitled';
    notify(fromFolder ? `Opened “${title}” from ${folderSync.getState().folderName}` : `Switched to “${title}”`);
  }, [applyProject, flushSave, notify]);

  // A newer copy of the open script turned up in the folder at start-up (see the folder-sync effect).
  useLayoutEffect(() => {
    pullNewer.current = async (there) => {
      const rec = await projects.importRecord(there);
      applyProject(rec);
      notify(`Loaded the newer copy of “${rec.title?.trim() || 'Untitled'}” from ${folderSync.getState().folderName}`);
    };
  });

  /** Save what's open, store `doc` as a new project and open it. */
  const openAsNewProject = useCallback(async (doc, message) => {
    await flushSave();
    const rec = await projects.saveActiveProject(doc);
    applyProject(rec);
    folderSync.writeProject(rec, latest.current.fileOptions);
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
    const r = moveCardStep(s.beats, s.blocks, id, act, index);
    if (!r.scriptMoved) {
      setBeats(r.beats); // your own cards, or a move that keeps the scene order: board only
      return;
    }
    // Script and board change together, at once, with no confirm step; Ctrl+Z / Ctrl+Shift+Z
    // take both back and forth.
    set(r.blocks, null, {
      undo: () => setBeats(r.undoBeats(latest.current.beats)),
      redo: () => setBeats(r.redoBeats(latest.current.beats)),
    });
    setBeats(r.beats);
    notify(`Moved ${r.heading} in the script · Ctrl+Z to undo`);
  };

  // ---- Rename a character everywhere (one undo step) ----
  const [renameFrom, setRenameFrom] = useState(null); // the name being renamed, while the review is open
  const [revealBio, setRevealBio] = useState(null); // { id } — a bio the Characters drawer should open to
  const [glossaryTerm, setGlossaryTerm] = useState(null); // { id } — a term Story Bible → Glossary should open
  /** A role's (i) in Characters → Bios: Story Bible → DNA → Glossary, at that term. */
  const openGlossary = useCallback((id) => {
    setBibleTab('dna');
    setDock('bible');
    setGlossaryTerm({ id });
  }, []);
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
      storyNotes: s.storyNotes, storyDna: s.storyDna, production: s.production, revisions: s.revisions, pages: s.pages, scenes: s.scenes,
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
    // Synced folder: also <folder>/Snapshots/<slug>_<YYYY-MM-DD_HHmm>.draftline
    folderSync.writeSnapshot(rev, { id: s.projectId, title: s.meta.title, createdAt: s.createdAt }, s.fileOptions)
      .then((path) => path && notify(`Snapshot saved · “${rev.label}” · ${folderSync.getState().folderName}/${path}`));
    return rev;
  }, [notify]);

  // ---- Automatic snapshots (folderSync.js AUTO_SNAPSHOT_*): with a folder linked, every 15 minutes
  // if the script changed since the last one, and always just before something that replaces a lot
  // at once — an import, Format Doctor Fix All, deleting a script. Files in <folder>/Snapshots,
  // marked automatic; each script keeps its newest 15 of them (yours are never trimmed). ----
  const autoBaseline = useRef(null); // { projectId, parts } as of the last automatic snapshot (or opening)
  /**
   * Write one automatic snapshot of the open script now. `reason` labels it; `force` writes it even
   * if nothing changed (the pre-destructive ones). The project's state is copied before this
   * returns, so whatever runs next can't reach into it. Resolves the file's path, or null.
   */
  const autoSnapshot = useCallback(async (reason, { force = false } = {}) => {
    const s = latest.current;
    if (!sync.active) return null;
    if (!force && !changedSince(autoBaseline.current, s)) return null;
    const label = reason ? `Auto · before ${reason}` : 'Auto-snapshot';
    const rev = createRevision(s, { label, pages: s.pages });
    autoBaseline.current = { projectId: s.projectId, parts: partsOf(s) };
    const { path } = await folderSync.writeAutoSnapshot(rev, { id: s.projectId, title: s.meta.title, createdAt: s.createdAt }, s.fileOptions)
      .catch(() => ({ path: null }));
    if (path) setAutoSnapCount((n) => n + 1);
    return path;
  }, [sync.active]);
  // Opening a script is the baseline: the first automatic snapshot comes after you change something.
  useEffect(() => {
    autoBaseline.current = { projectId, parts: partsOf(latest.current) };
  }, [projectId]);
  const autoSnapshotRef = useRef(autoSnapshot);
  useEffect(() => {
    autoSnapshotRef.current = autoSnapshot;
  });
  useEffect(() => {
    if (!sync.active) return undefined;
    const t = setInterval(() => autoSnapshotRef.current(null), AUTO_SNAPSHOT_INTERVAL_MS);
    return () => clearInterval(t);
  }, [sync.active]);

  const deleteSnapshot = useCallback((id) => {
    const s = latest.current;
    const rev = getRevision(s.revisions, id) || getRevision(s.folderSnaps, id);
    setRevisions((list) => removeRevision(list, id));
    // Its file in <folder>/Snapshots goes too — otherwise it would come back as a folder snapshot.
    folderSync.removeSnapshot(id, s.projectId).then(() => {
      setFolderSnaps((f) => ({ ...f, list: f.list.filter((x) => x.rev.id !== id) }));
    });
    if (rev) notify(`Deleted snapshot “${rev.label}”`);
  }, [notify]);

  /** Put snapshot `id` back (one undo step), first snapshotting what's on screen if `keepCurrent`. */
  const restoreSnapshot = useCallback((id, keepCurrent) => {
    const s = latest.current;
    const rev = getRevision(s.revisions, id) || getRevision(s.folderSnaps, id); // or a file in <folder>/Snapshots
    setRestoreId(null);
    if (!rev) return;
    if (s.projectLocked) {
      notify('This script is locked — unlock it (the padlock in Projects) to restore a snapshot over it');
      return;
    }
    endNoteEditing();
    let list = s.revisions;
    if (keepCurrent) {
      const before = createRevision(s, { label: `Before restoring “${rev.label}”`, pages: s.pages });
      list = addRevision(list, before);
      folderSync.writeSnapshot(before, { id: s.projectId, title: s.meta.title, createdAt: s.createdAt }, s.fileOptions);
    }
    const doc = revisionToDoc(rev);
    const before = { meta: s.meta, beats: s.beats, characters: s.characters, storyNotes: s.storyNotes, storyDna: s.storyDna, production: s.production };
    const after = {
      meta: { ...EMPTY_META, ...doc.meta }, beats: doc.beats, characters: doc.characters, storyNotes: doc.storyNotes, storyDna: doc.storyDna,
      // A snapshot from before planning existed leaves today's breakdowns alone.
      production: rev.production ? doc.production : s.production,
    };
    const applyParts = (x) => {
      setMeta(x.meta);
      setBeats(x.beats);
      setCharacters(x.characters);
      setStoryNotes(x.storyNotes);
      setStoryDna(x.storyDna);
      setProduction(x.production);
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
    folderSync.writeProject(record, latest.current.fileOptions);
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

  /** Projects → padlock: lock or unlock script `id` (stored, and written to the synced folder). */
  const toggleProjectLock = async (id) => {
    try {
      const cur = await projects.getProject(id);
      if (!cur) throw new Error('That script no longer exists');
      if (id === projectId) await flushSave();
      const rec = await projects.setProjectLock(id, cur.isLocked !== true);
      folderSync.writeProject(rec, latest.current.fileOptions);
      if (id === latest.current.projectId) setProjectLocked(rec.isLocked);
      const title = rec.title?.trim() || 'Untitled';
      notify(rec.isLocked ? `Locked “${title}” · it can’t be deleted or overwritten` : `Unlocked “${title}”`);
    } catch (e) {
      notify(e.message || 'Couldn’t change the lock');
    }
  };

  const renameProject = async (id, title) => {
    if (id === projectId) setMeta((m) => ({ ...m, title }));
    else folderSync.writeProject(await projects.renameProject(id, title), latest.current.fileOptions);
  };

  const duplicateProject = async (id) => {
    if (id === projectId) await flushSave();
    const copy = await projects.duplicateProject(id);
    folderSync.writeProject(copy, latest.current.fileOptions);
    notify(`Duplicated as “${copy.title}”`);
  };

  // Deleting a script: nothing happens until the "Delete Screenplay?" dialog is confirmed by typing
  // DELETE. The folder copy goes into the folder's Trash/; if that move fails, the dialog asks
  // before erasing anything (DeleteProjectModal's 'hard' stage).
  const [pendingDelete, setPendingDelete] = useState(null); // { id, title, stage, failed, busy }
  const [bibleExportOpen, setBibleExportOpen] = useState(false);
  const [libraryRev, setLibraryRev] = useState(0); // bumped when a deletion finishes: Projects re-reads its list
  const deleteProject = async (id, title) => {
    if ((await projects.getProject(id))?.isLocked) {
      notify(`“${title}” is locked — unlock it (the padlock in Projects) to delete it`);
      return;
    }
    const others = (await projects.getAllProjects()).filter((p) => p.id !== id);
    if (!others.length) {
      notify('This is your only script — create another before deleting it.');
      return;
    }
    setPendingDelete({ id, title, stage: 'confirm', failed: [], busy: false });
  };
  const confirmDelete = async () => {
    const d = pendingDelete;
    if (!d || d.busy) return;
    setPendingDelete({ ...d, busy: true });
    try {
      // The script as it was, into <folder>/Snapshots first (the delete leaves that folder alone).
      if (sync.active) {
        if (d.id === projectId) await autoSnapshotRef.current('deleting', { force: true });
        else {
          const rec = await projects.getProject(d.id).catch(() => null);
          if (rec) {
            const doc = toDoc(rec);
            const rev = createRevision(doc, { label: 'Auto · before deleting', pages: rec.pages });
            await folderSync.writeAutoSnapshot(rev, { id: rec.id, title: rec.title, createdAt: rec.createdAt }, latest.current.fileOptions)
              .catch(() => null);
          }
        }
      }
      if (d.id === projectId) {
        // Move to the most recently edited other script first, then delete.
        const next = (await projects.getAllProjects()).find((p) => p.id !== d.id);
        if (!next) throw new Error('This is your only script — create another before deleting it.');
        await flushSave();
        applyProject(next);
      }
      await projects.deleteProject(d.id);
      setLibraryRev((n) => n + 1);
      const folder = await folderSync.removeProject(d.id); // otherwise the folder copy would bring it back
      if (folder.failed.length) {
        setPendingDelete({ ...d, stage: 'hard', failed: folder.failed, busy: false });
        return;
      }
      setPendingDelete(null);
      notify(folder.trashed.length
        ? `Deleted “${d.title}” — its file is in ${TRASH_DIR} in “${sync.folderName}”`
        : `Deleted “${d.title}”`);
    } catch (e) {
      setPendingDelete(null);
      notify(e.message);
    }
  };
  const hardDelete = async () => {
    const d = pendingDelete;
    if (!d || d.busy) return;
    setPendingDelete({ ...d, busy: true });
    const folder = await folderSync.removeProject(d.id, { hard: true }).catch(() => ({ failed: d.failed, removed: 0 }));
    setPendingDelete(null);
    setLibraryRev((n) => n + 1);
    notify(folder.failed.length ? `Couldn’t delete ${folder.failed.join(', ')} — it’s still in “${sync.folderName}”` : `Deleted “${d.title}” and its file`);
  };
  const cancelDelete = () => {
    const d = pendingDelete;
    setPendingDelete(null);
    if (d?.stage === 'hard') notify(`Kept ${d.failed.join(', ')} in “${sync.folderName}” — “${d.title}” will come back from it`);
  };

  const openFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      // Word: its text goes through the importer, previewed element by element (lib/docxImport.js).
      if (/\.docx$/i.test(file.name)) {
        const { docxToScriptText, readAsArrayBuffer } = await import('./lib/docxImport.js');
        const { text: extracted } = await docxToScriptText(await readAsArrayBuffer(file));
        if (!extracted.trim()) throw new Error('That Word file has no text in it.');
        setImportSeed({ text: extracted, name: file.name });
        return;
      }
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
    // The editor's own element shape — { id, type, text, …extras } — with any type the editor doesn't
    // know (an odd file, a future parser) read as Action rather than left unrenderable.
    const incoming = parsed
      .filter((b) => b && typeof b.text === 'string')
      .map((b) => makeBlock(ELEMENT_META[b.type] ? b.type : 'action', b.text, blockExtras(b)));
    if (!incoming.length) {
      notify('Nothing to import — the preview is empty');
      return;
    }
    // A locked script is never overwritten or added to: the import becomes a new script of its own.
    if (projectLocked) {
      const lockedTitle = meta.title.trim() || 'Untitled';
      const title = detected?.title?.trim() || `${lockedTitle} (Imported)`;
      const titlePage = {};
      if (detected) for (const k of ['credit', 'author', 'basedOn', 'draftVersion', 'draftDate', 'contact']) if (detected[k]) titlePage[k] = detected[k];
      setImportSeed(null);
      setSelectedChar(null);
      openAsNewProject(
        { meta: { ...EMPTY_META, ...newProjectMeta({ title }), ...titlePage, title }, blocks: incoming, beats: [] },
        `“${lockedTitle}” is locked — imported as a new script, “${title}”`,
      ).then(() => {
        setWorkspace('write');
        if (view === 'board') setView('page');
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (scrollerEl.current) scrollerEl.current.scrollTop = 0;
          editorRef.current?.focusBlock(incoming[0].id, { scroll: false, at: 'start' });
        }));
      });
      return;
    }
    autoSnapshotRef.current(mode === 'append' ? 'append' : 'import', { force: true }); // the script as it was, first
    if (mode === 'append') set((prev) => [...prev, ...incoming]);
    else {
      // The new elements have new ids: scene cards follow their headings into the imported script,
      // so the board keeps driving it. Ctrl+Z takes the script and the links back together.
      const beforeBeats = latest.current.beats;
      const afterBeats = relinkSceneCards(beforeBeats, incoming);
      set(incoming, null, afterBeats === beforeBeats ? null : {
        undo: () => setBeats(beforeBeats),
        redo: () => setBeats(afterBeats),
      });
      setBeats(afterBeats);
    }
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
    // Show what was loaded, wherever you were: Write, on the page (not the Board or Plan), and —
    // replacing — page 1 with the cursor in its first element; appending, the first appended one.
    const first = incoming[0];
    writeScroll.current = 0;
    setWorkspace('write');
    if (view === 'board') setView('page');
    setActiveId(first.id);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (mode === 'append') {
        editorRef.current?.focusBlock(first.id, { at: 'start' });
        return;
      }
      if (scrollerEl.current) scrollerEl.current.scrollTop = 0;
      editorRef.current?.focusBlock(first.id, { scroll: false, at: 'start' });
    }));
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

  // Print view is only mounted while printing (File → Script (PDF), or Ctrl+P).
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

  // Milestones, checked after each edit (layout and word count are up to date here).
  useEffect(() => {
    const now = { projectId, words: analysis.words, pages: layout.pageCount, blocks };
    const s = writingSession.current;
    if (!s || s.projectId !== projectId) {
      writingSession.current = { ...now, startWords: analysis.words };
      return;
    }
    if (Date.now() - lastEdit.current.at < 1500) {
      const ids = milestonesReached({
        prev: { sessionWords: s.words - s.startWords, pages: s.pages },
        next: { sessionWords: now.words - s.startWords, pages: now.pages },
        sentence: lastEdit.current.sentence,
        now: new Date(),
        fired: milestonesFired.current,
      });
      lastEdit.current.sentence = false;
      if (ids.length) {
        ids.forEach((id) => milestonesFired.current.add(id));
        const idle = milestoneQueue.current.length === 0 && !milestoneShowing.current;
        milestoneQueue.current.push(...ids.map((id) => MILESTONES[id]));
        if (idle) setTimeout(showNextMilestone, 0);
      }
    }
    writingSession.current = { ...s, words: now.words, pages: now.pages, blocks };
  }, [projectId, analysis.words, layout.pageCount, blocks, showNextMilestone]);

  // ---- Film Noir mode (lib/noir.js): Ctrl+Shift+Alt+N, or picking the Noir genre in Story DNA ----
  // Noir is a view: turning it on or off touches only this state, the sound and the root class —
  // never storyDna (a Noir genre stays picked after you leave).
  const [noir, setNoir] = useState(false);
  const noirRef = useRef(false); // read by the listeners below
  const noirAudio = useRef(null); // rain + vinyl (lib/noirAudio.js), made on first use
  const setNoirMode = useCallback((on) => {
    // Started from the key press / typing that asked for it; stopping fades out and suspends.
    if (on) (noirAudio.current ??= createNoirAudio()).start();
    else noirAudio.current?.stop();
    noirRef.current = on;
    setNoir(on);
  }, []);
  useEffect(() => {
    // Capture phase, so Esc leaves Noir before anything else hears it (one Esc, one thing).
    const onKey = (e) => {
      const act = noirKeyAction(e, noirRef.current);
      if (!act) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setNoirMode(act === 'on');
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      noirAudio.current?.dispose();
      noirAudio.current = null;
    };
  }, [setNoirMode]);
  // Story DNA edits: picking the Noir genre (a click, so sound is allowed) also turns Noir on.
  const changeStoryDna = useCallback((next) => {
    if (noirGenrePicked(storyDna, next) && !noirRef.current) setNoirMode(true);
    setStoryDna(next);
  }, [storyDna, setNoirMode]);

  // ---- Global shortcuts ----
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const t = e.target;
      const typing = t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
      if (isLockShortcut(e)) {
        e.preventDefault();
        toggleLock();
      } else if (e.key === 'F1' || (e.key === '?' && e.shiftKey && !mod && !e.altKey && !typing)) {
        // F1 anywhere (the browser's own help is kept out of the way); Shift+? when not typing.
        e.preventDefault();
        setHelpKind(null);
        setGuideOpen(true);
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveNow().then((rec) => notify(rec ? 'Saved to Projects · use Export for files' : 'Could not save — browser storage is full or blocked'));
      } else if (mod && !e.altKey && !e.shiftKey && e.code === 'KeyO') {
        e.preventDefault(); // the browser's own Open File
        fileShortcuts.current.open?.();
      } else if (mod && e.altKey && !e.shiftKey && e.code === 'KeyN') {
        // Ctrl+N belongs to the browser (new window); Ctrl+Shift+Alt+N is Film Noir.
        e.preventDefault();
        fileShortcuts.current.new?.();
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
        if (isLocked) notifyLocked();
        else if (e.key.toLowerCase() === 'y' || e.shiftKey) redo(); else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode, titleOpen, importSeed, doctorOpen, renameFrom, notify, undo, redo, cycleView, saveNow, toggleDialogueTab, filter,
    isLocked, toggleLock, notifyLocked]);

  const hints = activeBlock ? flowHints(activeBlock.type) : null;
  const currentSceneId = activeId ? analysis.sceneOfBlock[activeId] : null;
  const currentPage = activeId ? layout.pageOfBlock[activeId] : null;
  const navVisible = navOpen && !focusMode && showEditor;
  const elementControlsEnabled = !!activeBlock && showEditor;
  const editControlsEnabled = elementControlsEnabled && !isLocked; // View Only dims Element and B I U S

  // Density: jump to skim risk `i` — scroll it to the middle and pulse it (Editor.pulseBlock).
  const densityLocations = useMemo(
    () => riskLocations(density, { sceneOf: analysis.sceneOfBlock, scenes, pageOf: layout.pageOfBlock }),
    [density, analysis, scenes, layout],
  );
  // Dialogue stepper (status bar, while the Characters → Dialogue filter is on): the filtered
  // character's speeches in order; stepping scrolls one to the middle and pulses it.
  const dialogueStopList = useMemo(
    () => (filter ? dialogueStops(analysis, filter.name, { sceneOf: analysis.sceneOfBlock, scenes, pageOf: layout.pageOfBlock }) : []),
    [filter, analysis, scenes, layout],
  );
  const [dialoguePos, setDialoguePos] = useState({ name: null, index: -1 });
  const dialogueIndex = filter && dialoguePos.name === filter.name ? Math.min(dialoguePos.index, dialogueStopList.length - 1) : -1;
  const jumpToSpeech = (i) => {
    const target = dialogueStopList[i];
    if (!target || !filter) return;
    setDialoguePos({ name: filter.name, index: i });
    if (view === 'board' && !focusMode) setView('page');
    requestAnimationFrame(() => requestAnimationFrame(() => editorRef.current?.pulseBlock(target.id)));
  };
  const stepSpeech = (dir) => jumpToSpeech(stepRisk(dialogueIndex, dialogueStopList.length, dir));
  // Characters → Dialogue: picking a character turns the filter on, puts the stepper at "1 of N"
  // and scrolls to their first line; picking it again (or nothing) clears the filter.
  const selectCharacter = (name) => {
    setSelectedChar(name);
    if (!name) return;
    const first = dialogueStops(analysis, name, { sceneOf: analysis.sceneOfBlock, scenes, pageOf: layout.pageOfBlock })[0];
    if (!first) return;
    setDialoguePos({ name: analysis.characters.get(name)?.name ?? name, index: 0 });
    if (view === 'board' && !focusMode) setView('page');
    requestAnimationFrame(() => requestAnimationFrame(() => editorRef.current?.pulseBlock(first.id)));
  };
  const stepSpeechRef = useRef(stepSpeech);
  useLayoutEffect(() => {
    stepSpeechRef.current = stepSpeech;
  });
  const dialogueFilterOn = !!filter;
  useEffect(() => {
    if (!dialogueFilterOn) return undefined;
    const onKey = (e) => {
      const act = dialogueKeyAction(e);
      if (!act) return;
      e.preventDefault();
      stepSpeechRef.current(act);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialogueFilterOn]);

  // ---- [ Write | Plan ] ----
  // Leaving Write keeps the script and the Scene Board exactly where they were scrolled (both stay
  // mounted, just hidden — and hiding drops scroll offsets); coming back puts them there again.
  const writeScroll = useRef(0);
  const boardScroll = useRef([]);
  const switchWorkspace = (next) => {
    if (next === workspace) return;
    if (next === 'plan') {
      writeScroll.current = scrollerEl.current?.scrollTop ?? 0;
      const board = document.querySelector('.board');
      boardScroll.current = board
        ? [board, ...board.querySelectorAll('*')]
          .filter((el) => el.scrollTop || el.scrollLeft)
          .map((el) => [el, el.scrollTop, el.scrollLeft])
        : [];
    }
    setWorkspace(next);
  };
  useLayoutEffect(() => {
    if (workspace !== 'write') return;
    if (scrollerEl.current && writeScroll.current) scrollerEl.current.scrollTop = writeScroll.current;
    const saved = boardScroll.current.filter(([el]) => el.isConnected);
    boardScroll.current = [];
    if (!saved.length) return;
    // A side panel coming back slides in over ~0.2s and narrows the board as it goes, so until then
    // the board may not be scrollable that far: keep putting it back for a moment, unless the
    // writer scrolls it themselves first.
    const put = () => {
      for (const [el, top, left] of saved) {
        el.scrollTop = top;
        el.scrollLeft = left;
      }
    };
    put();
    let frame = 0;
    const until = performance.now() + 450;
    const tick = () => {
      put();
      if (performance.now() < until) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const stop = () => cancelAnimationFrame(frame);
    const opts = { capture: true, once: true, passive: true };
    for (const type of ['wheel', 'pointerdown', 'keydown', 'touchstart']) window.addEventListener(type, stop, opts);
    return () => {
      stop();
      for (const type of ['wheel', 'pointerdown', 'keydown', 'touchstart']) window.removeEventListener(type, stop, opts);
    };
  }, [workspace]);
  const openSceneInWrite = (id) => {
    writeScroll.current = 0; // going somewhere specific: don't restore the old position over it
    boardScroll.current = [];
    setWorkspace('write');
    if (view === 'board') setView('page');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      editorRef.current?.pulseBlock(id);
    }));
  };
  const exportBreakdown = async () => {
    // The breakdown arithmetic loads with the Plan workspace (lib/productionEngine.js).
    const { breakdownCsv, buildBreakdown } = await import('./lib/productionEngine.js');
    const rows = buildBreakdown({ blocks, analysis, scenes, production });
    const name = `${(meta.title.trim() || 'Untitled').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, '_')}_Breakdown.csv`;
    download(name, breakdownCsv(rows), 'text/csv;charset=utf-8');
    notify(`Exported ${name}`);
  };

  // Format stepper (status bar, while the Format Doctor has findings): where you are in the list
  // follows the finding (by element), so fixing one keeps you near it; ✕ hides it until a new
  // finding turns up.
  const [formatAt, setFormatAt] = useState(null); // `${id}|${kind}` of the current finding
  const [formatHidden, setFormatHidden] = useState(() => new Set());
  const formatIndex = formatAt ? issues.findIndex((it) => issueKey(it) === formatAt) : -1;
  const showFormatStepper = issues.some((it) => !formatHidden.has(issueKey(it)));
  const jumpToIssue = (i) => {
    const it = issues[i];
    if (!it) return;
    setFormatAt(issueKey(it));
    if (view === 'board' && !focusMode) setView('page');
    requestAnimationFrame(() => requestAnimationFrame(() => editorRef.current?.pulseBlock(it.id)));
  };

  const jumpToRisk = (i) => {
    const target = density.list[i];
    if (!target) return;
    setDensityIndex(i);
    if (view === 'board' && !focusMode) setView('page');
    // After this render (highlights on, editor shown), so the element exists and is marked.
    requestAnimationFrame(() => requestAnimationFrame(() => editorRef.current?.pulseBlock(target.id)));
  };

  // The header's File ▾ menu (lib/toolbar.js fileMenuItems): Script · Export · Backup.
  const fileItems = () => fileMenuItems({
    onNew: () => newScript(),
    onOpen: () => fileInputRef.current?.click(),
    onImport: () => setImportSeed({ text: '', name: '' }),
    onSample: loadSample,
    onTitlePage: () => setTitleOpen(true),
    onPrint: printScript,
    onBible: () => setBibleExportOpen(true),
    onFountain: exportFountain,
    onFdx: exportFDX,
    onOutlineCsv: () => exportOutline('csv'),
    onOutlineMd: () => exportOutline('md'),
    onOutlineFountain: () => exportOutline('fountain'),
    onBackup: backupProject,
    onSnapshots: () => setDock((d) => openDock(d, 'snapshots')),
    snapshotCount: revisions.length,
  });
  // Ctrl+O and Ctrl+Alt+N (the global shortcuts below) run the same New / Open as the menu.
  const fileShortcuts = useRef({});
  useEffect(() => {
    fileShortcuts.current = { open: () => fileInputRef.current?.click(), new: () => newScript() };
  });

  return (
    <>
      <div
        className={[
          'app',
          `view-${focusMode ? 'page' : view}`,
          dock && !focusMode && (!inPlan || dock === 'snapshots') ? 'dock-open' : '',
          navVisible ? 'nav-open' : '',
          focusMode ? 'focus-mode' : '',
          noir ? NOIR_CLASS : '',
        ].filter(Boolean).join(' ')}
        data-canvas={canvasTheme}
      >
        <header className="bar" ref={barRef}>
          {/* Three zones: left (scenes · D · title ▾) never shrinks; the middle (file actions, element &
              formatting) gives way and clips, never overlaps; right (views, export, panels) never shrinks. */}
          {/* 1 · Left zone: identity */}
          <div className="bar-zone zone-left g-identity">
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
              className={`brand${helpKind === 'about' ? ' is-open' : ''}`}
              onClick={() => setHelpKind('about')}
              title="About DraftLine"
              aria-label="About DraftLine"
              aria-haspopup="dialog"
            >
              <BrandMark />
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
            {/* [ Write | Plan ]: the two workspaces. Everything left of here is shared by both. */}
            <div className="seg ws-switch" role="radiogroup" aria-label="Workspace">
              {WORKSPACES.map(({ id, label, title, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={workspace === id}
                  className={`seg-btn ws-btn${workspace === id ? ' is-on' : ''}`}
                  onClick={() => switchWorkspace(id)}
                  title={title}
                  aria-label={label}
                >
                  <Icon size={14} strokeWidth={1.75} aria-hidden />
                  <span className="ws-label">{label}</span>
                </button>
              ))}
            </div>
            {/* File ▾ (New · Open · Import · Title Page · exports · backup): with the identity, so it never
                shrinks away; outside any clipping box, so its list can drop down. */}
            <span className="file-menu">
              <Menu label="File" items={fileItems} title="New, Open, Import, Title Page · Export · Backup" />
            </span>
            <input ref={fileInputRef} type="file" accept=".fountain,.spmd,.txt,.fdx,.docx,.draftline" hidden onChange={openFile} />
          </div>

          {/* 2 · Middle zone: File ▾, then the element & formatting tools */}
          <div className="bar-zone zone-middle">
          <span className="bar-sep" aria-hidden="true" />
          {/* Shrinks and clips if it ever runs out of room — it can never paint over a neighbour. */}
          <div className="zone-middle-tools">
          {/* Active element & formatting: only on a writing canvas (Page, Split, Focus) — not on the
              Scene Board or in Plan, where there's nothing to format and the room is better spent. */}
          <div className="bar-group g-format" hidden={!formatBarShown}>
            <select
              className="type-select"
              value={elementControlsEnabled ? activeBlock.type : ''}
              disabled={!editControlsEnabled}
              onChange={(e) => {
                // "Dual Dialogue" is an action on the speech, not a type: the select keeps showing the type.
                if (e.target.value === DUAL_SHORTCUT.action) editorRef.current?.toggleDual(activeId);
                else editorRef.current?.setType(activeId, e.target.value);
              }}
              aria-label="Element type"
              title={isLocked ? `View Only — ${LOCK_COMBO} to edit` : 'Element type (Alt+1…8) · Dual Dialogue (Alt+D)'}
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
            <div className={`fmt-seg${isLocked ? ' is-locked' : ''}${editControlsEnabled ? '' : ' is-disabled'}`} role="group" aria-label="Text formatting">
              {STYLES.map((k) => {
                const on = fmtState[k] && elementControlsEnabled;
                return (
                  <button
                    key={k}
                    type="button"
                    className={`fmt-btn fmt-${k}${on ? ' is-on' : ''}`}
                    disabled={!editControlsEnabled}
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

          </div>
          </div>

          {/* 3 · Right zone, the same slots in both workspaces:
                 Write: [ Page | Split | Board ]  Focus · Story Bible · Characters   · Snapshot · ⋮
                 Plan:  [ Breakdowns | Stripboard ]  Collapse All · Export Breakdown · Snapshot · ⋮ */}
          <div className="bar-zone zone-right">
          <span className="bar-sep" aria-hidden="true" />
          {inPlan ? (
            <div className="seg plan-seg" role="radiogroup" aria-label="Plan view" ref={planSegRef}>
              {PLAN_VIEWS.map(({ id, label, title, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={planView === id}
                  aria-label={label}
                  className={`seg-btn${planView === id ? ' is-on' : ''}`}
                  onClick={() => setPlanView(id)}
                  title={`${label}: ${title}`}
                >
                  <Icon size={14} strokeWidth={1.75} aria-hidden />
                  <span className="seg-label">{label}</span>
                </button>
              ))}
            </div>
          ) : (
          <div className="seg view-seg" role="radiogroup" aria-label="Workspace view (Alt+B cycles)">
            {VIEWS.map(({ id, label, title, Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={view === id}
                aria-label={label}
                className={`seg-btn${view === id ? ' is-on' : ''}`}
                onClick={() => setView(id)}
                title={`${label}: ${title} · Alt+B cycles`}
              >
                <Icon size={14} strokeWidth={1.75} aria-hidden />
                <span className="seg-label">{label}</span>
              </button>
            ))}
          </div>
          )}

          {/* Workspace tools, then the utilities both share (Snapshot, ⋮) */}
          <div className="bar-group bar-right">
            {inPlan && planView === 'breakdowns' && (
              <button
                ref={planFoldBtnRef}
                type="button"
                className="btn btn-plan-fold"
                onClick={foldAllPlan}
                disabled={!scenes.length}
                title="Open or fold every scene’s breakdown"
              >
                {planAllFolded ? 'Expand All' : 'Collapse All'}
              </button>
            )}
            {inPlan && (
              <button
                ref={planExportBtnRef}
                type="button"
                className="btn btn-plan-export"
                onClick={exportBreakdown}
                disabled={!scenes.length}
                title="Every scene’s breakdown as a spreadsheet (.csv)"
              >
                <span className="plan-lbl-long">Export Breakdown (.csv)</span>
                <span className="plan-lbl-short">Export (.csv)</span>
              </button>
            )}
            <button ref={focusBtnRef} className="btn btn-focus" hidden={inPlan} onClick={() => setFocusMode(true)} title="Hide everything but the page (Esc to exit)">Focus</button>
            <button
              ref={bibleBtnRef}
              hidden={inPlan}
              className={`btn btn-bible${bibleOpen ? ' is-on-subtle' : ''}`}
              onClick={() => setDock((d) => toggleDock(d, 'bible'))}
              title="Story Bible: DNA (Blueprint & Glossary) · Notes (Alt+I)"
              aria-pressed={bibleOpen}
            >
              Story Bible
            </button>
            <button
              ref={charactersBtnRef}
              hidden={inPlan}
              className={`btn btn-accent${charactersOpen ? ' is-on' : ''}`}
              onClick={() => setDock((d) => toggleDock(d, 'characters'))}
              title="Characters: Bios · Dialogue (Alt+C · Alt+T opens Dialogue)"
              aria-pressed={charactersOpen}
            >
              Characters
            </button>
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
            <Menu
              label={<span className="kebab" aria-hidden="true">⋮</span>}
              caret={false}
              className="btn btn-kebab"
              align="right"
              title="More: snapshots, margin notes, Format Doctor, keyboard shortcuts, User Guide, about"
              ariaLabel="More"
              items={() => moreMenuItems({
                // Checked as the menu opens: what the toolbar is showing isn't repeated here. In Plan
                // the Write panels don't apply, so they never show; Plan's own tools do when tucked away.
                bibleOnBar: inPlan || isOnBar(bibleBtnRef.current, barRef.current),
                charactersOnBar: inPlan || isOnBar(charactersBtnRef.current, barRef.current),
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
                onFormatDoctor: () => setDoctorOpen(true),
                issueCount: issues.length,
                onAbout: () => setHelpKind('about'),
                onGuide: () => setGuideOpen(true),
                focusOnBar: inPlan || isOnBar(focusBtnRef.current, barRef.current),
                onFocus: () => setFocusMode(true),
                planTools: inPlan ? {
                  viewsOnBar: isOnBar(planSegRef.current, barRef.current),
                  views: PLAN_VIEWS.map((v) => ({ label: v.label, on: planView === v.id, onSelect: () => setPlanView(v.id) })),
                  hasScenes: scenes.length > 0,
                  foldOnBar: planView !== 'breakdowns' || isOnBar(planFoldBtnRef.current, barRef.current),
                  foldLabel: planAllFolded ? 'Expand All' : 'Collapse All',
                  onFold: foldAllPlan,
                  exportOnBar: isOnBar(planExportBtnRef.current, barRef.current),
                  onExport: exportBreakdown,
                } : null,
              })}
            />
          </div>
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
                <TitlePageSheet meta={meta} className="cover-sheet" specStamp={specStamp} placeholders />
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
              locked={isLocked}
              onLockedEdit={notifyLocked}
            />
          </main>
          {showBoard && (
            <Suspense fallback={<div className="board-loading" aria-busy="true" />}>
            <BeatBoard
              key={projectId}
              beats={beats}
              onChange={setBeats}
              onMoveCard={moveCard}
              onExport={exportOutline}
              compact={view === 'split'}
              actMode={actMode}
              onActModeChange={changeActMode}
              scenes={boardScenes}
              pageCount={layout.pageCount}
              onJump={jumpTo}
              getBlocks={getBlocks}
              hidden={inPlan}
            />
            </Suspense>
          )}
          {inPlan && (
            <Suspense fallback={<div className="plan" aria-busy="true" />}>
              <PlanningWorkspace
                view={planView}
                fold={planFold}
                onToggleCard={togglePlanCard}
                blocks={blocks}
                analysis={analysis}
                scenes={scenes}
                production={production}
                onAdd={(id, bucket, text) => setProduction((p) => addAsset(p, id, bucket, text))}
                onRemove={(id, bucket, text) => setProduction((p) => removeAsset(p, id, bucket, text))}
                onNotes={(id, text) => setProduction((p) => setSceneNotes(p, id, text))}
                onOpenScene={openSceneInWrite}
              />
            </Suspense>
          )}
        </div>

        <CharactersDrawer
          key={`characters-${projectId}`}
          open={charactersOpen && !focusMode && !inPlan}
          onClose={() => setDock((d) => closeDock(d, 'characters'))}
          tab={characterTab}
          onTabChange={setCharacterTab}
          characters={characters}
          onCharactersChange={setCharacters}
          speakers={speakers}
          onRenameCharacter={setRenameFrom}
          revealBio={revealBio}
          dictionary={dictionary}
          onOpenGlossary={openGlossary}
          dialogue={{
            analysis,
            pageOfBlock: layout.pageOfBlock,
            selected: selectedChar,
            onSelect: selectCharacter,
            onEditText: updateBlockText,
            onJump: jumpTo,
            onHover: setHoverId,
          }}
        />

        <footer className={`status${filter && densityMode && density.dense ? ' has-tools' : ''}`}>
          {/* Left: what you're typing, then telemetry — saved / synced, Edit lock, scenes, notes, words.
              Format Doctor isn't here: its stepper (right) is its control, and ⋮ → Format Doctor opens it any time. */}
          <div className="status-left">
            <span className="status-type">
              {inPlan ? `Plan · ${PLAN_VIEWS.find((v) => v.id === planView).label}`
                : activeBlock && showEditor ? ELEMENT_META[activeBlock.type].label : VIEWS.find((v) => v.id === view).label}
            </span>
            {hints && showEditor && !isLocked && (
              <span className="status-hints">
                <kbd>Enter</kbd> {hints.enter}
                <kbd>Tab</kbd> {hints.tab}
              </span>
            )}
            <button
              type="button"
              className={`status-save is-${saveStatus.tone}`}
              onClick={onSaveStatusClick}
              title={[saveStatus.title, saved.at ? `Last saved ${timeLabel(saved.at)}` : ''].filter(Boolean).join(' · ')}
            >
              <span className="save-dot" aria-hidden="true" />
              {saveStatus.label}
            </button>
            <LockBadge locked={isLocked} onToggle={toggleLock} />
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
          </div>
          <span className="status-spacer" />
          {/* Right: active tool steppers [Dialogue] [Density], then the view — page, paper, undo, zoom. */}
          <div className="status-right">
            <div className="status-tools" hidden={inPlan}>
              {filter && (
                <DialogueStepper
                  name={filter.name}
                  stops={dialogueStopList}
                  index={dialogueIndex}
                  onStep={stepSpeech}
                  onGo={jumpToSpeech}
                  onClear={() => setSelectedChar(null)}
                />
              )}
              {showFormatStepper && (
                <FormatStepper
                  issues={issues}
                  index={formatIndex}
                  pageOfBlock={layout.pageOfBlock}
                  onStep={(dir) => jumpToIssue(stepRisk(formatIndex, issues.length, dir))}
                  onGo={jumpToIssue}
                  onFix={(it) => fixIssues([it])}
                  onIgnore={ignoreIssue}
                  onOpenDoctor={() => setDoctorOpen(true)}
                  onDismiss={() => setFormatHidden(new Set(issues.map(issueKey)))}
                />
              )}
              <DensityStepper
                density={density}
                on={densityMode}
                index={densityIndex}
                locations={densityLocations}
                onStep={(dir) => {
                  setDensityMode(true); // ‹ › before the highlights are on turns them on
                  jumpToRisk(stepRisk(densityMode ? densityIndex : -1, density.dense, dir));
                }}
                onGo={(i) => {
                  setDensityMode(true);
                  jumpToRisk(stepRisk(densityIndex, density.dense, { type: 'go', index: i }));
                }}
                onOff={() => {
                  setDensityMode(false);
                  setDensityIndex(-1);
                }}
              />
              {noir && (
                <button type="button" className="status-noir" onClick={() => setNoirMode(false)} title={`Film Noir — ${NOIR_COMBO} or Esc to leave`}>
                  <span aria-hidden="true">🌧</span> Noir Active · Esc to exit
                </button>
              )}
            </div>
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
              <button className="mini" onClick={undo} disabled={!canUndo || isLocked} title="Undo script edit (Ctrl+Z)">↶</button>
              <button className="mini" onClick={redo} disabled={!canRedo || isLocked} title="Redo (Ctrl+Shift+Z)">↷</button>
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
          </div>
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
        {milestone && <div className="milestone-toast" role="status" key={milestone}>{milestone}</div>}
        {bibleExportOpen && (
          // Export → Story Bible (PDF)…: loads (with lib/biblePdfExport.js) the first time it's opened.
          <Suspense fallback={null}>
            <ExportBibleModal project={{ meta, storyDna, storyNotes, characters, actMode }} onClose={() => setBibleExportOpen(false)} />
          </Suspense>
        )}
        {pendingDelete && (
          <DeleteProjectModal
            key={`${pendingDelete.id}-${pendingDelete.stage}`}
            title={pendingDelete.title}
            synced={sync.active}
            folderName={sync.folderName}
            stage={pendingDelete.stage}
            failed={pendingDelete.failed}
            busy={pendingDelete.busy}
            onConfirm={confirmDelete}
            onHardDelete={hardDelete}
            onCancel={cancelDelete}
          />
        )}
        <CueBioCard root={scrollerEl} characters={characters} onEdit={editBio} disabled={!showEditor || printing} />

        <ProjectBibleDrawer
          key={`bible-${projectId}`}
          open={bibleOpen && !focusMode && !inPlan}
          onClose={() => setDock((d) => closeDock(d, 'bible'))}
          tab={bibleTab}
          onTabChange={setBibleTab}
          projectTitle={meta.title}
          storyNotes={storyNotes}
          onStoryNotesChange={setStoryNotes}
          actMode={actMode}
          onActModeChange={changeActMode}
          onRealignActs={realignStoryActs}
          storyDna={storyDna}
          onStoryDnaChange={changeStoryDna}
          dictionary={dictionary}
          onDictionaryEdit={editDictionary}
          glossaryTerm={glossaryTerm}
        />

        <SnapshotsDrawer
          open={snapshotsOpen && !focusMode}
          revisions={allSnapshots}
          folderName={sync.active ? sync.folderName : null}
          projectTitle={meta.title}
          onClose={() => setDock((d) => closeDock(d, 'snapshots'))}
          onSnapshot={() => setSnapshotPrompt(true)}
          onRestore={(id) => setRestoreId(id)}
          onCompare={(id) => setCompareId(id)}
          onDelete={deleteSnapshot}
        />

        <NotesDrawer
          open={notesOpen && !focusMode && !inPlan}
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
        {compareId && getRevision(allSnapshots, compareId) && (
          <Suspense fallback={null}>
            <SnapshotCompare
              key={compareId}
              revision={getRevision(allSnapshots, compareId)}
              current={blocks}
              onClose={() => setCompareId(null)}
            />
          </Suspense>
        )}
        {restoreId && getRevision(allSnapshots, restoreId) && (
          <RestorePrompt
            revision={getRevision(allSnapshots, restoreId)}
            dirty={!revisions.length || JSON.stringify(revisions[revisions.length - 1].script) !== JSON.stringify(blocks)}
            onRestore={(keep) => restoreSnapshot(restoreId, keep)}
            onClose={() => setRestoreId(null)}
          />
        )}

        <ProjectsDrawer
          open={drawerOpen}
          activeId={projectId}
          live={{ title: meta.title, author: meta.author, pages: layout.pageCount, scenes: analysis.sceneCount, updatedAt: saved.at, dirty }}
          loadProjects={loadLibrary}
          libraryRev={libraryRev}
          storage={storageControls}
          focusStorage={focusStorage}
          onClose={() => setDrawerOpen(false)}
          onSwitch={switchProject}
          onCreate={newScript}
          onRename={renameProject}
          onDuplicate={duplicateProject}
          onExport={exportProject}
          onDelete={deleteProject}
          onToggleLock={toggleProjectLock}
        />

        {guideOpen && (
          <Suspense fallback={null}>
            <UserGuideModal onClose={() => setGuideOpen(false)} />
          </Suspense>
        )}

        <Suspense fallback={null}>
        {helpKind && (
          <HelpModal
            kind={helpKind}
            storage={{ ok: saved.ok, savedAt: saved.at, bytes: JSON.stringify({ meta, blocks, beats, characters, storyNotes, storyDna, production }).length, countProjects: () => projects.getAllProjects().then((l) => l.length), sync }}
            onClose={() => setHelpKind(null)}
          />
        )}

        {doctorOpen && (
          <FormatDoctorModal
            issues={issues}
            pageOfBlock={layout.pageOfBlock}
            onFix={(it) => fixIssues([it])}
            onFixAll={() => fixIssues(issues, { bulk: true })}
            onIgnore={ignoreIssue}
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
            locked={projectLocked}
            lockedTitle={meta.title.trim() || 'Untitled'}
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
        </Suspense>
        {titleOpen && (
          <TitlePageModal
            meta={meta}
            specStamp={specStamp}
            onSpecStampChange={setSpecStamp}
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
