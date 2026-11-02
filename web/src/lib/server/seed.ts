import { geo } from "@/lib/geo";
import { generateSeason } from "@/lib/sim/season";
import { database } from "./pg";
import { Identity, type Person } from "./identity";

/**
 * The demo's people. All synthetic, like the 192 simulated farmers; the phone numbers are test numbers
 * (+91 90000 xxxxx) that belong to nobody. Plots are the engine's plot numbers, chosen from the
 * deterministic season, so the same people own the same plots on every machine.
 *
 * Seeding happens once, when the people table is empty, unless KHETKUNDLI_SEED_DEMO=0 (a real
 * deployment enrols people at the FPO desk instead).
 */
export const DEMO_PHONES = {
  sunita: "+919000000001",
  second: "+919000000002",
  officer: "+919000010001",
  admin: "+919000010002",
} as const;

export function demoPeople(): Omit<Person, "id">[] {
  const season = generateSeason();
  const hero = season.plots[season.heroPlot];
  // A second farmer who uses the app, in another village, so two phones can show the collective view.
  const adarki = geo.villages.findIndex((v) => v.id === "adarki");
  const second = season.plots.findIndex((p, i) => i !== season.heroPlot && p.farmer.usesApp && (adarki >= 0 ? p.village === adarki : p.village !== hero.village));
  const s = season.plots[second];
  return [
    { phone: DEMO_PHONES.sunita, name: hero.farmer.name, nameMr: hero.farmer.mr, role: "farmer", plots: [season.heroPlot] },
    { phone: DEMO_PHONES.second, name: s.farmer.name, nameMr: s.farmer.mr, role: "farmer", plots: [second] },
    { phone: DEMO_PHONES.officer, name: "Extension officer, Phaltan", nameMr: "कृषी सहाय्यक, फलटण", role: "officer", plots: [] },
    { phone: DEMO_PHONES.admin, name: "FPO coordinator", nameMr: "एफपीओ समन्वयक", role: "fpo_admin", plots: [] },
  ];
}

export async function seedDemo(identity: Identity) {
  const [{ n }] = await identity.sql.query<{ n: string }>("select count(*) as n from people");
  if (Number(n) > 0 || process.env.KHETKUNDLI_SEED_DEMO === "0") return false;
  for (const p of demoPeople()) await identity.upsertPerson(p);
  return true;
}

const g = globalThis as unknown as { __khetkundliIdentity?: Promise<Identity> };

/** The process's identity service on the shared database, with the demo people seeded on first use. */
export function identity(): Promise<Identity> {
  g.__khetkundliIdentity ??= database()
    .then(async (sql) => {
      const id = new Identity(sql);
      await seedDemo(id);
      return id;
    })
    .catch((err) => {
      g.__khetkundliIdentity = undefined;
      throw err;
    });
  return g.__khetkundliIdentity;
}

let hero: number | null = null;
/** The demo's hero plot (Sunita's), from the deterministic season: the plot the harvest-choice event belongs to. */
export function heroPlot(): number {
  hero ??= generateSeason().heroPlot;
  return hero;
}
