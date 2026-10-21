// An in-memory stand-in for the File System Access API's FileSystemDirectoryHandle — enough for
// folderSync.js: entries(), getFileHandle / getDirectoryHandle ({ create }), removeEntry,
// createWritable (write + close commits; abort discards), getFile().text(), and
// queryPermission / requestPermission with a switchable permission state.
// Plain JS, no imports: the browser check injects this same file into the page.

export function createFakeDirectory(name = 'DraftLine Projects', { permission = 'granted', clock = () => Date.now() } = {}) {
  const log = []; // ['write', path] / ['remove', path]
  const root = { permission, requestAnswer: 'granted', failWrites: null };

  const notFound = (n) => Object.assign(new Error(`${n} not found`), { name: 'NotFoundError' });
  const denied = () => Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });

  function makeFile(fname, path) {
    const f = { kind: 'file', name: fname, path, data: '', lastModified: 0 };
    f.getFile = async () => ({ name: fname, lastModified: f.lastModified, size: f.data.length, text: async () => f.data });
    f.createWritable = async () => {
      if (root.permission !== 'granted') throw denied();
      let buf = '';
      return {
        write: async (chunk) => {
          if (root.failWrites) throw root.failWrites;
          buf += typeof chunk === 'string' ? chunk : String(chunk?.data ?? chunk);
        },
        close: async () => {
          f.data = buf;
          f.lastModified = clock();
          log.push(['write', path]);
        },
        abort: async () => {},
      };
    };
    return f;
  }

  function makeDir(dname, path) {
    const children = new Map();
    const d = { kind: 'directory', name: dname, path, children };
    d.entries = async function* entries() {
      for (const [n, c] of [...children]) yield [n, c];
    };
    d.values = async function* values() {
      for (const c of [...children.values()]) yield c;
    };
    d.getFileHandle = async (n, { create = false } = {}) => {
      const c = children.get(n);
      if (c && c.kind === 'file') return c;
      if (c) throw Object.assign(new Error('Is a directory'), { name: 'TypeMismatchError' });
      if (!create) throw notFound(n);
      if (root.permission !== 'granted') throw denied();
      const f = makeFile(n, path ? `${path}/${n}` : n);
      children.set(n, f);
      return f;
    };
    d.getDirectoryHandle = async (n, { create = false } = {}) => {
      const c = children.get(n);
      if (c && c.kind === 'directory') return c;
      if (c) throw Object.assign(new Error('Is a file'), { name: 'TypeMismatchError' });
      if (!create) throw notFound(n);
      if (root.permission !== 'granted') throw denied();
      const sub = makeDir(n, path ? `${path}/${n}` : n);
      children.set(n, sub);
      return sub;
    };
    d.removeEntry = async (n) => {
      if (!children.has(n)) throw notFound(n);
      if (root.permission !== 'granted') throw denied();
      children.delete(n);
      log.push(['remove', path ? `${path}/${n}` : n]);
    };
    d.queryPermission = async () => root.permission;
    d.requestPermission = async () => {
      root.permission = root.requestAnswer;
      return root.permission;
    };
    return d;
  }

  const dir = makeDir(name, '');
  /** Test helpers: every file as { path: text }, the write log, and the permission switch. */
  dir.$ = {
    root,
    log,
    files() {
      const out = {};
      const walk = (d) => {
        for (const c of d.children.values()) {
          if (c.kind === 'file') out[c.path] = c.data;
          else walk(c);
        }
      };
      walk(dir);
      return out;
    },
    async put(path, text) {
      const parts = path.split('/');
      let d = dir;
      for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
      const fh = await d.getFileHandle(parts.at(-1), { create: true });
      const w = await fh.createWritable();
      await w.write(text);
      await w.close();
    },
  };
  return dir;
}
