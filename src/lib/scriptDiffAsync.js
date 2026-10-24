// diffScripts without blocking: in a Web Worker where the browser has them (a fresh one per
// comparison, ended as soon as it answers), otherwise on a later turn of the event loop.
//
// Only { id, type, text, dual } of each element is handed over: a copy, so the snapshot and the
// script on screen (and what IndexedDB holds) are never touched by the comparison.

import { diffScripts } from './scriptDiff.js';

const slim = (blocks) => (blocks || []).map((b) => ({ id: b.id, type: b.type, text: b.text || '', ...(b.dual ? { dual: true } : {}) }));

const abortError = () => Object.assign(new Error('Comparison cancelled'), { name: 'AbortError' });

/** Resolves to diffScripts(oldBlocks, newBlocks). `signal` (AbortSignal) cancels it. */
export function diffScriptsAsync(oldBlocks, newBlocks, { signal, worker = typeof Worker !== 'undefined' } = {}) {
  const a = slim(oldBlocks);
  const b = slim(newBlocks);
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    let done = false;
    let w = null;
    let timer = null;
    const finish = (fn, v) => {
      if (done) return;
      done = true;
      w?.terminate();
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      fn(v);
    };
    const onAbort = () => finish(reject, abortError());
    signal?.addEventListener('abort', onAbort);
    const onThread = () => {
      timer = setTimeout(() => {
        try { finish(resolve, diffScripts(a, b)); } catch (err) { finish(reject, err); }
      }, 0);
    };
    if (!worker) { onThread(); return; }
    try {
      w = new Worker(new URL('./scriptDiff.worker.js', import.meta.url), { type: 'module' });
    } catch {
      onThread();
      return;
    }
    w.onmessage = (e) => (e.data?.error ? finish(reject, new Error(e.data.error)) : finish(resolve, e.data.result));
    w.onerror = (e) => { // the worker couldn't start (an old cached build, a blocked script): do it here
      e.preventDefault?.();
      w.terminate();
      w = null;
      if (!done) onThread();
    };
    w.postMessage({ oldBlocks: a, newBlocks: b });
  });
}
