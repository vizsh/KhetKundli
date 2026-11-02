import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The Postgres connection the record lives in. With `DATABASE_URL` set it is a real server (the
 * product); without it, embedded Postgres (PGlite) in `web/data/pg`, so the laptop and the tests need
 * nothing installed. Both run the same SQL. `KHETKUNDLI_PGDATA=memory://` gives a throwaway database.
 */
/** A transaction: parameterised queries, and `exec` for a script of several statements (migrations). */
export type Tx = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  exec(script: string): Promise<void>;
};

export type Sql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Run `fn` in one transaction; it commits when `fn` resolves and rolls back when it throws. */
  tx<T>(fn: (q: Tx) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  kind: "postgres" | "pglite";
};

export async function openSql(opts: { url?: string; dataDir?: string } = {}): Promise<Sql> {
  const url = opts.url ?? process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 10 });
    return {
      kind: "postgres",
      query: async (text, params) => (await pool.query(text, params as unknown[])).rows,
      tx: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query("begin");
          const out = await fn({
            query: async (text, params) => (await client.query(text, params as unknown[])).rows,
            exec: async (script) => { await client.query(script); },
          });
          await client.query("commit");
          return out;
        } catch (err) {
          await client.query("rollback").catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = opts.dataDir ?? process.env.KHETKUNDLI_PGDATA ?? resolve(process.cwd(), "data", "pg");
  if (!dataDir.startsWith("memory://")) mkdirSync(dataDir, { recursive: true });
  const db = await PGlite.create(dataDir);
  return {
    kind: "pglite",
    query: async (text, params) => (await db.query(text, params as unknown[])).rows as never,
    tx: (fn) => db.transaction((t) => fn({
      query: async (text, params) => (await t.query(text, params as unknown[])).rows as never,
      exec: async (script) => { await t.exec(script); },
    })),
    close: () => db.close(),
  };
}

/** Versioned migrations, applied in order, each once, each in its own transaction. */
export async function migrate(sql: Sql, migrations: readonly string[]) {
  await sql.query("create table if not exists schema_migrations (version int primary key, applied_at timestamptz not null default now())");
  const done = new Set((await sql.query<{ version: number }>("select version from schema_migrations")).map((r) => Number(r.version)));
  for (const [i, text] of migrations.entries()) {
    const version = i + 1;
    if (done.has(version)) continue;
    await sql.tx(async (q) => {
      await q.exec(text);
      await q.query("insert into schema_migrations (version) values ($1)", [version]);
    });
  }
}
