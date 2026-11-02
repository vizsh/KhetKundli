import { connection } from "next/server";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { actorOf, refuse } from "@/lib/server/auth";
import { can } from "@/lib/server/authz";
import { BACKUP_ROOT, restoreDrill, writeBackup, type Manifest } from "@/lib/server/backup";
import { database } from "@/lib/server/pg";

/**
 * Backups, for the FPO admin and the officer.
 *
 * GET  → the backups on this machine, newest first, with their manifests.
 * POST → back up the live database now (through this process: embedded Postgres must not be opened
 *        twice), then run the restore drill on it: restored into a throwaway database, it must hash the same.
 */
export async function GET(req: Request) {
  await connection();
  const denied = can(await actorOf(req), "backup");
  if (denied) return refuse(denied);
  let names: string[] = [];
  try { names = readdirSync(BACKUP_ROOT(), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse(); } catch { /* none yet */ }
  const backups = names.slice(0, 20).flatMap((name) => {
    try { return [{ name, manifest: JSON.parse(readFileSync(join(BACKUP_ROOT(), name, "manifest.json"), "utf8")) as Manifest }]; } catch { return []; }
  });
  return Response.json({ backups });
}

export async function POST(req: Request) {
  const denied = can(await actorOf(req), "backup");
  if (denied) return refuse(denied);
  try {
    const { dir, manifest } = await writeBackup(await database());
    const drill = await restoreDrill(dir);
    return Response.json({ dir, manifest, drill }, { status: drill.ok ? 200 : 500 });
  } catch (err) {
    return Response.json({ error: String(err).slice(0, 300) }, { status: 500 });
  }
}
