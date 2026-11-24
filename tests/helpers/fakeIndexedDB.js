// A small in-memory IndexedDB (no dependencies) — enough of the API for projectStorage.js:
// open + upgrade, object stores with keyPath, transactions, get / getAll / put / delete,
// with the same asynchronous event order as the real thing (request callbacks, then the
// transaction's oncomplete once nothing is pending). Like the real thing, readwrite transactions on a
// database run one at a time, across every connection to it (two "tabs" sharing one database), and
// a transaction can be aborted (nothing it wrote is kept).

const clone = (v) => structuredClone(v);

class Request {
  constructor() {
    this.result = undefined;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
  }
}

class Transaction {
  constructor(db, names, mode = 'readonly') {
    this.db = db;
    this.names = new Set([].concat(names));
    this.pending = 0;
    this.done = false;
    this.oncomplete = null;
    this.onerror = null;
    this.onabort = null;
    this.error = null;
    this.writes = []; // [store data, key, previous value | absent] for abort
    // readwrite: wait for the database's previous readwrite transaction to finish
    let release;
    const turn = new Promise((r) => { release = r; });
    this.ready = mode === 'readwrite' ? db.rwTail.then(() => {}) : Promise.resolve();
    if (mode === 'readwrite') db.rwTail = db.rwTail.then(() => turn);
    this.release = mode === 'readwrite' ? release : () => {};
    this.ready.then(() => this.check());
  }
  abort() {
    if (this.done) return;
    for (const [data, key, had, value] of this.writes.reverse()) {
      if (had) data.set(key, value);
      else data.delete(key);
    }
    this.done = true;
    this.error = this.error || new Error('AbortError');
    this.release();
    setTimeout(() => this.onabort?.({ target: this }), 0);
  }
  objectStore(name) {
    if (!this.names.has(name)) throw new Error(`NotFoundError: ${name} not in transaction`);
    return new ObjectStore(this, name);
  }
  request(op) {
    const r = new Request();
    this.pending += 1;
    this.ready.then(() => {
      if (this.done) return;
      try {
        r.result = op();
        r.onsuccess?.({ target: r });
      } catch (e) {
        r.error = e;
        r.onerror?.({ target: r });
        this.error = e;
      }
      this.pending -= 1;
      this.check();
    });
    return r;
  }
  check() {
    setTimeout(() => {
      if (this.done || this.pending) return;
      this.done = true;
      this.release();
      if (this.error) (this.onerror || this.onabort)?.({ target: this });
      else this.oncomplete?.({ target: this });
    }, 0);
  }
  /** Note a write so abort() can undo it. */
  remember(data, key) {
    this.writes.push([data, key, data.has(key), data.get(key)]);
  }
}

class ObjectStore {
  constructor(tx, name) {
    this.tx = tx;
    this.data = tx.db.stores.get(name);
    this.keyPath = tx.db.keyPaths.get(name);
  }
  get(key) { return this.tx.request(() => (this.data.has(key) ? clone(this.data.get(key)) : undefined)); }
  getAll() { return this.tx.request(() => [...this.data.keys()].sort().map((k) => clone(this.data.get(k)))); }
  put(value) {
    return this.tx.request(() => {
      const key = value[this.keyPath];
      if (key === undefined) throw new Error('DataError: no key');
      this.tx.remember(this.data, key);
      this.data.set(key, clone(value));
      return key;
    });
  }
  delete(key) { return this.tx.request(() => { this.tx.remember(this.data, key); this.data.delete(key); }); }
}

class Database {
  constructor(name) {
    this.name = name;
    this.version = 0;
    this.stores = new Map();
    this.keyPaths = new Map();
    this.objectStoreNames = { contains: (n) => this.stores.has(n) };
    this.rwTail = Promise.resolve();
  }
  createObjectStore(name, { keyPath }) {
    this.stores.set(name, new Map());
    this.keyPaths.set(name, keyPath);
  }
  transaction(names, mode) { return new Transaction(this, names, mode); }
  close() {}
}

export function createFakeIndexedDB() {
  const dbs = new Map();
  return {
    open(name, version = 1) {
      const r = new Request();
      setTimeout(() => {
        let db = dbs.get(name);
        if (!db) {
          db = new Database(name);
          dbs.set(name, db);
        }
        r.result = db;
        if (version > db.version) {
          db.version = version;
          r.onupgradeneeded?.({ target: r });
        }
        r.onsuccess?.({ target: r });
      }, 0);
      return r;
    },
    /** Test hook: raw rows of a store. */
    dump: (name, store) => [...(dbs.get(name)?.stores.get(store)?.values() || [])],
  };
}

/** A Storage-like object (localStorage stand-in). */
export function createFakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    keys: () => [...m.keys()],
  };
}
