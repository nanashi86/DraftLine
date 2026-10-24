// A small PDF 1.4 writer: numbered objects, streams (optionally Flate-compressed), a
// cross-reference table and trailer. Output is a Uint8Array; the same input always gives
// the same bytes (no timestamps or random ids unless you pass them in).

const enc = new TextEncoder();

/** A PDF name: /Name. */
export const name = (s) => ({ $name: s });
/** A reference to object `id`: "id 0 R". */
export const ref = (id) => ({ $ref: id });
/** A literal string written exactly as these bytes (already encoded). */
export const bytesString = (bytes) => ({ $bytes: bytes });

/** PDF literal string from text (ASCII/Latin-1 only), with the special characters escaped. */
export function literal(s) {
  return `(${String(s).replace(/[\\()]/g, (c) => `\\${c}`).replace(/\r/g, '\\r').replace(/\n/g, '\\n')})`;
}

/** Literal string of bytes, escaped; bytes ≥ 0x80 written as octal so the file stays ASCII. */
export function literalBytes(bytes) {
  let s = '(';
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) s += `\\${String.fromCharCode(b)}`;
    else if (b < 0x20 || b > 0x7e) s += `\\${b.toString(8).padStart(3, '0')}`;
    else s += String.fromCharCode(b);
  }
  return `${s})`;
}

/** A text string for the document info (Title …): ASCII as is, anything else as UTF-16BE. */
export function textString(s) {
  const str = String(s);
  if (/^[\x20-\x7e]*$/.test(str)) return literal(str);
  let hex = 'FEFF';
  for (let i = 0; i < str.length; i++) hex += str.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}

const num = (n) => {
  if (Number.isInteger(n)) return String(n);
  const s = n.toFixed(3);
  return s.replace(/\.?0+$/, '') || '0';
};

export function serialize(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return num(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return v; // pre-formatted (literal(), textString(), raw tokens)
  if (Array.isArray(v)) return `[${v.map(serialize).join(' ')}]`;
  if (v.$name !== undefined) return `/${v.$name}`;
  if (v.$ref !== undefined) return `${v.$ref} 0 R`;
  if (v.$bytes !== undefined) return literalBytes(v.$bytes);
  return `<<${Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `/${k} ${serialize(x)}`).join(' ')}>>`;
}

const concat = (parts) => {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

/**
 * Build a PDF. `deflate(bytes) → Promise<Uint8Array>` (zlib format) compresses streams; without
 * it streams are stored as they are (handy for tests).
 *   const pdf = createPdf({ deflate });
 *   const id = pdf.reserve();                       // an object number to fill later
 *   pdf.set(id, { Type: name('Page'), … });
 *   const s = pdf.add(await pdf.stream(bytes, { Length1: n }));
 *   await pdf.finish({ root, info }) → Uint8Array
 */
export function createPdf({ deflate = null } = {}) {
  const objects = []; // index = id - 1 → { dict } | { stream: { dict, data } }
  const pdf = {
    reserve() {
      objects.push(null);
      return objects.length;
    },
    set(id, value) {
      objects[id - 1] = value;
      return id;
    },
    add(value) {
      return pdf.set(pdf.reserve(), value);
    },
    /** A stream object's value: data (string or bytes), compressed when a deflate is given. */
    async stream(data, dict = {}) {
      const raw = typeof data === 'string' ? enc.encode(data) : data;
      if (deflate) {
        const z = await deflate(raw);
        return { $stream: { dict: { ...dict, Filter: name('FlateDecode'), Length: z.length }, data: z } };
      }
      return { $stream: { dict: { ...dict, Length: raw.length }, data: raw } };
    },
    async finish({ root, info, id = null }) {
      // The header, then a comment of high bytes that marks the file as binary for transfer tools.
      const parts = [enc.encode('%PDF-1.4\n'), new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])];
      let offset = parts.reduce((n, p) => n + p.length, 0);
      const xref = [];
      objects.forEach((obj, i) => {
        if (obj === null) throw new Error(`PDF object ${i + 1} was reserved but never set`);
        xref.push(offset);
        let chunk;
        if (obj.$stream) {
          chunk = concat([
            enc.encode(`${i + 1} 0 obj\n${serialize(obj.$stream.dict)}\nstream\n`),
            obj.$stream.data,
            enc.encode('\nendstream\nendobj\n'),
          ]);
        } else {
          chunk = enc.encode(`${i + 1} 0 obj\n${serialize(obj)}\nendobj\n`);
        }
        parts.push(chunk);
        offset += chunk.length;
      });
      const xrefAt = offset;
      let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
      for (const o of xref) table += `${String(o).padStart(10, '0')} 00000 n \n`;
      const trailer = {
        Size: objects.length + 1,
        Root: ref(root),
        ...(info ? { Info: ref(info) } : {}),
        ...(id ? { ID: [`<${id}>`, `<${id}>`] } : {}),
      };
      table += `trailer\n${serialize(trailer)}\nstartxref\n${xrefAt}\n%%EOF\n`;
      parts.push(enc.encode(table));
      return concat(parts);
    },
  };
  return pdf;
}
