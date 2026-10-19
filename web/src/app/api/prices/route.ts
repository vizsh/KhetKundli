import { cacheLife } from "next/cache";
import { connection } from "next/server";

/**
 * Today's pomegranate prices from Agmarknet via data.gov.in ("Current daily price of various
 * commodities from various markets"). Needs DATA_GOV_IN_API_KEY; without it the app says so and
 * keeps its simulated prices.
 */
const RESOURCE = "9ef84268-d588-465a-a308-a864a43d0070";
const MARKETS: Record<string, RegExp> = { phaltan: /phaltan/i, pune: /^pune/i, vashi: /mumbai|vashi|navi/i };

type Rec = { state: string; district: string; market: string; commodity: string; variety: string; arrival_date: string; min_price: string; max_price: string; modal_price: string };

async function fetchPrices(key: string) {
  "use cache";
  cacheLife("hours");
  const url = new URL(`https://api.data.gov.in/resource/${RESOURCE}`);
  url.search = new URLSearchParams({
    "api-key": key,
    format: "json",
    limit: "200",
    "filters[state.keyword]": "Maharashtra",
    "filters[commodity]": "Pomegranate",
  }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`data.gov.in responded ${res.status}`);
  const { records = [] } = (await res.json()) as { records?: Rec[] };
  const out: Record<string, { market: string; date: string; modalPerKg: number; minPerKg: number; maxPerKg: number }> = {};
  for (const [id, re] of Object.entries(MARKETS)) {
    const r = records.find((x) => re.test(x.market));
    if (r) out[id] = { market: r.market, date: r.arrival_date, modalPerKg: Number(r.modal_price) / 100, minPerKg: Number(r.min_price) / 100, maxPerKg: Number(r.max_price) / 100 };
  }
  return { markets: out, records: records.length, fetchedAt: new Date().toISOString() };
}

export async function GET() {
  // Read the key at request time, so adding it after a build takes effect.
  await connection();
  const key = process.env.DATA_GOV_IN_API_KEY;
  if (!key) return Response.json({ source: "Agmarknet (data.gov.in)", status: "no-key", markets: {} });
  try {
    const data = await fetchPrices(key);
    return Response.json({ source: "Agmarknet (data.gov.in)", status: Object.keys(data.markets).length ? "live" : "no-data", ...data });
  } catch (err) {
    return Response.json({ source: "Agmarknet (data.gov.in)", status: "unavailable", markets: {}, error: String(err) });
  }
}
