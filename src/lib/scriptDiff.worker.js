// Runs diffScripts off the main thread, so comparing a 110-page script never stalls typing or
// scrolling. One message in ({ oldBlocks, newBlocks }), one out ({ result } or { error }).
import { diffScripts } from './scriptDiff.js';

self.onmessage = (e) => {
  try {
    self.postMessage({ result: diffScripts(e.data.oldBlocks, e.data.newBlocks) });
  } catch (err) {
    self.postMessage({ error: String(err?.message || err) });
  }
};
