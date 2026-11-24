// How the browser tests compare a screenshot with its baseline (not a test itself).
//
// Byte-identical is the first check, and on Linux it's the only one ever needed. On Windows, Chromium
// can anti-alias a rounded corner or border edge one or two colour steps differently from one run to
// the next (seen on the Stripboard's filter controls: 5–47 edge pixels, never more than 2/255). That's
// rendering noise, not a change, so a screenshot also passes when ALL of these hold:
//
//   - the same width and height;
//   - no pixel differs by more than MAX_DELTA (2/255) in any channel;
//   - no more than MAX_CHANGED_RATIO (0.01%) of the pixels differ at all: 117 of a 1440×818 board.
//
// Anything a person could see fails: a colour off by 3 or more anywhere, even on one pixel; a shift
// of text or a border by a pixel (deltas in the tens or hundreds); a faint change over a wide area
// (more than 0.01% of the pixels). The DOM, text, classes, computed styles and column geometry are
// still compared exactly, separately (the JSON baselines). tests/browser/stripboard.browser.js proves
// the limits with real renders, and tests/pixelTolerance.test.js with numbers.
export const MAX_DELTA = 2;
export const MAX_CHANGED_RATIO = 0.0001;

/**
 * facts: { actual: 'WxH', expected: 'WxH', changed, maxDelta } (from diffPixels).
 * → { ok, why } — why says which limit failed, or how close a tolerated difference came.
 */
export function judgePixels(facts) {
  if (facts.actual !== facts.expected) return { ok: false, why: `size changed: ${facts.expected} → ${facts.actual}` };
  const [w, h] = facts.actual.split('x').map(Number);
  const allowed = Math.floor(w * h * MAX_CHANGED_RATIO);
  if (facts.maxDelta > MAX_DELTA) return { ok: false, why: `a pixel changed by ${facts.maxDelta}/255 (more than ${MAX_DELTA})` };
  if (facts.changed > allowed) return { ok: false, why: `${facts.changed} pixels changed (more than ${allowed}, ${MAX_CHANGED_RATIO * 100}%)` };
  return { ok: true, why: `${facts.changed} edge pixels within ${facts.maxDelta}/255 (limits: ${MAX_DELTA}/255, ${allowed} pixels)` };
}

/**
 * Decode both PNGs in the page's own canvas (no image library) and compare them pixel by pixel.
 * → { actual, expected, changed, maxDelta, box, diff } — diff is a base64 PNG: changed pixels in
 * magenta over a faded copy of the actual.
 */
export function diffPixels(page, actual, expected) {
  return page.evaluate(async ([a64, e64]) => {
    const load = async (b64) => createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const [a, e] = [await load(a64), await load(e64)];
    const w = Math.max(a.width, e.width);
    const h = Math.max(a.height, e.height);
    const px = (img) => {
      const c = new OffscreenCanvas(w, h);
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      return g.getImageData(0, 0, w, h).data;
    };
    const A = px(a);
    const E = px(e);
    const out = new OffscreenCanvas(w, h);
    const g = out.getContext('2d');
    const img = g.createImageData(w, h);
    let changed = 0; let maxDelta = 0; let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
    for (let i = 0; i < A.length; i += 4) {
      const d = Math.max(Math.abs(A[i] - E[i]), Math.abs(A[i + 1] - E[i + 1]), Math.abs(A[i + 2] - E[i + 2]), Math.abs(A[i + 3] - E[i + 3]));
      const p = i / 4; const x = p % w; const y = (p - x) / w;
      if (d) {
        changed += 1; maxDelta = Math.max(maxDelta, d);
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        img.data.set([255, 0, 255, 255], i);
      } else {
        img.data.set([A[i] * 0.25 + 191, A[i + 1] * 0.25 + 191, A[i + 2] * 0.25 + 191, 255], i);
      }
    }
    g.putImageData(img, 0, 0);
    const blob = await out.convertToBlob({ type: 'image/png' });
    const diff = await new Promise((done) => { const fr = new FileReader(); fr.onload = () => done(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
    return { actual: `${a.width}x${a.height}`, expected: `${e.width}x${e.height}`, changed, maxDelta, box: x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }, diff };
  }, [actual.toString('base64'), expected.toString('base64')]);
}
