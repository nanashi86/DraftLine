// Synthesised sounds (Web Audio API) — no audio files to download or cache.
//   typewriterBell(): the carriage-return "ding" for FADE OUT.
// (Film Noir's rain and vinyl live in noirAudio.js.)
// It needs an AudioContext, which browsers only allow after a key press or click — it's only
// ever started from one. Where Web Audio is missing it does nothing.

let shared = null;
function audioContext(win = globalThis) {
  const AC = win.AudioContext || win.webkitAudioContext;
  if (!AC) return null;
  if (!shared || shared.state === 'closed') shared = new AC();
  if (shared.state === 'suspended') shared.resume?.();
  return shared;
}

/** The bell: a bright ~2 kHz triangle with a sine overtone, decaying exponentially over ~1.4 s. */
export function typewriterBell({ ctx = audioContext(), volume = 0.22 } = {}) {
  if (!ctx) return false;
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.setValueAtTime(volume, t);
  out.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  out.connect(ctx.destination);
  for (const [type, freq, level] of [['triangle', 2000, 1], ['sine', 4980, 0.35], ['sine', 2010, 0.5]]) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.value = level;
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 1.5);
  }
  return true;
}
