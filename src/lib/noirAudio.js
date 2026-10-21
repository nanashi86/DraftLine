// Film Noir sound: steady rain on the window and a record turning on the gramophone, synthesised
// with Web Audio (nothing to download), for as long as Noir mode is on.
//
//   rain   — four seconds of pink noise, looped, through a 520 Hz low-pass filter; a very slow LFO
//            swells its level a little, so it never sounds like a held note
//   vinyl  — a quiet 60 Hz mains hum, plus a looped track of sparse surface crackle (tiny clicks)
//
// start() builds the graph the first time (browsers only allow sound after a key press or click,
// which is what turns Noir on), resumes the context and fades in. stop() fades to silence and then
// suspends the context, so nothing keeps running in the background. Without Web Audio both do nothing.

export const NOIR_AUDIO = {
  volume: 0.07, // master level once faded in
  fadeIn: 1.2, // s
  fadeOut: 0.25, // s, then the context is suspended
  rain: { seconds: 4, lowpass: 520, q: 0.7, level: 0.9, lfoHz: 0.11, lfoDepth: 0.18 },
  hum: { hz: 60, level: 0.035 },
  crackle: { seconds: 3, perSecond: 7, level: 0.5 },
};

/** Pink noise (Paul Kellet's filter over white noise), roughly -1…1. */
export function pinkNoise(length, random = Math.random) {
  const out = new Float32Array(length);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i += 1) {
    const w = random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return out;
}

/**
 * Make noise loop without a seam: given `length + fade` samples, returns `length` samples whose
 * first `fade` are crossfaded with the overflow, so the last sample runs straight into the first.
 */
export function seamlessLoop(data, length, fade) {
  const out = data.slice(0, length);
  for (let i = 0; i < fade; i += 1) {
    const t = i / fade;
    out[i] = data[i] * t + data[length + i] * (1 - t);
  }
  return out;
}

/** Vinyl crackle: silence with a few micro-impulses a second, each a click decaying over ~1 ms. */
export function crackleTrack(length, sampleRate, { perSecond = NOIR_AUDIO.crackle.perSecond, random = Math.random } = {}) {
  const out = new Float32Array(length);
  const count = Math.max(1, Math.round((length / sampleRate) * perSecond));
  const tail = Math.max(4, Math.round(sampleRate * 0.001));
  for (let n = 0; n < count; n += 1) {
    const at = Math.floor(random() * (length - tail));
    const amp = (0.3 + random() * 0.7) * (random() < 0.5 ? -1 : 1);
    for (let k = 0; k < tail; k += 1) out[at + k] += amp * Math.exp(-k / (tail / 4));
  }
  return out;
}

function loopedBuffer(ctx, data) {
  const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
  buffer.getChannelData(0).set(data);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

/**
 * The Noir soundscape → { start(), stop(), dispose(), running }.
 * Options: AudioContextClass (default window.AudioContext), random, setTimer / clearTimer (tests), config.
 */
export function createNoirAudio({
  AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
  random = Math.random,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
  config = NOIR_AUDIO,
} = {}) {
  let ctx = null;
  let master = null;
  let suspendTimer = null;
  let running = false;

  function build() {
    ctx = new AudioContextClass();
    const t = ctx.currentTime;
    master = ctx.createGain();
    master.gain.setValueAtTime(0, t);
    master.connect(ctx.destination);

    // Rain: pink noise → low-pass → level, with the LFO gently swelling the level.
    const rainLength = Math.round(ctx.sampleRate * config.rain.seconds);
    const seam = Math.round(ctx.sampleRate * 0.08); // 80 ms crossfade where the loop wraps
    const rain = loopedBuffer(ctx, seamlessLoop(pinkNoise(rainLength + seam, random), rainLength, seam));
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = config.rain.lowpass;
    lowpass.Q.value = config.rain.q;
    const rainGain = ctx.createGain();
    rainGain.gain.value = config.rain.level;
    rain.connect(lowpass).connect(rainGain).connect(master);
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = config.rain.lfoHz;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = config.rain.lfoDepth;
    lfo.connect(lfoDepth).connect(rainGain.gain);

    // Vinyl: 60 Hz hum + surface crackle.
    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = config.hum.hz;
    const humGain = ctx.createGain();
    humGain.gain.value = config.hum.level;
    hum.connect(humGain).connect(master);
    const crackle = loopedBuffer(ctx, crackleTrack(Math.round(ctx.sampleRate * config.crackle.seconds), ctx.sampleRate, { perSecond: config.crackle.perSecond, random }));
    const crackleGain = ctx.createGain();
    crackleGain.gain.value = config.crackle.level;
    crackle.connect(crackleGain).connect(master);

    for (const node of [rain, lfo, hum, crackle]) node.start(t);
  }

  function rampTo(value, seconds) {
    const now = ctx.currentTime;
    const g = master.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(value, now + seconds);
  }

  return {
    get running() {
      return running;
    },
    /** Fade the rain and record in (building them the first time). False without Web Audio. */
    start() {
      if (!AudioContextClass) return false;
      if (suspendTimer != null) {
        clearTimer(suspendTimer);
        suspendTimer = null;
      }
      if (!ctx || ctx.state === 'closed') build();
      ctx.resume?.();
      rampTo(config.volume, config.fadeIn);
      running = true;
      return true;
    },
    /** Fade to silence, then suspend the context. */
    stop() {
      if (!ctx || !running) return;
      running = false;
      rampTo(0, config.fadeOut);
      if (suspendTimer != null) clearTimer(suspendTimer);
      suspendTimer = setTimer(() => {
        suspendTimer = null;
        if (!running) ctx.suspend?.();
      }, config.fadeOut * 1000 + 30);
    },
    /** Close the context for good (the app is going away). */
    dispose() {
      running = false;
      if (suspendTimer != null) clearTimer(suspendTimer);
      suspendTimer = null;
      ctx?.close?.();
      ctx = null;
    },
  };
}
