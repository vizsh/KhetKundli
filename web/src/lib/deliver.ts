"use client";

import type { Advisory, Selection } from "@/lib/agent/pipelines";
import { api } from "@/lib/api";

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
  /** The stored batch to send; null when there is nobody to warn. */
  batchId: string | null;
};

export async function prepareAdvisories(day: number, selection: Selection): Promise<AdvisoryBatch> {
  const res = await api("/api/agent/advisories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ day, selection }) });
  if (!res.ok) throw new Error(`advisories responded ${res.status}`);
  return res.json();
}

/**
 * Send a prepared batch by its id, leaving out the plots the officer unticked. The server sends the
 * text it stored when the batch was prepared; they arrive on the phones over the relay, with receipts.
 */
export async function sendBatch(batchId: string, exclude: number[] = []): Promise<{ batch: string; sent: number }> {
  const res = await api("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId, exclude }) });
  if (!res.ok) throw new Error(`messages responded ${res.status}`);
  return res.json();
}
