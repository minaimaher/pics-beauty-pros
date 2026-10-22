// better-sqlite3's synchronous API on top of sql.js (SQLite compiled to WebAssembly).
// The SQL.js module and any saved database bytes are prepared by demo/backend.js before
// the server modules are imported.
const toParams = (args) => {
  if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    return Object.fromEntries(Object.entries(args[0]).map(([k, v]) => ['@' + k, norm(v)]));
  }
  return args.map(norm);
};
const norm = (v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);

class Statement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
  }
  #rows(args, limit) {
    const stmt = this.db.raw.prepare(this.sql);
    try {
      stmt.bind(toParams(args));
      const out = [];
      while ((limit == null || out.length < limit) && stmt.step()) out.push(stmt.getAsObject());
      return out;
    } finally {
      stmt.free();
    }
  }
  get(...args) {
    return this.#rows(args, 1)[0];
  }
  all(...args) {
    return this.#rows(args);
  }
  run(...args) {
    const stmt = this.db.raw.prepare(this.sql);
    try {
      stmt.bind(toParams(args));
      stmt.step();
    } finally {
      stmt.free();
    }
    const changes = this.db.raw.getRowsModified();
    const id = this.db.raw.exec('SELECT last_insert_rowid()')[0].values[0][0];
    return { changes, lastInsertRowid: id };
  }
}

export default class Database {
  constructor() {
    const { SQL, bytes } = globalThis.__PBP_SQL;
    this.raw = new SQL.Database(bytes || undefined);
    this.depth = 0;
  }
  prepare(sql) {
    return new Statement(this, sql);
  }
  exec(sql) {
    this.raw.exec(sql);
    return this;
  }
  pragma(str) {
    if (/journal_mode/i.test(str)) return [];
    return this.raw.exec('PRAGMA ' + str);
  }
  // Nested transactions use savepoints, as better-sqlite3 does.
  transaction(fn) {
    return (...args) => {
      const name = 'sp' + this.depth++;
      this.raw.exec('SAVEPOINT ' + name);
      try {
        const result = fn(...args);
        this.raw.exec('RELEASE ' + name);
        return result;
      } catch (err) {
        this.raw.exec('ROLLBACK TO ' + name);
        this.raw.exec('RELEASE ' + name);
        throw err;
      } finally {
        this.depth--;
      }
    };
  }
  close() {
    this.raw.close();
  }
}
