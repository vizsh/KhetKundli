import type { SyncMsg } from "@/lib/channel";

/**
 * The phone's outbox: durable messages wait in IndexedDB until the relay accepts them, so a scan or a
 * question made with no signal in the orchard survives a closed tab and is sent when signal returns.
 * Keyed by the hybrid-logical-clock stamp, so reading the store returns messages in causal order.
 * Falls back to memory where IndexedDB is unavailable.
 */

type Stamped = SyncMsg & { hlc: string };
const DB = "khetkundli", STORE = "outbox";
const memory = new Map<string, Stamped>();
let dbp: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  dbp ??= new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "hlc" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  return dbp;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function pending(): Promise<Stamped[]> {
  const items = (await run<Stamped[]>("readonly", (s) => s.getAll())) ?? [...memory.values()];
  return items.sort((a, b) => (a.hlc < b.hlc ? -1 : 1));
}

export async function remove(hlc: string) {
  memory.delete(hlc);
  await run("readwrite", (s) => s.delete(hlc));
}

/**
 * Queue a message. Overrides are the whole season state, so a newer one replaces any older queued
 * overrides: the outbox stays small however long the phone is offline.
 */
export async function enqueue(msg: Stamped) {
  if (msg.kind === "overrides") for (const old of await pending()) if (old.kind === "overrides") await remove(old.hlc);
  memory.set(msg.hlc, msg);
  await run("readwrite", (s) => s.put(msg));
}
