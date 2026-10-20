import { getSnapshot, putSnapshot } from "./db";

/**
 * Offline venue mode. Every successful answer from Open-Meteo is saved in the local database; when
 * KHETKUNDLI_OFFLINE=1 (npm run demo -- --offline), or the network fails, the saved answer is served
 * instead. It is still Open-Meteo's real forecast, from the moment it was saved, so `status` stays
 * "live" for the screens and `snapshotAt` says when it was taken.
 */
export const OFFLINE = process.env.KHETKUNDLI_OFFLINE === "1";

type Body = { status?: string; error?: string } & Record<string, unknown>;

export async function withSnapshot(name: string, live: () => Promise<Body>): Promise<Response> {
  if (OFFLINE) {
    const s = getSnapshot<Body>(name);
    return Response.json(s ? { ...s.body, snapshotAt: s.fetchedAt, offline: true } : { status: "unavailable", error: "offline mode and no saved snapshot: run once with the network first" });
  }
  let body: Body;
  try {
    body = await live();
  } catch (err) {
    body = { status: "unavailable", error: String(err) };
  }
  if (body.status === "live") {
    try { putSnapshot(name, body); } catch { /* the database is optional for serving live data */ }
    return Response.json(body);
  }
  const s = getSnapshot<Body>(name);
  return Response.json(s ? { ...s.body, snapshotAt: s.fetchedAt, liveError: body.error } : body);
}
