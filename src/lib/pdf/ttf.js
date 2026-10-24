// Just enough of a TrueType reader to embed a font in a PDF: the metrics a FontDescriptor
// needs, the PostScript name, the embedding permission, and each character's advance width
// (through the Windows Unicode cmap). Read-only; works on any ArrayBuffer / Uint8Array.

const tag = (v, o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));

/** Parse a .ttf. Throws on anything that isn't a TrueType font with a Unicode cmap. */
export function parseTTF(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = v.getUint32(0);
  if (version !== 0x00010000 && version !== 0x74727565) throw new Error('Not a TrueType font');
  const tables = {};
  const n = v.getUint16(4);
  for (let i = 0; i < n; i++) {
    const r = 12 + i * 16;
    tables[tag(v, r)] = { offset: v.getUint32(r + 8), length: v.getUint32(r + 12) };
  }
  for (const t of ['head', 'hhea', 'hmtx', 'cmap', 'post', 'OS/2', 'name']) {
    if (!tables[t]) throw new Error(`Font has no ${t} table`);
  }

  const head = tables.head.offset;
  const unitsPerEm = v.getUint16(head + 18);
  const bbox = [v.getInt16(head + 36), v.getInt16(head + 38), v.getInt16(head + 40), v.getInt16(head + 42)];

  const hhea = tables.hhea.offset;
  const ascender = v.getInt16(hhea + 4);
  const descender = v.getInt16(hhea + 6);
  const numberOfHMetrics = v.getUint16(hhea + 34);

  const os2 = tables['OS/2'].offset;
  const os2Version = v.getUint16(os2);
  const fsType = v.getUint16(os2 + 8);
  const weightClass = v.getUint16(os2 + 4);
  const capHeight = os2Version >= 2 ? v.getInt16(os2 + 88) : Math.round(ascender * 0.7);

  const post = tables.post.offset;
  const italicAngle = v.getInt32(post + 4) / 65536;
  const underlinePosition = v.getInt16(post + 8);
  const underlineThickness = v.getInt16(post + 10);
  const isFixedPitch = v.getUint32(post + 12) !== 0;

  // hmtx: advance widths by glyph id (the last one repeats for the rest).
  const hmtx = tables.hmtx.offset;
  const advanceOfGlyph = (g) => v.getUint16(hmtx + 4 * Math.min(g, numberOfHMetrics - 1));

  // cmap: the (3, 1) Windows Unicode BMP subtable, format 4.
  const cmap = tables.cmap.offset;
  let sub = -1;
  for (let i = 0, k = v.getUint16(cmap + 2); i < k; i++) {
    const r = cmap + 4 + i * 8;
    const platform = v.getUint16(r);
    const encoding = v.getUint16(r + 2);
    const off = cmap + v.getUint32(r + 4);
    if (v.getUint16(off) !== 4) continue;
    if ((platform === 3 && encoding === 1) || (platform === 0 && sub < 0)) sub = off;
  }
  if (sub < 0) throw new Error('Font has no Unicode cmap');
  const segX2 = v.getUint16(sub + 6);
  const ends = sub + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const rangeOffsets = deltas + segX2;
  const glyphOf = (cp) => {
    if (cp > 0xffff) return 0;
    for (let i = 0; i < segX2; i += 2) {
      if (cp > v.getUint16(ends + i)) continue;
      const start = v.getUint16(starts + i);
      if (cp < start) return 0;
      const delta = v.getInt16(deltas + i);
      const ro = v.getUint16(rangeOffsets + i);
      if (ro === 0) return (cp + delta) & 0xffff;
      const g = v.getUint16(rangeOffsets + i + ro + 2 * (cp - start));
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  };

  // name: PostScript name (id 6), from a Windows (UTF-16BE) or Mac (Roman) record.
  const name = tables.name.offset;
  const strings = name + v.getUint16(name + 4);
  let postScriptName = '';
  for (let i = 0, k = v.getUint16(name + 2); i < k; i++) {
    const r = name + 6 + i * 12;
    if (v.getUint16(r + 6) !== 6) continue;
    const platform = v.getUint16(r);
    const len = v.getUint16(r + 8);
    const off = strings + v.getUint16(r + 10);
    let s = '';
    if (platform === 3 || platform === 0) for (let j = 0; j < len; j += 2) s += String.fromCharCode(v.getUint16(off + j));
    else for (let j = 0; j < len; j++) s += String.fromCharCode(v.getUint8(off + j));
    postScriptName = s;
    if (platform === 3) break;
  }

  const scale = 1000 / unitsPerEm;
  return {
    bytes,
    unitsPerEm,
    bbox,
    ascender,
    descender,
    capHeight,
    italicAngle,
    underlinePosition,
    underlineThickness,
    isFixedPitch,
    weightClass,
    fsType,
    /** May the font be embedded? (fsType bit 1 set and nothing looser = restricted license.) */
    embeddable: (fsType & 0x000e) !== 0x0002,
    postScriptName: postScriptName.replace(/[^\x21-\x7e]/g, '') || 'EmbeddedFont',
    glyphOf,
    /** Advance of a character in PDF text units (1/1000 em); 0 if the font lacks it. */
    widthOf: (cp) => {
      const g = glyphOf(cp);
      return g ? Math.round(advanceOfGlyph(g) * scale * 100) / 100 : 0;
    },
    /** In PDF units (1/1000 em) for a FontDescriptor. */
    pdfUnits: (x) => Math.round(x * scale),
  };
}
