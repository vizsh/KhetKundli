// Restore drill: load a backup (the newest in web/data/backups, or the folder given) into a throwaway
// database and check that every table, the season record's hash chain and the folded season come back
// the same. It reads only the backup files, so it is safe while the app is running.
// Usage: npm run restore:drill [-- path/to/backup]
import { latestBackup, restoreDrill } from "../src/lib/server/backup";

const dir = process.argv[2] ?? latestBackup();
if (!dir) {
  console.log("No backup yet: sign in on /status as the officer or FPO admin and press Back up now (POST /api/v1/admin/backup).");
  process.exit(1);
}
const report = await restoreDrill(dir);
for (const c of report.checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}  ·  ${c.detail}`);
console.log(`${report.ok ? "PASS" : "FAIL"}  restore drill of ${dir}`);
process.exit(report.ok ? 0 : 1);
