// A tiny XML DOM, just enough of DOMParser for parseFDX to run under `node --test`
// (no dependencies). Supports elements, attributes, text, CDATA-free entity text,
// comments and the <?xml ?> prolog.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
  return ENTITIES[e] ?? m;
});

class Node {
  constructor(tagName) {
    this.tagName = tagName;
    this.attrs = {};
    this.childNodes = [];
  }
  get children() { return this.childNodes.filter((n) => n instanceof Node); }
  get textContent() { return this.childNodes.map((n) => (typeof n === 'string' ? n : n.textContent)).join(''); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  getElementsByTagName(t) {
    const out = [];
    const walk = (n) => n.children.forEach((c) => { if (c.tagName === t) out.push(c); walk(c); });
    walk(this);
    return out;
  }
}

function parse(xml) {
  const root = new Node('#document');
  const stack = [root];
  const re = /<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<\/([\w:-]+)\s*>|<([\w:-]+)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(xml))) {
    const top = stack[stack.length - 1];
    if (m[1]) {
      if (top.tagName !== m[1]) throw new Error(`mismatched </${m[1]}>`);
      stack.pop();
    } else if (m[2]) {
      const el = new Node(m[2]);
      for (const a of m[3].matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) el.attrs[a[1]] = decode(a[2]);
      top.childNodes.push(el);
      if (!m[4]) stack.push(el);
    } else if (m[5] !== undefined && stack.length > 1) {
      top.childNodes.push(decode(m[5]));
    }
  }
  if (stack.length !== 1) throw new Error('unclosed element');
  return root;
}

export class DOMParser {
  parseFromString(xml) {
    let root;
    try {
      root = parse(xml);
    } catch {
      root = new Node('#document');
      root.childNodes.push(new Node('parsererror'));
    }
    return {
      documentElement: root.children[0],
      querySelector: (sel) => root.getElementsByTagName(sel)[0] || (root.children[0]?.tagName === sel ? root.children[0] : null),
    };
  }
}

/** Install as a global for code that does `new DOMParser()`. */
export function installDOMParser() {
  globalThis.DOMParser ??= DOMParser;
}
