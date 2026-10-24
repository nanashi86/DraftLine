// Courier Prime for the compiled PDF (SIL Open Font License: src/assets/fonts/CourierPrime-OFL.txt).
// `new URL(…, import.meta.url)` lets Vite hash and ship the files (the service worker then
// caches them, so compiling works offline), in the app and inside the PDF worker alike.

export const COURIER_PRIME_URLS = {
  regular: new URL('../../assets/fonts/CourierPrime-Regular.ttf', import.meta.url).href,
  bold: new URL('../../assets/fonts/CourierPrime-Bold.ttf', import.meta.url).href,
  italic: new URL('../../assets/fonts/CourierPrime-Italic.ttf', import.meta.url).href,
  boldItalic: new URL('../../assets/fonts/CourierPrime-BoldItalic.ttf', import.meta.url).href,
};

/** Fetch all four styles → { regular, bold, italic, boldItalic } as Uint8Arrays. */
export async function loadCourierPrime(fetchImpl = fetch) {
  const entries = await Promise.all(Object.entries(COURIER_PRIME_URLS).map(async ([k, url]) => {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`Couldn’t load the Courier Prime font (${res.status})`);
    return [k, new Uint8Array(await res.arrayBuffer())];
  }));
  return Object.fromEntries(entries);
}

/** zlib deflate with the browser's CompressionStream (null where it's missing: streams stay uncompressed). */
export function browserDeflate() {
  if (typeof CompressionStream === 'undefined') return null;
  return async (bytes) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
}
