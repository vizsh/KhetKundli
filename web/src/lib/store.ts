"use client";

import { create } from "zustand";
import { post, SELF, tick, type Escalation, type FarmMessage } from "@/lib/channel";
import { foldEvents, mergeEvents, SCHEMA_VERSION, uuidv7, type EventDraft, type SeasonEvent } from "@/lib/events";
import { clampDay, fmtDay, realToday, SEASON_DAYS, TODAY } from "@/lib/sim/calendar";
import { generateSeason } from "@/lib/sim/season";
import { diffSeasons, type Ripple } from "@/lib/sim/selectors";
import type { FarmerEntry, FarmerEntryDraft, MarketId, Overrides, SaleSlip, Season } from "@/lib/sim/types";
import type { LiveDaily, LiveHourly } from "@/lib/sim/weather";
import type { Ensemble, EnsembleForecast, Storm, WindGrid } from "@/lib/spread";

/** 05:31, just after the pooled runs leave at 05:15. */
const START_HOUR = 0.23;

export type Layer = "pest" | "wave" | "water" | "runs";
export type LiveStatus = "loading" | "live" | "unavailable";
/** Where a change came from: this window, or another window over the sync channel. */
export type Origin = "local" | "remote";

type DeskState = {
  /** Simulated time in days; the integer part is the stamped day, the fraction is the hour. */
  t: number;
  /** The season day that is today: the default demo day until the client reads the real date. */
  today: number;
  playing: boolean;
  layer: Layer;
  selectedPlot: number;
  selectedHex: number | null;
  /** Week pinned from the Harvest Wave chart; null follows the stamped day. */
  waveWeek: number | null;
  /** The season's facts on this screen: every event seen, merged by id. */
  events: SeasonEvent[];
  /** Projected from `events` (foldEvents); what the engine and the views read. */
  overrides: Overrides;
  live: LiveDaily[];
  hourly: LiveHourly[];
  liveStatus: LiveStatus;
  season: Season;
  ripple: (Ripple & { at: number }) | null;
  /** Questions farmers handed to the extension officer, newest first. */
  inbox: Escalation[];
  /** Advisories the officer sent, with delivery and read receipts, newest first. */
  messages: FarmMessage[];
  /** Live hourly forecast on a 3 × 3 grid over the taluka, for the wind field and spread forecast. */
  wind: WindGrid | null;
  /** Hour into the 72-hour spread forecast the desk is looking at; null follows the clock. */
  forecastHour: number | null;
  /** The 51-member ensemble at Phaltan, for the forecast's uncertainty. */
  ensemble: Ensemble | null;
  /** The spread forecast run once per ensemble member: chance of moderate exposure by cell. */
  ensembleForecast: EnsembleForecast | null;
  /** A storm the officer drew on the map: a what-if, local to this screen. */
  storm: Storm | null;
  /** The map is waiting for a storm to be drawn. */
  brushing: boolean;
  /** The 72 hours are playing across the map. */
  forecastPlaying: boolean;
  /** The phone's outbox: messages waiting for signal, and whether the browser thinks it is online. */
  sync: { pending: number; online: boolean };
  setSync: (sync: { pending: number; online: boolean }) => void;
  setWind: (wind: WindGrid | null) => void;
  setEnsemble: (ensemble: Ensemble | null) => void;
  setStorm: (storm: Storm | null) => void;
  setBrushing: (brushing: boolean) => void;
  setForecastPlaying: (playing: boolean) => void;
  setForecastHour: (hour: number | null) => void;
  warnCells: (hexes: number[], plots: number) => void;
  setDay: (day: number) => void;
  syncToday: () => void;
  setTime: (t: number) => void;
  setPlaying: (playing: boolean) => void;
  setLayer: (layer: Layer) => void;
  selectPlot: (plot: number) => void;
  selectHex: (hex: number | null) => void;
  setWaveWeek: (week: number | null) => void;
  setLive: (days: LiveDaily[], hours: LiveHourly[], status: LiveStatus) => void;
  /** Make facts on this screen: merged, the season regenerated, and sent to every other screen. */
  record: (drafts: EventDraft[], label: string) => SeasonEvent[];
  /** Facts from another screen or the server: merged by id; nothing new, nothing happens. */
  receiveEvents: (events: SeasonEvent[], label: string) => void;
  heroScan: (opts?: { confidence?: number; offline?: boolean }) => void;
  rainTwist: () => void;
  heroHarvest: (shift: number, market: MarketId) => void;
  resetDemo: () => void;
  escalate: (question: string, extra?: { context?: string[]; topic?: Escalation["topic"] }) => Escalation;
  fileSlip: (slip: SaleSlip) => void;
  /** The farmer logs work she did (a spray, a watering, a picking); it replaces what the simulation planned. */
  logEntry: (entry: FarmerEntryDraft) => FarmerEntry;
  /** Undo an entry logged by mistake. */
  removeEntry: (id: string) => void;
  replyTo: (id: string, text: string) => void;
  receiveEscalation: (item: Escalation) => void;
  receiveReply: (id: string, reply: NonNullable<Escalation["reply"]>) => void;
  mergeInbox: (items: Escalation[]) => void;
  receiveMessage: (item: FarmMessage) => void;
  mergeMessages: (items: FarmMessage[]) => void;
  receiveReceipt: (id: string, status: "delivered" | "read", at: string, simulated?: boolean) => void;
  /** This phone marks a message delivered or read; the receipt goes back through the outbox. */
  acknowledge: (id: string, status: "delivered" | "read") => void;
};

const initial = generateSeason();

export const useDesk = create<DeskState>((set, get) => {
  const regenerate = (overrides: Overrides, label?: string, live = get().live) => {
    const before = get().season;
    const season = generateSeason({ overrides, live });
    const day = Math.floor(get().t);
    set({
      overrides,
      season,
      ripple: label ? { ...diffSeasons(before, season, day, label), at: Date.now() } : get().ripple,
    });
  };

  /** Merge events and, if any are new, regenerate the season from the folded overrides. */
  const merge = (incoming: SeasonEvent[], label?: string) => {
    const before = get().events;
    const events = mergeEvents(before, incoming);
    if (events.length === before.length) return false;
    set({ events });
    regenerate(foldEvents(events), label);
    return true;
  };

  return {
    t: TODAY + START_HOUR,
    today: TODAY,
    playing: false,
    layer: "pest",
    selectedPlot: initial.heroPlot,
    selectedHex: null,
    waveWeek: null,
    events: [],
    overrides: {},
    live: [],
    hourly: [],
    liveStatus: "loading",
    season: initial,
    ripple: null,
    inbox: [],
    messages: [],
    wind: null,
    forecastHour: null,
    ensemble: null,
    ensembleForecast: null,
    storm: null,
    brushing: false,
    forecastPlaying: false,
    sync: { pending: 0, online: true },
    setSync: (sync) => set({ sync }),
    setWind: (wind) => set({ wind }),
    setEnsemble: (ensemble) => set({ ensemble }),
    setStorm: (storm) => set({ storm, brushing: false }),
    setBrushing: (brushing) => set({ brushing }),
    setForecastPlaying: (forecastPlaying) => set({ forecastPlaying }),
    setForecastHour: (forecastHour) => set({ forecastHour }),
    warnCells: (hexes, plots) => {
      const { overrides, t } = get();
      const day = Math.floor(t);
      get().record([{ kind: "advisory", day, hexes }], `Preventive advisory for ${hexes.length} ${hexes.length === 1 ? "cell" : "cells"} downwind (${plots} ${plots === 1 ? "plot" : "plots"})`);
      // The warning is not only modelled: the messages go out to the phones in the room, with receipts.
      void import("@/lib/deliver")
        .then(async ({ prepareAdvisories, sendAdvisories }) => {
          const batch = await prepareAdvisories(day, { by: "hexes", hexes }, overrides);
          if (batch.advisories.length) await sendAdvisories(day, batch.advisories);
        })
        .catch(() => { /* the server is unreachable: the modelled advisory still stands */ });
    },
    setDay: (day) => set({ t: clampDay(day) + START_HOUR }),
    syncToday: () => {
      const today = realToday();
      // Only follow the clock if nobody has moved the date stamp yet.
      const moved = Math.floor(get().t) !== get().today;
      set(moved ? { today } : { today, t: today + START_HOUR });
    },
    setTime: (t) => set({ t: Math.max(0, Math.min(SEASON_DAYS - 0.01, t)) }),
    setPlaying: (playing) => set({ playing }),
    setLayer: (layer) => set({ layer }),
    selectPlot: (selectedPlot) => set({ selectedPlot }),
    selectHex: (selectedHex) => set({ selectedHex }),
    setWaveWeek: (waveWeek) => set({ waveWeek }),
    setLive: (days, hours, status) => {
      set({ live: days, hourly: hours, liveStatus: status });
      if (days.length) regenerate(get().overrides, undefined, days);
    },
    record: (drafts, label) => {
      const events = drafts.map((d) => ({ ...d, id: uuidv7(), hlc: tick(), by: SELF, v: SCHEMA_VERSION, label }) as SeasonEvent);
      merge(events, label);
      post({ kind: "events", from: SELF, events, label });
      return events;
    },
    receiveEvents: (events, label) => { merge(events, label); },
    heroScan: (opts) => {
      const { overrides, season, t } = get();
      const day = Math.floor(t);
      if (overrides.scans?.some((s) => s.plot === season.heroPlot && s.day === day)) return;
      get().record([{ kind: "scan", plot: season.heroPlot, day, confidence: opts?.confidence ?? 0.87, offline: opts?.offline ?? true }], "Leaf scan synced from Sunita's phone");
      set({ selectedPlot: season.heroPlot, layer: "pest" });
    },
    rainTwist: () => {
      const day = Math.min(SEASON_DAYS - 1, Math.floor(get().t) + 1);
      get().record([{ kind: "rain", day, mm: 18 }], "Forecast: 18 mm rain within 18 hours");
    },
    heroHarvest: (shift, market) => {
      get().record([{ kind: "harvest", shift, market }], `Sunita set her first picking ${shift === 0 ? "as planned" : `${Math.abs(shift)} days ${shift < 0 ? "earlier" : "later"}`}, selling at ${market === "phaltan" ? "Phaltan APMC" : market === "pune" ? "Pune" : "Vashi"}`);
    },
    resetDemo: () => {
      // The season's reset is a fact like any other (nothing is deleted); the reset message clears the inbox.
      get().record([{ kind: "reset" }], "Demo reset");
      set({ ripple: null, inbox: [], messages: [] });
      post({ kind: "reset", from: SELF });
    },
    fileSlip: (slip) => {
      get().record([{ kind: "slip", slip }], `Sale slip of ${fmtDay(slip.day)} read and checked on Sunita's phone`);
    },
    logEntry: (draft) => {
      const { season } = get();
      const f = season.plots[draft.plot].farmer;
      const who = f.name.split(" ")[0];
      const what = draft.kind === "spray" ? `a ${draft.spray} spray` : draft.kind === "pick" ? `a picking of ${draft.crates} crates` : draft.skipped ? "a watering skipped" : "a watering";
      // Logging the same kind of work for the same plot and day again corrects it: the later fact wins.
      const [event] = get().record([{ kind: "entry", entry: draft }], `${who} logged ${what} on ${fmtDay(draft.day)} from ${f.woman ? "her" : "his"} phone`);
      return { ...draft, id: event.id } as FarmerEntry;
    },
    removeEntry: (id) => {
      const { overrides, season } = get();
      const entry = overrides.entries?.find((e) => e.id === id);
      if (!entry) return;
      const who = season.plots[entry.plot].farmer.name.split(" ")[0];
      // Undo is a fact too: the entry stops counting but stays in the record.
      get().record([{ kind: "retract", target: id }], `${who} removed an entry from ${fmtDay(entry.day)}`);
    },
    escalate: (question, extra) => {
      const { season, t } = get();
      const plot = season.heroPlot;
      const p = season.plots[plot];
      const day = Math.floor(t);
      const context = extra?.context ?? season.eventsByPlot[plot]
        .filter((e) => e.day <= day && e.type !== "irrigate" && e.type !== "booking")
        .slice(-5)
        .map((e) => `${e.day}: ${e.type}${e.type === "spray" && e.washedOff ? " (washed off)" : ""}${e.type === "scan" ? ` (${e.finding})` : ""}`);
      const item: Escalation = {
        id: `Q${Date.now().toString(36)}`,
        plot,
        plotId: p.id,
        farmer: p.farmer.name,
        question,
        day,
        askedAt: new Date().toISOString(),
        context,
        topic: extra?.topic ?? "crop",
      };
      set({ inbox: [item, ...get().inbox] });
      post({ kind: "escalation", from: SELF, item });
      return item;
    },
    replyTo: (id, text) => {
      const reply = { text, by: "Extension officer, Phaltan", at: new Date().toISOString() };
      set({ inbox: get().inbox.map((q) => (q.id === id ? { ...q, reply } : q)) });
      post({ kind: "reply", from: SELF, id, reply });
    },
    receiveEscalation: (item) => {
      if (get().inbox.some((q) => q.id === item.id)) return;
      set({ inbox: [item, ...get().inbox] });
    },
    receiveReply: (id, reply) => set({ inbox: get().inbox.map((q) => (q.id === id ? { ...q, reply } : q)) }),
    mergeInbox: (items) => {
      const known = new Map(get().inbox.map((q) => [q.id, q]));
      for (const q of items) known.set(q.id, { ...known.get(q.id), ...q, reply: q.reply ?? known.get(q.id)?.reply });
      set({ inbox: [...known.values()].sort((a, b) => b.askedAt.localeCompare(a.askedAt)) });
    },
    receiveMessage: (item) => {
      if (get().messages.some((m) => m.id === item.id)) return;
      set({ messages: [item, ...get().messages].slice(0, 400) });
    },
    mergeMessages: (items) => {
      const known = new Map(get().messages.map((m) => [m.id, m]));
      for (const m of items) known.set(m.id, { ...known.get(m.id), ...m });
      set({ messages: [...known.values()].sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, 400) });
    },
    receiveReceipt: (id, status, at, simulated) =>
      set({ messages: get().messages.map((m) => (m.id === id ? { ...m, ...(status === "delivered" ? { deliveredAt: m.deliveredAt ?? at } : { readAt: m.readAt ?? at, deliveredAt: m.deliveredAt ?? at }), simulated: simulated ?? m.simulated } : m)) }),
    acknowledge: (id, status) => {
      const m = get().messages.find((x) => x.id === id);
      if (!m || (status === "delivered" && m.deliveredAt) || (status === "read" && m.readAt)) return;
      const at = new Date().toISOString();
      get().receiveReceipt(id, status, at);
      post({ kind: "receipt", from: SELF, id, status, at });
    },
  };
});

export const dayOfT = (t: number) => Math.floor(t);
