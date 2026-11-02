"use client";

import { create } from "zustand";
import { api } from "@/lib/api";

export type Role = "farmer" | "officer" | "fpo_admin" | "buyer";
export type Person = { id: string; phone: string; name: string; nameMr: string; role: Role; plots: number[] };
type DemoPerson = Pick<Person, "phone" | "name" | "nameMr" | "role">;

type SessionState = {
  status: "loading" | "ready" | "offline";
  person: Person | null;
  /** Where sign-in codes go: on screen until an SMS sender is registered. */
  sink: "screen" | "sms";
  demoPeople: DemoPerson[];
  load: () => Promise<void>;
  requestCode: (phone: string) => Promise<{ ok: true; devCode?: string } | { ok: false; error: string }>;
  verify: (phone: string, code: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => Promise<void>;
};

const errorOf = async (res: Response) => ((await res.json().catch(() => ({}))) as { error?: string }).error ?? `The server answered ${res.status}.`;

/**
 * Who is signed in on this surface of the browser (the phone or the desk). Without signal the last
 * known person stays signed in, so a farmer in the orchard keeps her record and her outbox.
 */
export const useSession = create<SessionState>((set, get) => ({
  status: "loading",
  person: null,
  sink: "screen",
  demoPeople: [],
  load: async () => {
    const key = `kk-person-${location.pathname.startsWith("/farmer") ? "phone" : "desk"}`;
    try {
      const res = await api("/api/v1/auth/me", { cache: "no-store" });
      const j = (await res.json()) as { person: Person | null; sink: "screen" | "sms"; demoPeople: DemoPerson[] };
      try { if (j.person) localStorage.setItem(key, JSON.stringify(j.person)); else localStorage.removeItem(key); } catch { /* storage may be blocked */ }
      set({ status: "ready", person: j.person, sink: j.sink, demoPeople: j.demoPeople });
    } catch {
      let person: Person | null = null;
      try { person = JSON.parse(localStorage.getItem(key) ?? "null") as Person | null; } catch { /* storage may be blocked */ }
      set({ status: "offline", person });
    }
  },
  requestCode: async (phone) => {
    const res = await api("/api/v1/auth/otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) }).catch(() => null);
    if (!res) return { ok: false, error: "No connection. Try again when there is signal." };
    if (!res.ok) return { ok: false, error: await errorOf(res) };
    const j = (await res.json()) as { devCode?: string };
    return { ok: true, devCode: j.devCode };
  },
  verify: async (phone, code) => {
    const device = /Android|iPhone|Mobile/i.test(navigator.userAgent) ? "Phone" : "Laptop";
    const res = await api("/api/v1/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code, device }) }).catch(() => null);
    if (!res) return { ok: false, error: "No connection. Try again when there is signal." };
    if (!res.ok) return { ok: false, error: await errorOf(res) };
    await get().load();
    return { ok: true };
  },
  signOut: async () => {
    await api("/api/v1/auth/logout", { method: "POST" }).catch(() => null);
    await get().load();
  },
}));
