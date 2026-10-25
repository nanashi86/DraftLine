// Compile the script to PDF without blocking: in a Web Worker (a fresh one per export, ended as
// soon as it answers), or — where workers aren't available — on the main thread a moment later.
// Only plain copies of the elements are handed over; the script itself is never touched.

const slim = (blocks) => (blocks || []).map((b) => ({
  id: b.id, type: b.type, text: b.text || '',
  ...(b.marks ? { marks: b.marks } : {}),
  ...(b.dual ? { dual: true } : {}),
}));

async function onThisThread(job) {
  const [{ compileScriptPdf }, { browserDeflate, loadCourierPrime }] = await Promise.all([
    import('./scriptPdf.js'),
    import('./fonts.js'),
  ]);
  return compileScriptPdf({ ...job, fonts: await loadCourierPrime(), deflate: browserDeflate() });
}

/** Resolves to { bytes, pageCount, scriptPages, missing }. */
export function compilePdfAsync({ meta, blocks, sceneNumbers = {}, showSceneNumbers = true, now = Date.now(), appVersion = '' }, { worker = typeof Worker !== 'undefined' } = {}) {
  const job = { meta: { ...meta }, blocks: slim(blocks), sceneNumbers: { ...sceneNumbers }, showSceneNumbers, now, appVersion };
  if (!worker) return onThisThread(job);
  return new Promise((resolve, reject) => {
    let w;
    try {
      w = new Worker(new URL('./pdf.worker.js', import.meta.url), { type: 'module' });
    } catch {
      onThisThread(job).then(resolve, reject);
      return;
    }
    w.onmessage = (e) => {
      w.terminate();
      if (e.data?.error) reject(new Error(e.data.error));
      else resolve(e.data);
    };
    w.onerror = (e) => { // the worker couldn't start: compile here instead
      e.preventDefault?.();
      w.terminate();
      onThisThread(job).then(resolve, reject);
    };
    w.postMessage(job);
  });
}
