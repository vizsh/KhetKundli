"use client";

import type { Advisory, Selection } from "@/lib/agent/pipelines";
import type { Overrides } from "@/lib/sim/types";

/** What /api/agent/advisories returns: a batch prepared for the officer, nothing sent yet. */
export type AdvisoryBatch = {
  day: string;
  dayIndex: number;
  plots: number;
  byChannel: { app: number; sms: number };
  byVillage: [string, number][];
  guardPassed: boolean;
  ms: number;
  advisories: Advisory[];
};

export async function prepareAdvisories(day: number, selection: Selection, overrides: Overrides): Promise<AdvisoryBatch> {
  const res = await fetch("/api/agent/advisories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ day, selection, overrides }) });
  if (!res.ok) throw new Error(`advisories responded ${res.status}`);
  return res.json();
}

/** Send approved advisories; they arrive on the phones over the relay, with receipts. */
export async function sendAdvisories(day: number, items: Advisory[]): Promise<{ batch: string; sent: number }> {
  const res = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ day, items: items.map(({ plot, plotId, farmer, village, channel, sms, smsMr }) => ({ plot, plotId, farmer, village, channel, sms, smsMr })) }),
  });
  if (!res.ok) throw new Error(`messages responded ${res.status}`);
  return res.json();
}
