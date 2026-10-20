"use client";

import { useEffect } from "react";
import { addTransport, appliedHlc, DURABLE, isStale, noteApplied, observe, post, SELF, type SyncMsg } from "@/lib/channel";
import { enqueue, pending, remove } from "@/lib/outbox";
import type { Overrides } from "@/lib/sim/types";
import { useDesk } from "@/lib/store";

const same = (a: Overrides, b: Overrides) => JSON.stringify(a) === JSON.stringify(b);

/** Apply a message from another window or device to this window's state. */
function receive(m: SyncMsg, reply: (msg: SyncMsg) => void, follow: (fn: () => void) => void, listenOnly = false) {
  if (!m || m.from === SELF) return;
  if (listenOnly && (m.kind === "time" || m.kind === "hello")) return;
  observe(m.hlc);
  const s = useDesk.getState();
  switch (m.kind) {
    case "hello":
      reply({ kind: "state", from: SELF, overrides: s.overrides, inbox: s.inbox, t: s.t, hlc: appliedHlc() });
      break;
    case "state":
      // Last writer wins: a snapshot older than what this screen already shows is ignored.
      if (!isStale(m.hlc) && !same(m.overrides, s.overrides) && Object.keys(m.overrides).length) {
        noteApplied(m.hlc);
        s.applyOverrides(m.overrides, "Synced from another screen", "remote");
      }
      if (m.inbox.length) s.mergeInbox(m.inbox);
      break;
    case "overrides":
      if (isStale(m.hlc)) break;
      noteApplied(m.hlc);
      if (!same(m.overrides, s.overrides)) s.applyOverrides(m.overrides, m.label, "remote");
      break;
    case "time":
      follow(() => {
        if (s.playing) s.setPlaying(false);
        s.setTime(m.t);
      });
      break;
    case "escalation":
      s.receiveEscalation(m.item);
      break;
    case "reply":
      s.receiveReply(m.id, m.reply);
      break;
    case "reset":
      if (isStale(m.hlc)) break;
      noteApplied(m.hlc);
      s.applyOverrides({}, "Demo reset on another screen", "remote");
      useDesk.setState({ ripple: null, inbox: [] });
      break;
  }
}

/**
 * Links every KhetKundli window and device: BroadcastChannel between windows on this device, and the
 * /api/sync relay (server-sent events) between devices on the same network. Durable messages go
 * through the outbox, so they survive having no signal; the clock position is not queued.
 * `listenOnly` (a lot passport opened by a buyer) receives the record but never sends, and keeps its own clock.
 */
export function SyncBridge({ listenOnly = false }: { listenOnly?: boolean }) {
  useEffect(() => {
    let following = false;
    const follow = (fn: () => void) => { following = true; fn(); following = false; };
    const cleanups: (() => void)[] = [];

    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel("khetkundli");
      const send = (msg: SyncMsg) => ch.postMessage(msg);
      ch.onmessage = (e: MessageEvent<SyncMsg>) => receive(e.data, send, follow, listenOnly);
      cleanups.push(() => ch.close());
      if (!listenOnly) cleanups.push(addTransport(send));
      send({ kind: "hello", from: SELF });
    }

    if (typeof EventSource !== "undefined") {
      const es = new EventSource("/api/sync");
      es.onmessage = (e) => {
        try { receive(JSON.parse(e.data) as SyncMsg, () => {}, follow, listenOnly); } catch { /* ignore malformed */ }
      };
      cleanups.push(() => es.close());

      if (!listenOnly) {
        const status = async () => useDesk.getState().setSync({ pending: (await pending()).length, online: navigator.onLine });
        // Send queued messages in clock order. A network failure stops the run (try again later);
        // a message the relay rejects as malformed is dropped so it cannot block the queue.
        let flushing = false;
        const flush = async () => {
          if (flushing) return;
          flushing = true;
          try {
            for (const m of await pending()) {
              const res = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(m) }).catch(() => null);
              if (!res || res.status >= 500) break;
              await remove(m.hlc);
            }
          } finally {
            flushing = false;
            await status();
          }
        };
        // Time is chatty and only matters now, so the network hears it at most four times a second, unqueued.
        let lastTime = 0;
        const send = (msg: SyncMsg) => {
          if (msg.kind === "hello" || msg.kind === "state") return;
          if (msg.kind === "time") {
            const now = performance.now();
            if (now - lastTime < 250 || !navigator.onLine) return;
            lastTime = now;
            fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(msg), keepalive: true }).catch(() => {});
            return;
          }
          if (DURABLE.has(msg.kind) && msg.hlc) void enqueue({ ...msg, hlc: msg.hlc }).then(status).then(flush);
        };
        cleanups.push(addTransport(send));
        const online = () => void flush();
        const offline = () => void status();
        window.addEventListener("online", online);
        window.addEventListener("offline", offline);
        const retry = setInterval(() => void flush(), 8000);
        // Anything left from a session that closed while offline goes now.
        void flush();
        cleanups.push(() => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); clearInterval(retry); });
      }
    }
    if (listenOnly) return () => cleanups.forEach((fn) => fn());

    let last = 0;
    const offTime = useDesk.subscribe((s, prev) => {
      if (following || s.t === prev.t) return;
      const now = performance.now();
      if (now - last < 70) return;
      last = now;
      post({ kind: "time", from: SELF, t: s.t });
    });
    cleanups.push(offTime);
    return () => cleanups.forEach((fn) => fn());
  }, [listenOnly]);
  return null;
}
