"use client";

import { useEffect } from "react";
import { addTransport, post, SELF, type SyncMsg } from "@/lib/channel";
import type { Overrides } from "@/lib/sim/types";
import { useDesk } from "@/lib/store";

const same = (a: Overrides, b: Overrides) => JSON.stringify(a) === JSON.stringify(b);

/** Apply a message from another window or device to this window's state. */
function receive(m: SyncMsg, reply: (msg: SyncMsg) => void, follow: (fn: () => void) => void) {
  if (!m || m.from === SELF) return;
  const s = useDesk.getState();
  switch (m.kind) {
    case "hello":
      reply({ kind: "state", from: SELF, overrides: s.overrides, inbox: s.inbox, t: s.t });
      break;
    case "state":
      if (!same(m.overrides, s.overrides) && Object.keys(m.overrides).length) s.applyOverrides(m.overrides, "Synced from another screen", "remote");
      if (m.inbox.length) s.mergeInbox(m.inbox);
      break;
    case "overrides":
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
      s.applyOverrides({}, "Demo reset on another screen", "remote");
      useDesk.setState({ ripple: null, inbox: [] });
      break;
  }
}

/**
 * Links every KhetKundli window and device: BroadcastChannel between windows on this device,
 * and the /api/sync relay (server-sent events) between devices on the same network.
 */
export function SyncBridge() {
  useEffect(() => {
    let following = false;
    const follow = (fn: () => void) => { following = true; fn(); following = false; };
    const cleanups: (() => void)[] = [];

    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel("khetkundli");
      const send = (msg: SyncMsg) => ch.postMessage(msg);
      ch.onmessage = (e: MessageEvent<SyncMsg>) => receive(e.data, send, follow);
      cleanups.push(addTransport(send), () => ch.close());
      send({ kind: "hello", from: SELF });
    }

    if (typeof EventSource !== "undefined") {
      const es = new EventSource("/api/sync");
      es.onmessage = (e) => {
        try { receive(JSON.parse(e.data) as SyncMsg, () => {}, follow); } catch { /* ignore malformed */ }
      };
      // Time is chatty, so the network hears it at most four times a second.
      let lastTime = 0;
      const send = (msg: SyncMsg) => {
        if (msg.kind === "hello" || msg.kind === "state") return;
        if (msg.kind === "time") {
          const now = performance.now();
          if (now - lastTime < 250) return;
          lastTime = now;
        }
        fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(msg), keepalive: true }).catch(() => {});
      };
      cleanups.push(addTransport(send), () => es.close());
    }

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
  }, []);
  return null;
}
