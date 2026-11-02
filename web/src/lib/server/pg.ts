import { MIGRATIONS } from "./schema";
import { migrate, openSql, type Sql } from "./sql";

const g = globalThis as unknown as { __khetkundliPg?: Promise<Sql> };

/**
 * The process's one Postgres handle, migrated, opened once and kept across hot reloads in development.
 * Everything server-side shares it: embedded Postgres must never be opened twice on the same folder.
 */
export function database(): Promise<Sql> {
  g.__khetkundliPg ??= openSql()
    .then(async (sql) => {
      await migrate(sql, MIGRATIONS);
      return sql;
    })
    .catch((err) => {
      g.__khetkundliPg = undefined;
      throw err;
    });
  return g.__khetkundliPg;
}
