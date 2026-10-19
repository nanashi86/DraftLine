// A small in-memory IndexedDB (no dependencies) — enough of the API for projectStorage.js:
// open + upgrade, object stores with keyPath, transactions, get / getAll / put / delete,
// with the same asynchronous event order as the real thing (request callbacks, then the
// transaction's oncomplete once nothing is pending).

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
  constructor(db, names) {
    this.db = db;
    this.names = new Set([].concat(names));
    this.pending = 0;
    this.done = false;
    this.oncomplete = null;
    this.onerror = null;
    this.onabort = null;
    this.error = null;
    this.check();
  }
  objectStore(name) {
    if (!this.names.has(name)) throw new Error(`NotFoundError: ${name} not in transaction`);
    return new ObjectStore(this, name);
  }
  request(op) {
    const r = new Request();
    this.pending += 1;
    queueMicrotask(() => {
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
      if (this.error) (this.onerror || this.onabort)?.({ target: this });
      else this.oncomplete?.({ target: this });
    }, 0);
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
      this.data.set(key, clone(value));
      return key;
    });
  }
  delete(key) { return this.tx.request(() => { this.data.delete(key); }); }
}

class Database {
  constructor(name) {
    this.name = name;
    this.version = 0;
    this.stores = new Map();
    this.keyPaths = new Map();
    this.objectStoreNames = { contains: (n) => this.stores.has(n) };
  }
  createObjectStore(name, { keyPath }) {
    this.stores.set(name, new Map());
    this.keyPaths.set(name, keyPath);
  }
  transaction(names) { return new Transaction(this, names); }
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
    keys: () => [...m.keys()],
  };
}
