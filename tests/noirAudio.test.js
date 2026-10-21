import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NOIR_AUDIO, createNoirAudio, crackleTrack, pinkNoise } from '../src/lib/noirAudio.js';

/** A recording stand-in for AudioContext. */
function fakeAudio() {
  const log = [];
  const contexts = [];
  const param = (name, value = 0) => ({
    name, value,
    setValueAtTime(v, t) { this.value = v; log.push([name, 'set', v, t]); },
    linearRampToValueAtTime(v, t) { log.push([name, 'ramp', v, t]); this.value = v; },
    cancelScheduledValues(t) { log.push([name, 'cancel', t]); },
  });
  class FakeContext {
    constructor() {
      this.state = 'running'; this.currentTime = 10; this.sampleRate = 8000; this.destination = { kind: 'destination' };
      this.nodes = [];
      contexts.push(this);
    }
    node(kind, extra = {}) {
      const n = { kind, connections: [], connect(to) { this.connections.push(to); return to; }, ...extra };
      this.nodes.push(n);
      return n;
    }
    createGain() { return this.node('gain', { gain: param(`gain${this.nodes.length}`, 1) }); }
    createBiquadFilter() { return this.node('biquad', { type: 'lowpass', frequency: param('freq', 350), Q: param('Q', 1) }); }
    createOscillator() { return this.node('osc', { type: 'sine', frequency: param('oscfreq', 440), start(t) { this.started = t; } }); }
    createBuffer(ch, length, rate) { const data = new Float32Array(length); return { length, rate, getChannelData: () => data }; }
    createBufferSource() { return this.node('source', { start(t) { this.started = t; } }); }
    resume() { this.state = 'running'; log.push(['ctx', 'resume']); return Promise.resolve(); }
    suspend() { this.state = 'suspended'; log.push(['ctx', 'suspend']); return Promise.resolve(); }
    close() { this.state = 'closed'; log.push(['ctx', 'close']); }
  }
  const timers = [];
  return {
    log, contexts, timers,
    opts: {
      AudioContextClass: FakeContext,
      random: (() => { let x = 7; return () => ((x = (x * 9301 + 49297) % 233280) / 233280); })(),
      setTimer: (fn, ms) => timers.push({ fn, ms }) - 1,
      clearTimer: (id) => { timers[id] = null; },
    },
  };
}
const master = (ctx) => ctx.nodes.find((n) => n.kind === 'gain' && n.connections.includes(ctx.destination));

describe('Film Noir audio (Web Audio): rain + vinyl', () => {
  it('rain: looped pink noise → 520 Hz low-pass → a level swelled by a slow LFO', () => {
    const f = fakeAudio();
    createNoirAudio(f.opts).start();
    const ctx = f.contexts[0];
    const lp = ctx.nodes.find((n) => n.kind === 'biquad');
    assert.equal(lp.type, 'lowpass');
    assert.equal(lp.frequency.value, 520);
    const rain = ctx.nodes.find((n) => n.kind === 'source' && n.connections[0] === lp);
    assert.ok(rain.loop && rain.buffer.length === ctx.sampleRate * NOIR_AUDIO.rain.seconds && rain.started === 10);
    const rainGain = lp.connections[0];
    assert.ok(rainGain.connections.includes(master(ctx)));
    const lfo = ctx.nodes.find((n) => n.kind === 'osc' && n.frequency.value < 1);
    assert.equal(lfo.frequency.value, NOIR_AUDIO.rain.lfoHz);
    assert.equal(lfo.connections[0].connections[0], rainGain.gain, 'LFO modulates the rain gain');
    assert.ok(lfo.connections[0].gain.value <= 0.2, 'subtly');
  });
  it('vinyl: a quiet 60 Hz hum and looped crackle (sparse micro-impulses)', () => {
    const f = fakeAudio();
    createNoirAudio(f.opts).start();
    const ctx = f.contexts[0];
    const hum = ctx.nodes.find((n) => n.kind === 'osc' && n.frequency.value === 60);
    assert.ok(hum && hum.started === 10);
    assert.ok(hum.connections[0].gain.value < 0.05 && hum.connections[0].connections.includes(master(ctx)));
    const crackle = ctx.nodes.find((n) => n.kind === 'source' && n.connections[0].kind === 'gain');
    assert.ok(crackle.loop);
    const data = crackleTrack(8000 * 3, 8000, { random: f.opts.random });
    const loud = data.filter((v) => Math.abs(v) > 0.1).length;
    assert.ok(loud > 0 && loud < data.length * 0.01, `mostly silence (${loud} loud samples)`);
    const pink = pinkNoise(8000, f.opts.random);
    assert.ok(pink.every((v) => Math.abs(v) <= 1.5) && pink.some((v) => v !== 0));
  });
  it('start(): resumes the context and fades the master in; stop(): ramps to 0, then suspends', () => {
    const f = fakeAudio();
    const audio = createNoirAudio(f.opts);
    assert.equal(audio.start(), true);
    const ctx = f.contexts[0];
    const m = master(ctx);
    assert.ok(f.log.some(([n, k]) => n === 'ctx' && k === 'resume'));
    assert.ok(f.log.some(([n, k, v, t]) => n === m.gain.name && k === 'ramp' && v === NOIR_AUDIO.volume && t === 10 + NOIR_AUDIO.fadeIn));
    assert.ok(audio.running);
    ctx.currentTime = 20;
    audio.stop();
    assert.ok(!audio.running);
    assert.ok(f.log.some(([n, k, v, t]) => n === m.gain.name && k === 'ramp' && v === 0 && t === 20 + NOIR_AUDIO.fadeOut), 'smooth fade');
    assert.equal(ctx.state, 'running', 'not cut mid-fade');
    assert.ok(f.timers[0].ms <= NOIR_AUDIO.fadeOut * 1000 + 50);
    f.timers[0].fn();
    assert.equal(ctx.state, 'suspended');
  });
  it('turning it back on reuses the graph and cancels a pending suspend; dispose closes it', () => {
    const f = fakeAudio();
    const audio = createNoirAudio(f.opts);
    audio.start();
    audio.stop();
    audio.start();
    assert.equal(f.contexts.length, 1, 'one context');
    assert.equal(f.timers[0], null, 'pending suspend cancelled');
    assert.equal(f.contexts[0].state, 'running');
    audio.dispose();
    assert.equal(f.contexts[0].state, 'closed');
    audio.stop(); // harmless
  });
  it('without Web Audio: silently nothing', () => {
    const audio = createNoirAudio({ AudioContextClass: undefined });
    assert.equal(audio.start(), false);
    audio.stop();
    audio.dispose();
  });
});
