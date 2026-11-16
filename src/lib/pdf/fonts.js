// Fonts for the compiled PDF, both under the SIL Open Font License:
//   Courier Prime (src/assets/fonts/CourierPrime-OFL.txt) — every character it has: ASCII,
//     Latin-1, Latin Extended-A, typographic punctuation.
//   Cousine (src/assets/fonts/Cousine-OFL.txt), a subset holding only what Courier Prime lacks —
//     Latin Extended-B and Additional (Romanian ș ț, Vietnamese), Greek, Cyrillic, combining
//     accents and common symbols — drawn at Courier Prime's character width, so the page is
//     unchanged. Made with fontTools' pyftsubset from Cousine 1.241 (no hinting, no layout tables).
// `new URL(…, import.meta.url)` lets Vite hash and ship the files (the service worker then
// caches them, so compiling works offline), in the app and inside the PDF worker alike.

export const COURIER_PRIME_URLS = {
  regular: new URL('../../assets/fonts/CourierPrime-Regular.ttf', import.meta.url).href,
  bold: new URL('../../assets/fonts/CourierPrime-Bold.ttf', import.meta.url).href,
  italic: new URL('../../assets/fonts/CourierPrime-Italic.ttf', import.meta.url).href,
  boldItalic: new URL('../../assets/fonts/CourierPrime-BoldItalic.ttf', import.meta.url).href,
};

export const COUSINE_URLS = {
  regular: new URL('../../assets/fonts/Cousine-Regular.ttf', import.meta.url).href,
  bold: new URL('../../assets/fonts/Cousine-Bold.ttf', import.meta.url).href,
  italic: new URL('../../assets/fonts/Cousine-Italic.ttf', import.meta.url).href,
  boldItalic: new URL('../../assets/fonts/Cousine-BoldItalic.ttf', import.meta.url).href,
};

async function loadSet(urls, label, fetchImpl) {
  const entries = await Promise.all(Object.entries(urls).map(async ([k, url]) => {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`Couldn’t load the ${label} font (${res.status})`);
    return [k, new Uint8Array(await res.arrayBuffer())];
  }));
  return Object.fromEntries(entries);
}

/** Fetch all four Courier Prime styles → { regular, bold, italic, boldItalic } as Uint8Arrays. */
export const loadCourierPrime = (fetchImpl = fetch) => loadSet(COURIER_PRIME_URLS, 'Courier Prime', fetchImpl);

/**
 * Everything compileScriptPdf needs: Courier Prime, plus Cousine as `fallback`. If Cousine can't be
 * loaded, the PDF still compiles: the characters only it has are then reported as unsupported.
 */
export async function loadPdfFonts(fetchImpl = fetch) {
  const [primary, fallback] = await Promise.all([
    loadCourierPrime(fetchImpl),
    loadSet(COUSINE_URLS, 'Cousine', fetchImpl).catch(() => null),
  ]);
  return { ...primary, ...(fallback ? { fallback } : {}) };
}

/** zlib deflate with the browser's CompressionStream (null where it's missing: streams stay uncompressed). */
export function browserDeflate() {
  if (typeof CompressionStream === 'undefined') return null;
  return async (bytes) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
}
