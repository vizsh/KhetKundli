"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sheet } from "@/components/record/sheet";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { SignInGate } from "@/components/record/sign-in";

type Status = {
  mode: { offline: boolean; node: string };
  models: { server: string; agent: string; agentReady: boolean; embed: string; embedReady: boolean; routerAccuracy: number; knowledgePassages: number };
  record: { database: string; events: number; chainOk: boolean; head: string | null; brokenAt: number | null };
  access: { otpSink: "screen" | "sms"; people: number; sessions: number };
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
type Drill = { ok: boolean; dir: string; checks: { name: string; ok: boolean; detail: string }[] };

/** Back up the record now and prove the backup restores: the drill runs on a throwaway database. */
function BackupSheet() {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [drill, setDrill] = useState<Drill | null>(null);
  const [error, setError] = useState("");
  const run = async () => {
    setState("working");
    const res = await api("/api/v1/admin/backup", { method: "POST" }).catch(() => null);
    const j = res ? ((await res.json().catch(() => ({}))) as { drill?: Drill; error?: string }) : { error: "The server is not answering." };
    if (j.drill) { setDrill(j.drill); setState("done"); } else { setError(j.error ?? "Backup failed."); setState("error"); }
  };
  return (
    <Sheet className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-1.5">
        <h2 className="text-[17px] font-semibold">Backup and restore drill</h2>
        <button type="button" onClick={run} disabled={state === "working"} className="rounded-[3px] border-2 border-ink px-3 py-1 text-[13px] font-semibold hover:bg-ink hover:text-paper disabled:opacity-50">
          {state === "working" ? "Backing up…" : "Back up now and drill"}
        </button>
      </div>
      {state === "idle" && <p className="py-2 text-[13px] text-ink-2">Writes every table to web/data/backups, then restores it into a throwaway database and checks that it comes back the same.</p>}
      {state === "error" && <p className="py-2 text-[13px] text-alert">{error}</p>}
      {drill && (
        <ul>
          {drill.checks.map((c) => <Row key={c.name} label={c.name} value={c.detail} ok={c.ok} />)}
          <Row label="Saved in" value={drill.dir} ok={drill.ok} />
        </ul>
      )}
    </Sheet>
  );
}

/** The status page is for the officer and the FPO: it shows recent questions and the state of the record. */
export function StatusBoard() {
  return (
    <SignInGate roles={["officer", "fpo_admin"]} title="Status sign in" mr="स्थिती लॉग इन">
      {() => <Board />}
    </SignInGate>
  );
}

function Board() {
  const [s, setS] = useState<Status | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    const load = () => api("/api/status").then((r) => r.json()).then((j) => { if (live) { setS(j); setError(false); } }).catch(() => live && setError(true));
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
              <Row label="Season record" value={`${s.record.events} events · ${s.record.database === "pglite" ? "embedded Postgres" : s.record.database}`} ok={s.record.database !== "unavailable"} />
              <Row label="Hash chain" value={s.record.chainOk ? `verifies · head ${s.record.head}` : s.record.brokenAt ? `broken at row ${s.record.brokenAt}` : "not checked"} ok={s.record.chainOk} />
              <Row label="Sign-in codes" value={s.access.otpSink === "sms" ? "sent by SMS" : "shown on screen (development only)"} ok={s.access.otpSink === "sms"} />
              <Row label="People · sessions" value={`${s.access.people} registered · ${s.access.sessions} signed in`} />
              <Row label="Local file (agent log, forecasts)" value={s.database.file} ok />
              <Row label="Messages sent" value={`${s.database.messages} · delivered ${s.database.delivered} · read ${s.database.read}`} />
              <Row label="Agent answers logged" value={s.database.agentAnswers} />
              <Row label="Questions in the inbox" value={s.database.inbox} />
              <Row label="Screens connected" value={s.screens} ok={s.screens > 0} />
              {s.snapshots.map((x) => <Row key={x.name} label={`Saved ${x.name}`} value={`${when(x.fetchedAt)} · ${(x.bytes / 1024).toFixed(0)} KB`} ok />)}
              {!s.snapshots.length && <Row label="Saved forecast" value="none yet: load the desk once with the network" ok={false} />}
            </ul>
          </Sheet>
          <BackupSheet />
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
