"use client";

import { useEffect } from "react";
import { useDesk } from "@/lib/store";
import type { Overrides } from "@/lib/sim/types";

type Msg =
  | { kind: "hello"; from: string }
  | { kind: "state"; from: string; overrides: Overrides; t: number }
  | { kind: "overrides"; from: string; overrides: Overrides; label: string }
  | { kind: "time"; from: string; t: number };

const same = (a: Overrides, b: Overrides) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Links every KhetKundli window on this device: a scan on the phone ripples on the desk, and the
 * season clock moves together. Two separate devices need a server relay (see docs/ARCHITECTURE.md).
 */
export function SyncBridge() {
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("khetkundli");
    const me = Math.random().toString(36).slice(2);
    let following = false;

    ch.onmessage = (e: MessageEvent<Msg>) => {
      const m = e.data;
      if (!m || m.from === me) return;
      const s = useDesk.getState();
      if (m.kind === "hello") {
        ch.postMessage({ kind: "state", from: me, overrides: s.overrides, t: s.t } satisfies Msg);
      } else if (m.kind === "state") {
        if (!same(m.overrides, s.overrides)) s.applyOverrides(m.overrides, "Synced from another screen", "remote");
      } else if (m.kind === "overrides") {
        if (!same(m.overrides, s.overrides)) s.applyOverrides(m.overrides, m.label, "remote");
      } else if (m.kind === "time") {
        following = true;
        if (s.playing) s.setPlaying(false);
        s.setTime(m.t);
        following = false;
      }
    };

    const offOut = useDesk.subscribe((s, prev) => {
      if (s.outbox && s.outbox !== prev.outbox) {
        ch.postMessage({ kind: "overrides", from: me, overrides: s.outbox.overrides, label: s.outbox.label } satisfies Msg);
      }
    });
    let last = 0;
    const offTime = useDesk.subscribe((s, prev) => {
      if (following || s.t === prev.t) return;
      const now = performance.now();
      if (now - last < 70) return;
      last = now;
      ch.postMessage({ kind: "time", from: me, t: s.t } satisfies Msg);
    });

    ch.postMessage({ kind: "hello", from: me } satisfies Msg);
    return () => {
      offOut();
      offTime();
      ch.close();
    };
  }, []);
  return null;
}
