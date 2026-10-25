// Compiles the script to PDF off the main thread (scriptPdf.js), so a 110-page script never
// stalls typing. In: { meta, blocks, sceneNumbers, showSceneNumbers, now, appVersion }. Out: { bytes, … } (the
// buffer is transferred, not copied) or { error }.
import { compileScriptPdf } from './scriptPdf.js';
import { browserDeflate, loadCourierPrime } from './fonts.js';

self.onmessage = async (e) => {
  try {
    const fonts = await loadCourierPrime();
    const r = await compileScriptPdf({ ...e.data, fonts, deflate: browserDeflate() });
    self.postMessage(r, [r.bytes.buffer]);
  } catch (err) {
    self.postMessage({ error: String(err?.message || err) });
  }
};
