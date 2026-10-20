"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sheet } from "@/components/record/sheet";
import { cn } from "@/lib/utils";

type Status = {
  mode: { offline: boolean; node: string };
  models: { server: string; agent: string; agentReady: boolean; embed: string; embedReady: boolean; routerAccuracy: number; knowledgePassages: number };
  database: { file: string; events: number; messages: number; delivered: number; read: number; agentAnswers: number; inbox: number };
  snapshots: { name: string; fetchedAt: string; bytes: number }[];
  screens: number;
  recentAnswers: { at: string; question: string; intent: string; engine: string; guard: number; ms: number }[];
};

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

function Row({ label, value, ok }: { label: string; value: React.ReactNode; ok?: boolean }) {
  return (
    <li className="grid grid-cols-[1.2rem_11rem_minmax(0,1fr)] items-baseline gap-2 border-b border-dotted border-ink/25 py-2 last:border-b-0">
      <span className={cn("typed text-[13px] font-bold", ok === undefined ? "text-ink-3" : ok ? "text-stamp" : "text-alert")}>{ok === undefined ? "·" : ok ? "✓" : "✗"}</span>
      <span className="text-[13.5px] text-ink-2">{label}</span>
      <span className="typed text-[13px]">{value}</span>
    </li>
  );
}

/** What the demo depends on, refreshed every five seconds: the page to check before anyone arrives. */
export function StatusBoard() {
  const [s, setS] = useState<Status | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    const load = () => fetch("/api/status").then((r) => r.json()).then((j) => { if (live) { setS(j); setError(false); } }).catch(() => live && setError(true));
    load();
    const id = setInterval(load, 5000);
    return () => { live = false; clearInterval(id); };
  }, []);

  return (
    <main className="mx-auto max-w-[880px] px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[34px] font-bold leading-none text-board-ink [font-stretch:80%]">Demo status <span className="font-marathi text-[20px] font-normal text-board-ink-2">स्थिती</span></h1>
        <nav className="flex gap-3 text-[14px] font-semibold text-board-ink"><Link href="/desk" className="underline">Desk</Link><Link href="/farmer" className="underline">Phone</Link><Link href="/" className="underline">Pitch</Link></nav>
      </div>
      {error && <p className="mt-3 text-[14px] text-alert">The server is not answering.</p>}
      {s && (
        <div className="mt-6 grid gap-5">
          <Sheet className="px-5 py-4">
            <h2 className="border-b-2 border-ink pb-1.5 text-[17px] font-semibold">Models on this laptop</h2>
            <ul>
              <Row label="Ollama server" value={s.models.server} ok={s.models.server === "up"} />
              <Row label="Answer model" value={s.models.agent} ok={s.models.agentReady} />
              <Row label="Embedding model" value={s.models.embed} ok={s.models.embedReady} />
              <Row label="Router (trained here)" value={`${Math.round(s.models.routerAccuracy * 100)}% on unseen phrasings`} />
              <Row label="Knowledge base" value={`${s.models.knowledgePassages} passages`} />
            </ul>
          </Sheet>
          <Sheet className="px-5 py-4">
            <h2 className="border-b-2 border-ink pb-1.5 text-[17px] font-semibold">Data</h2>
            <ul>
              <Row label="Mode" value={s.mode.offline ? "offline: saved forecast" : "online"} ok />
              <Row label="Database" value={s.database.file} ok />
              <Row label="Synced events" value={s.database.events} />
              <Row label="Messages sent" value={`${s.database.messages} · delivered ${s.database.delivered} · read ${s.database.read}`} />
              <Row label="Agent answers logged" value={s.database.agentAnswers} />
              <Row label="Questions in the inbox" value={s.database.inbox} />
              <Row label="Screens connected" value={s.screens} ok={s.screens > 0} />
              {s.snapshots.map((x) => <Row key={x.name} label={`Saved ${x.name}`} value={`${when(x.fetchedAt)} · ${(x.bytes / 1024).toFixed(0)} KB`} ok />)}
              {!s.snapshots.length && <Row label="Saved forecast" value="none yet: load the desk once with the network" ok={false} />}
            </ul>
          </Sheet>
          {s.recentAnswers.length > 0 && (
            <Sheet className="px-5 py-4">
              <h2 className="border-b-2 border-ink pb-1.5 text-[17px] font-semibold">Latest agent answers</h2>
              <ul>
                {s.recentAnswers.map((a, i) => (
                  <li key={i} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] gap-3 border-b border-dotted border-ink/25 py-1.5 text-[13px] last:border-b-0">
                    <span className="typed text-ink-3">{when(a.at)}</span>
                    <span className="truncate">{a.question}</span>
                    <span className="typed text-ink-2">{a.intent} · {a.engine} · {a.guard ? "✓" : "✗"} · {(a.ms / 1000).toFixed(1)} s</span>
                  </li>
                ))}
              </ul>
            </Sheet>
          )}
        </div>
      )}
    </main>
  );
}
