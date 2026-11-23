import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, SkipBack, SkipForward, Volume2, X } from 'lucide-react';
import Select from './Select.jsx';
import { actRunOf } from '../lib/sceneActs.js';
import {
  NARRATOR, RATES, SCOPES, assignVoices, chunkText, nextStep, prevStep, rangeIndices, sceneIdAt, scopeRange, stepAt,
  usableVoices, voiceLabel,
} from '../lib/tableRead.js';
import { loadPrefs, loadVoices, savePrefs, saveVoices } from '../lib/tableReadPrefs.js';
import './TableRead.css';

const ICON = { size: 15, strokeWidth: 1.75, 'aria-hidden': true };
const synthOf = () => (typeof window !== 'undefined' && window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function'
  ? window.speechSynthesis : null);
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Table Read (Write → ⋮ → Table Read…): the script read aloud with the computer's own voices
 * (Web Speech API). A small floating player above the status bar, never a dialog: the script stays
 * visible and editable while it reads. Nothing starts until Play.
 *
 *   [Scene | Act | Script]  ⏮ ▶ ⏭  1× ▾  Voices…  ✕
 *   Scene 3 · MARIE
 *
 * One element is spoken at a time, in pieces of at most CHUNK_CHARS characters, and the next one is
 * worked out from the script as it is when the last one ends — so long scripts cost nothing extra
 * and edits while it reads are simply picked up. Pause stops the speech and remembers the piece
 * (browsers' own pause is unreliable), so Play starts that piece again.
 *
 * Keys: Space plays / pauses while the player itself has focus (never in the script or a field);
 * Esc closes the Voices list first, then the player. Closing stops the speech and puts the caret
 * back where it was. Voice choices are kept on this device (lib/tableReadPrefs.js).
 */
export default function TableRead({
  blocks, target, acts, speakers, genders, sceneNumbers, projectId, hidden = false, scrollerRef,
  onReading, onClose, returnFocus,
}) {
  const [synth] = useState(synthOf);
  const [prefs0] = useState(loadPrefs);
  const [scope, setScope] = useState('scene');
  const [fromHere, setFromHere] = useState(false);
  const [rate, setRate] = useState(prefs0.rate);
  const [readAction, setReadAction] = useState(prefs0.readAction);
  const [readParens, setReadParens] = useState(prefs0.readParens);
  // Online voices send the text to their provider: asked once per device before one first speaks.
  const [consent, setConsent] = useState(prefs0.onlineConsent); // 'online' | 'device' | null (not asked yet)
  const [asking, setAsking] = useState(false);
  const consentRef = useRef(prefs0.onlineConsent);
  const pending = useRef(null);
  const consentBtnRef = useRef(null);
  const [overrides, setOverrides] = useState(() => loadVoices(projectId));
  const [voices, setVoices] = useState([]);
  const [voicesChecked, setVoicesChecked] = useState(false);
  const [status, setStatus] = useState('idle'); // idle · playing · paused
  const [cur, setCur] = useState(null); // the step being read (lib/tableRead.js stepAt)
  const [message, setMessage] = useState('');
  const [voicesOpen, setVoicesOpen] = useState(false);
  const [order, setOrder] = useState(speakers); // speakers as of opening: assignments stay put while it reads

  const rootRef = useRef(null);
  const playRef = useRef(null);
  const voicesBtnRef = useRef(null);
  const live = useRef({});
  const eng = useRef({ session: 0, chunk: 0, range: null, failures: 0, timer: 0, startTimer: 0, cur: null, status: 'idle', remoteDown: false });

  // The target (where Scene / Act / From here start): App's reading target — the element the caret
  // moved to, the scene picked in the Scenes sidebar, or null for the Title Page (the first scene).
  // `target.n` counts each new choice, so picking the same scene again counts too.
  const anchor = target?.id ?? null;

  // Online voices need a connection: offline (or after one fails), only on-device voices are used.
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const [remoteDown, setRemoteDown] = useState(false);
  useEffect(() => {
    const up = () => {
      eng.current.remoteDown = false;
      setRemoteDown(false);
      setOnline(true);
    };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  const useOnline = online && !remoteDown && consent !== 'device';

  // ---- Voices: Chrome lists them a moment after the page loads (voiceschanged) ----
  useEffect(() => {
    if (!synth) return undefined;
    const load = () => setVoices(synth.getVoices() || []);
    load();
    synth.addEventListener?.('voiceschanged', load);
    const t = setTimeout(() => {
      load();
      setVoicesChecked(true);
    }, 1500);
    return () => {
      clearTimeout(t);
      synth.removeEventListener?.('voiceschanged', load);
    };
  }, [synth]);

  // New speakers (typed in while open) join the end of the list; nobody already there moves.
  const joined = speakers.filter((n) => !order.includes(n));
  if (joined.length) setOrder([...order, ...joined]);

  const lang = (typeof document !== 'undefined' && document.documentElement.lang) || (typeof navigator !== 'undefined' && navigator.language) || 'en';
  const usable = useMemo(() => usableVoices(voices, lang), [voices, lang]);
  const byUri = useMemo(() => new Map(usable.map((v) => [v.voiceURI, v])), [usable]);
  const assigned = useMemo(
    () => assignVoices({ speakers: order, voices: usable, overrides, genders, lang, online: useOnline }),
    [order, usable, overrides, genders, lang, useOnline],
  );
  const opts = useMemo(() => ({ readAction, readParens }), [readAction, readParens]);
  const actRun = useCallback((sceneId) => actRunOf(acts || [], sceneId), [acts]);

  useLayoutEffect(() => {
    live.current = { blocks, anchor, scope, fromHere, opts, rate, assigned, byUri, actRun };
  });

  const noSpeech = !synth;
  const noVoices = !!synth && voicesChecked && usable.length === 0;
  const onlyOnline = !!synth && usable.length > 0 && !usable.some((v) => v.localService) && !assigned[NARRATOR];
  const actAvailable = !!scopeRange(blocks, { scope: 'act', anchorId: anchor, actRun });
  const canPlay = !noSpeech && !noVoices && !onlyOnline && usable.length > 0;

  // ---- The engine: refs, so a speech event never acts on a stale render ----
  const show = (step, st) => {
    eng.current.cur = step;
    if (st) eng.current.status = st;
    setCur(step);
    if (st) setStatus(st);
  };
  const stopSpeech = () => {
    const e = eng.current;
    e.session += 1;
    clearTimeout(e.timer);
    clearTimeout(e.startTimer);
    try {
      synth?.cancel();
    } catch { /* nothing to stop */ }
  };

  // The current step again, from the script as it is now (it may have been edited or moved).
  const refresh = (step) => {
    const { blocks: bl, opts: o } = live.current;
    const i = bl.findIndex((b) => b.id === step.blockId);
    if (i < 0) return { gone: true, index: Math.min(step.index, bl.length) };
    return stepAt(bl, i, o) || { gone: true, index: i + 1 };
  };

  const finish = (text) => {
    stopSpeech();
    eng.current.range = null;
    show(null, 'idle');
    setMessage(text);
  };

  const advance = () => {
    const e = eng.current;
    const { blocks: bl, opts: o } = live.current;
    const at = e.cur ? bl.findIndex((b) => b.id === e.cur.blockId) : -1;
    const from = at >= 0 ? at + 1 : (e.cur ? Math.min(e.cur.index, bl.length) : 0);
    const [, end] = rangeIndices(bl, e.range);
    const next = nextStep(bl, from, end, o);
    e.chunk = 0;
    if (!next) {
      finish(scopeDone(live.current.scope));
      return;
    }
    show(next);
    speak();
  };

  const speak = () => {
    const e = eng.current;
    if (!synth || !e.cur) return;
    stopSpeech();
    const my = e.session;
    let step = refresh(e.cur);
    if (step.gone) {
      e.cur = { ...e.cur, index: step.index, blockId: null };
      advance();
      return;
    }
    if (step.blockId !== e.cur.blockId || step.text !== e.cur.text || step.voiceKey !== e.cur.voiceKey) show(step);
    step = e.cur;
    const pieces = chunkText(step.text);
    if (e.chunk >= pieces.length) {
      advance();
      return;
    }
    const { assigned: a, byUri: uris, rate: r } = live.current;
    const pick = a[step.voiceKey] || a[NARRATOR];
    const voice = pick ? uris.get(pick.voiceURI) : null;
    if (!voice) {
      finish('No voice is available to read this. Choose one in Voices…');
      return;
    }
    // Nothing reaches an online voice before the writer has said yes.
    if (voice.localService === false && consentRef.current !== 'online') {
      if (consentRef.current === 'device') { // the voices are switching to on-device ones: a moment
        e.timer = setTimeout(() => {
          if (my === e.session) speak();
        }, 60);
      } else {
        askConsent('play');
      }
      return;
    }
    const text = pieces[e.chunk];
    const u = new window.SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang || '';
    u.rate = r;
    u.pitch = pick.pitch || 1;
    const next = () => {
      if (my !== e.session) return;
      clearTimeout(e.timer);
      e.failures = 0;
      e.chunk += 1;
      if (e.chunk < pieces.length) speak();
      else advance();
    };
    // An online voice that fails (no connection, blocked): on-device voices from here on, same place.
    const fallBack = () => {
      if (voice.localService !== false || e.remoteDown) return false;
      clearTimeout(e.timer);
      clearTimeout(e.startTimer);
      e.remoteDown = true;
      setRemoteDown(true);
      e.timer = setTimeout(() => {
        if (my === e.session) speak();
      }, 80);
      return true;
    };
    let started = false;
    u.onstart = () => {
      started = true;
      clearTimeout(e.startTimer);
    };
    u.onend = next;
    u.onerror = (ev) => {
      if (my !== e.session) return;
      if (ev?.error === 'interrupted' || ev?.error === 'canceled') return;
      if (fallBack()) return;
      clearTimeout(e.timer);
      e.failures += 1;
      if (e.failures >= 3) {
        finish('Speech stopped: this browser’s voice didn’t respond. Try another voice in Voices…');
        return;
      }
      e.timer = setTimeout(next, 250);
    };
    // A watchdog: some engines drop an utterance without ever saying it ended.
    const expected = (text.length / (14 * r)) * 1000;
    e.timer = setTimeout(() => {
      if (my !== e.session) return;
      e.failures += 1;
      if (e.failures >= 3) finish('Speech stopped: this browser’s voice didn’t respond. Try another voice in Voices…');
      else next();
    }, expected * 2.5 + 5000);
    if (voice.localService === false) {
      e.startTimer = setTimeout(() => {
        if (my === e.session && !started) fallBack();
      }, 5000);
    }
    try {
      if (synth.paused) synth.resume();
      synth.speak(u);
    } catch {
      finish('This browser couldn’t start speaking. Try again, or try another voice.');
    }
  };

  const startRange = () => {
    const { blocks: bl, anchor: an, scope: sc, fromHere: fh, actRun: ar, opts: o } = live.current;
    const range = scopeRange(bl, { scope: sc, anchorId: an, fromHere: fh, actRun: ar });
    if (!range) {
      setMessage('This scene isn’t in an act yet. Set acts on the Scene Board.');
      return null;
    }
    const [s, end] = rangeIndices(bl, range);
    const first = nextStep(bl, s, end, o);
    if (!first) {
      setMessage(`Nothing to read in this ${sc === 'script' ? 'script' : sc}${o.readAction ? '' : ' (Read Action & Headings is off)'}.`);
      return null;
    }
    eng.current.range = range;
    eng.current.chunk = 0;
    eng.current.failures = 0;
    return first;
  };

  const play = () => {
    if (!canPlay) return;
    setMessage('');
    const e = eng.current;
    if (!e.cur) {
      const first = startRange();
      if (!first) return;
      show(first, 'playing');
    } else {
      show(e.cur, 'playing');
    }
    speak();
  };
  const pause = () => {
    stopSpeech();
    show(eng.current.cur, 'paused');
  };
  const toggle = () => (eng.current.status === 'playing' ? pause() : play());

  const move = (dir) => {
    if (!canPlay) return;
    const e = eng.current;
    const { blocks: bl, opts: o } = live.current;
    let target;
    if (!e.cur) {
      target = startRange();
    } else {
      const [start, end] = rangeIndices(bl, e.range);
      const at = Math.max(0, bl.findIndex((b) => b.id === e.cur.blockId));
      target = dir > 0 ? nextStep(bl, at + 1, end, o) : prevStep(bl, at, start, o);
      // ⏮ in the middle of an element starts it again, as on any player
      if (dir < 0 && !target) target = refresh(e.cur).gone ? null : e.cur;
    }
    if (!target) return;
    setMessage('');
    e.chunk = 0;
    const st = e.status === 'playing' ? 'playing' : 'paused';
    stopSpeech();
    show(target, st);
    if (st === 'playing') speak();
  };

  // Scope, "From here" or reading options changed: start over from that range (nothing plays).
  const resetTo = () => {
    stopSpeech();
    eng.current.range = null;
    eng.current.chunk = 0;
    show(null, 'idle');
    setMessage('');
  };

  // A new target (a click in the script, a scene picked in the sidebar, the Title Page) while stopped
  // or paused: the next Play starts there. While it's playing, nothing is interrupted.
  const seenTarget = useRef(target?.n);
  useEffect(() => {
    if (seenTarget.current === target?.n) return;
    seenTarget.current = target?.n;
    if (eng.current.status !== 'playing') resetTo();
  }, [target?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => {
    stopSpeech();
    onReading?.(null);
    onClose?.();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }, [onClose, onReading, returnFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Never autoplay: focus lands on Play, ready for Enter or Space.
  // (after the ⋮ menu has closed and put focus back on its button)
  useEffect(() => {
    const t = setTimeout(() => playRef.current?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(t);
  }, []);

  // Closing, switching project (App unmounts the player) or leaving the page: silence.
  useEffect(() => () => {
    eng.current.session += 1;
    clearTimeout(eng.current.timer);
    try {
      synthOf()?.cancel();
    } catch { /* nothing to stop */ }
  }, []);

  // The script is hidden (Board, Plan) or the tab is in the background: pause, keep the place.
  useEffect(() => {
    if (hidden && eng.current.status === 'playing') pause();
  }, [hidden]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden' && eng.current.status === 'playing') pause();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Highlight the element being read and keep it comfortably in view (not while the writer is typing
  // in the script: their caret stays where it is).
  const readingId = cur?.blockId || null;
  useEffect(() => {
    onReading?.(readingId);
  }, [readingId, onReading]);
  useLayoutEffect(() => {
    if (!readingId) return;
    const scroller = scrollerRef?.current;
    if (!scroller || scroller.hidden) return;
    const focused = document.activeElement;
    if (focused && scroller.contains(focused) && focused.tagName === 'TEXTAREA') return;
    const el = scroller.querySelector(`textarea[data-id="${CSS.escape(readingId)}"]`)?.closest('.el');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const s = scroller.getBoundingClientRect();
    if (r.top >= s.top + s.height * 0.12 && r.bottom <= s.bottom - s.height * 0.3) return;
    scroller.scrollBy({ top: r.top - (s.top + s.height * 0.3), behavior: reduceMotion() ? 'auto' : 'smooth' });
  }, [readingId, scrollerRef]);

  // ---- Settings ----
  const chooseRate = (v) => {
    setRate(v);
    savePrefs({ rate: v });
    if (eng.current.status === 'playing') setTimeout(speak, 0); // the piece again, at the new speed
  };
  const setOption = (key, v) => {
    if (key === 'readAction') setReadAction(v);
    else setReadParens(v);
    savePrefs({ [key]: v });
    if (eng.current.status !== 'playing') resetTo();
  };
  // ---- The one-time online-voice question ----
  const askConsent = (after) => {
    stopSpeech();
    if (eng.current.cur) show(eng.current.cur, 'paused');
    pending.current = after;
    setVoicesOpen(false);
    setAsking(true);
    setTimeout(() => consentBtnRef.current?.focus({ preventScroll: true }), 0);
  };
  const decide = (choice) => {
    consentRef.current = choice;
    setConsent(choice);
    savePrefs({ onlineConsent: choice });
    setAsking(false);
    const after = pending.current;
    pending.current = null;
    playRef.current?.focus({ preventScroll: true });
    if (after === 'play' && eng.current.cur) {
      setTimeout(() => {
        show(eng.current.cur, 'playing');
        speak();
      }, 0);
    }
  };
  const dismissConsent = () => {
    setAsking(false);
    pending.current = null;
    playRef.current?.focus({ preventScroll: true });
  };

  const chooseVoice = (key, uri) => {
    // Choosing an online voice yourself after "Use On-Device Voice": the question is asked again at Play.
    if (uri && byUri.get(uri)?.localService === false && consentRef.current === 'device') {
      consentRef.current = null;
      setConsent(null);
      savePrefs({ onlineConsent: null });
    }
    const next = { ...overrides };
    if (uri) next[key] = uri;
    else delete next[key];
    setOverrides(next);
    saveVoices(projectId, next);
  };
  const autoAssign = () => {
    setOverrides({});
    setOrder(speakers);
    saveVoices(projectId, {});
  };
  const preview = (key) => {
    if (!synth) return;
    if (eng.current.status === 'playing') pause();
    stopSpeech();
    const pick = assigned[key] || assigned[NARRATOR];
    const voice = pick && byUri.get(pick.voiceURI);
    if (!voice) return;
    if (voice.localService === false && consentRef.current !== 'online') {
      if (consentRef.current !== 'device') askConsent(null); // a sample is text too: ask first
      return;
    }
    const u = new window.SpeechSynthesisUtterance(key === NARRATOR ? 'Interior. A quiet room, night.' : `This is ${titleCase(key)}.`);
    u.voice = voice;
    u.lang = voice.lang || '';
    u.rate = rate;
    u.pitch = pick.pitch || 1;
    try {
      synth.speak(u);
    } catch { /* the preview is only a courtesy */ }
  };

  // ---- Keys ----
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (e.target.closest?.('[role="combobox"][aria-expanded="true"]')) return; // a list is open: Esc closes just that
      e.preventDefault();
      e.stopPropagation();
      if (asking) {
        dismissConsent(); // not answered: nothing is sent, and it's asked again at the next Play
      } else if (voicesOpen) {
        setVoicesOpen(false);
        voicesBtnRef.current?.focus();
      } else {
        close();
      }
    } else if ((e.key === ' ' || e.code === 'Space') && e.target === rootRef.current) {
      e.preventDefault();
      toggle();
    }
  };

  // ---- What the player says ----
  const sceneNo = cur ? sceneNumbers?.[sceneIdAt(blocks, Math.max(0, blocks.findIndex((b) => b.id === cur.blockId)))] : null;
  const who = cur ? (cur.voiceKey === NARRATOR ? 'Narrator' : cur.voiceKey) : '';
  const curPick = cur ? assigned[cur.voiceKey] || assigned[NARRATOR] : null;
  const curRemote = !!curPick && byUri.get(curPick.voiceURI)?.localService === false;
  const where = curRemote ? ' · Online voice' : !useOnline && usable.some((v) => !v.localService) ? ' · On-device voices' : '';
  const targetText = describeTarget({ blocks, scope, anchor, fromHere, actRun, sceneNumbers });
  const info = noSpeech ? 'Read-aloud isn’t available in this browser.'
    : noVoices ? 'No voices are installed for read-aloud in this browser.'
      : onlyOnline ? 'Only online voices here: choose one in Voices… (the text is sent to the voice provider).'
        : message || (cur ? `${sceneNo ? `Scene ${sceneNo} · ` : ''}${who}${status === 'paused' ? ' · Paused' : ''}${where}`
          : !voicesChecked && !usable.length ? 'Loading voices…' : `Ready · ${targetText}`);

  const voiceOptions = useMemo(() => {
    const local = usable.filter((v) => v.localService).map((v) => ({ value: v.voiceURI, label: voiceLabel(v) }));
    const online = usable.filter((v) => !v.localService).map((v) => ({ value: v.voiceURI, label: voiceLabel(v) }));
    return [
      { value: '', label: 'Automatic' },
      ...(local.length ? [{ group: 'On this device', options: local }] : []),
      ...(online.length ? [{ group: 'Online · text is sent to the provider', options: online }] : []),
    ];
  }, [usable]);
  const rows = [NARRATOR, ...order.filter((n) => speakers.includes(n))];
  const shownVoice = (key) => {
    const a = assigned[key];
    const v = a && byUri.get(a.voiceURI);
    if (!v) return 'No voice';
    return `${overrides[key] && byUri.has(overrides[key]) && a.voiceURI === overrides[key] ? '' : 'Auto · '}${voiceLabel(v)}${v.localService === false ? ' · online' : ''}`;
  };

  const playing = status === 'playing';
  return (
    <div
      ref={rootRef}
      className="tr-player"
      role="region"
      aria-label="Table Read"
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      {asking && (
        <div className="tr-voices tr-consent" role="alertdialog" aria-labelledby="tr-consent-title" aria-describedby="tr-consent-text">
          <p className="tr-consent-title" id="tr-consent-title">Use an online voice?</p>
          <p className="tr-v-note" id="tr-consent-text">
            Online voices send the screenplay text being read to {providerOf(assigned, byUri)} for speech synthesis.
            On-device voices keep it on this computer.
          </p>
          <div className="tr-consent-actions">
            <button ref={consentBtnRef} type="button" className="btn" onClick={() => decide('online')}>Use Online Voice</button>
            <button type="button" className="btn" onClick={() => decide('device')}>Use On-Device Voice</button>
          </div>
        </div>
      )}
      {voicesOpen && !asking && (
        <div className="tr-voices" role="group" aria-label="Voices">
          <div className="tr-v-list">
            {rows.map((key) => (
              <div className="tr-v-row" key={key}>
                <span className="tr-v-name" title={key === NARRATOR ? 'Scene headings and action' : key}>
                  {key === NARRATOR ? 'Narrator' : key}
                </span>
                <Select
                  className="tr-v-select"
                  ariaLabel={`Voice for ${key === NARRATOR ? 'the narrator' : key}`}
                  value={overrides[key] && byUri.has(overrides[key]) ? overrides[key] : ''}
                  options={voiceOptions}
                  renderValue={() => shownVoice(key)}
                  onChange={(v) => chooseVoice(key, v)}
                  disabled={!usable.length}
                />
                <button type="button" className="tr-icon" onClick={() => preview(key)} disabled={!assigned[key] && !assigned[NARRATOR]}
                  aria-label={`Hear ${key === NARRATOR ? 'the narrator' : key}`} title="Hear this voice">
                  <Volume2 {...ICON} />
                </button>
              </div>
            ))}
            {rows.length === 1 && <p className="tr-v-empty">No speaking characters yet.</p>}
          </div>
          <div className="tr-v-foot">
            <label className="tr-check">
              <input type="checkbox" checked={readAction} onChange={(e) => setOption('readAction', e.target.checked)} />
              Read Action &amp; Headings
            </label>
            <label className="tr-check">
              <input type="checkbox" checked={readParens} onChange={(e) => setOption('readParens', e.target.checked)} />
              Read Parentheticals
            </label>
            <button type="button" className="btn tr-auto" onClick={autoAssign} title="Give every character an automatic voice again">
              Auto-Assign
            </button>
          </div>
          <p className="tr-v-note">Voices come from your system and browser and stay on this device.</p>
        </div>
      )}

      <div className="tr-row">
        <div className="seg tr-scope" role="radiogroup" aria-label="Read">
          {SCOPES.map((s) => {
            const off = s.id === 'act' && !actAvailable;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={scope === s.id}
                className={`seg-btn${scope === s.id ? ' is-on' : ''}`}
                disabled={off}
                title={off ? 'Set acts on the Scene Board to read an act' : `Read the ${s.id === 'script' ? 'whole script' : `current ${s.id}`}`}
                onClick={() => {
                  setScope(s.id);
                  resetTo();
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        {scope === 'script' && (
          <label className="tr-check tr-here" title="Start from the element the caret is in">
            <input type="checkbox" checked={fromHere} onChange={(e) => { setFromHere(e.target.checked); resetTo(); }} />
            From here
          </label>
        )}
        <span className="tr-sep" aria-hidden="true" />
        <button type="button" className="tr-icon" onClick={() => move(-1)} disabled={!canPlay} aria-label="Previous element" title="Previous element">
          <SkipBack {...ICON} />
        </button>
        <button
          ref={playRef}
          type="button"
          className="tr-icon tr-play"
          onClick={toggle}
          disabled={!canPlay}
          aria-label={playing ? 'Pause' : 'Play'}
          title={playing ? 'Pause (Space)' : 'Play (Space)'}
        >
          {playing ? <Pause {...ICON} /> : <Play {...ICON} />}
        </button>
        <button type="button" className="tr-icon" onClick={() => move(1)} disabled={!canPlay} aria-label="Next element" title="Next element">
          <SkipForward {...ICON} />
        </button>
        <span className="tr-sep" aria-hidden="true" />
        <Select
          className="tr-rate"
          ariaLabel="Speed"
          title="Speed"
          value={rate}
          options={RATES.map((r) => ({ value: r, label: `${r}×` }))}
          onChange={chooseRate}
        />
        <button
          ref={voicesBtnRef}
          type="button"
          className={`btn tr-voices-btn${voicesOpen ? ' is-on' : ''}`}
          aria-expanded={voicesOpen}
          onClick={() => setVoicesOpen((o) => !o)}
          disabled={noSpeech}
        >
          Voices…
        </button>
        <button type="button" className="tr-icon" onClick={close} aria-label="Close Table Read" title="Close (Esc)">
          <X {...ICON} />
        </button>
      </div>
      <p className="tr-info" role="status" aria-live="polite">{info}</p>
    </div>
  );
}

const titleCase = (s) => String(s).toLowerCase().replace(/(^|[\s'’-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
const scopeDone = (scope) => (scope === 'scene' ? 'End of the scene.' : scope === 'act' ? 'End of the act.' : 'End of the script.');

/** What Play will read, for the player's line: "Scene 4", "Act 2A · Scenes 4–6", "Script from Scene 5". */
function describeTarget({ blocks, scope, anchor, fromHere, actRun, sceneNumbers }) {
  const range = scopeRange(blocks, { scope, anchorId: anchor, fromHere, actRun });
  if (!range) return 'This scene isn’t in an act yet';
  const no = (id) => sceneNumbers?.[id];
  const start = rangeIndices(blocks, range)[0];
  const sid = sceneIdAt(blocks, start);
  if (scope === 'script') {
    if (!range.startId) return 'Script from the top';
    return sid ? `Script from Scene ${no(sid)}` : 'Script from the opening';
  }
  if (!sid) return 'The opening';
  if (scope === 'act') {
    const run = actRun(sid);
    const a = no(run?.ids[0]);
    const z = no(run?.ids[run.ids.length - 1]);
    return `${run?.label || 'Act'} · ${a === z ? `Scene ${a}` : `Scenes ${a}–${z}`}`;
  }
  return `Scene ${no(sid)}`;
}

/** Who an online voice sends the text to: "Google" for Chrome's Google voices, else "the voice provider". */
function providerOf(assigned, byUri) {
  const remote = Object.values(assigned).map((a) => byUri.get(a.voiceURI)).filter((v) => v && v.localService === false);
  return remote.length && remote.every((v) => /^google\b/i.test(String(v.name || ''))) ? 'Google' : 'the voice provider';
}
