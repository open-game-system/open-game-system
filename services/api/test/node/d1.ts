import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";

/**
 * A D1Database over Node's built-in SQLite, for running the integration suite in Node (Stryker's
 * vitest runner cannot reach workerd). Same SQL engine as D1; only the binding surface the API
 * uses: prepare/bind/first/all/run/raw, batch and exec.
 */
type Value = SQLInputValue | boolean | undefined;
type Row = Record<string, SQLInputValue>;

function toSql(v: Value): SQLInputValue {
  if (v === undefined) throw new Error("D1_TYPE_ERROR: Type 'undefined' not supported for value");
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

class Statement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: SQLInputValue[] = [],
  ) {}

  bind(...values: Value[]): Statement {
    return new Statement(this.db, this.sql, values.map(toSql));
  }

  private stmt(): StatementSync {
    return this.db.prepare(this.sql);
  }

  private rows(): Row[] {
    return this.stmt()
      .all(...this.params)
      .map((r) => ({ ...r }));
  }

  async first(column?: string): Promise<unknown> {
    const row = this.rows()[0];
    if (!row) return null;
    return column === undefined ? row : (row[column] ?? null);
  }

  async all() {
    return { results: this.rows(), success: true, meta: { duration: 0 } };
  }

  async raw(): Promise<unknown[][]> {
    return this.rows().map((r) => Object.values(r));
  }

  run() {
    return Promise.resolve(this.runSync());
  }

  runSync() {
    const s = this.stmt();
    if (s.columns().length > 0) {
      return { results: this.rows(), success: true, meta: { duration: 0, changes: 0 } };
    }
    const r = s.run(...this.params);
    return {
      results: [],
      success: true,
      meta: { duration: 0, changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) },
    };
  }
}

export function createD1() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  return {
    prepare: (sql: string) => new Statement(db, sql),
    async batch(stmts: Statement[]) {
      db.exec("BEGIN");
      try {
        const out = stmts.map((s) => s.runSync());
        db.exec("COMMIT");
        return out;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
    async exec(sql: string) {
      db.exec(sql);
      return { count: 0, duration: 0 };
    },
  };
}
