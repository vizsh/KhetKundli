"use client";

import { create } from "zustand";
import { clampDay, realToday, SEASON_DAYS, TODAY } from "@/lib/sim/calendar";
import { generateSeason } from "@/lib/sim/season";
import { diffSeasons, type Ripple } from "@/lib/sim/selectors";
import type { MarketId, Overrides, Season } from "@/lib/sim/types";
import type { LiveDaily, LiveHourly } from "@/lib/sim/weather";

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
  overrides: Overrides;
  live: LiveDaily[];
  hourly: LiveHourly[];
  liveStatus: LiveStatus;
  season: Season;
  ripple: (Ripple & { at: number }) | null;
  /** Bumped on every local override so the sync bridge knows to broadcast. */
  outbox: { overrides: Overrides; label: string; at: number } | null;
  setDay: (day: number) => void;
  syncToday: () => void;
  setTime: (t: number) => void;
  setPlaying: (playing: boolean) => void;
  setLayer: (layer: Layer) => void;
  selectPlot: (plot: number) => void;
  selectHex: (hex: number | null) => void;
  setWaveWeek: (week: number | null) => void;
  setLive: (days: LiveDaily[], hours: LiveHourly[], status: LiveStatus) => void;
  applyOverrides: (overrides: Overrides, label: string, origin: Origin) => void;
  heroScan: (opts?: { confidence?: number; offline?: boolean }) => void;
  rainTwist: () => void;
  heroHarvest: (shift: number, market: MarketId) => void;
  resetDemo: () => void;
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

  const local = (overrides: Overrides, label: string) => get().applyOverrides(overrides, label, "local");

  return {
    t: TODAY + START_HOUR,
    today: TODAY,
    playing: false,
    layer: "pest",
    selectedPlot: initial.heroPlot,
    selectedHex: null,
    waveWeek: null,
    overrides: {},
    live: [],
    hourly: [],
    liveStatus: "loading",
    season: initial,
    ripple: null,
    outbox: null,
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
    applyOverrides: (overrides, label, origin) => {
      regenerate(overrides, label);
      if (origin === "local") set({ outbox: { overrides, label, at: Date.now() } });
    },
    heroScan: (opts) => {
      const { overrides, season, t } = get();
      const day = Math.floor(t);
      if (overrides.scans?.some((s) => s.plot === season.heroPlot && s.day === day)) return;
      const scans = [...(overrides.scans ?? []), { plot: season.heroPlot, day, confidence: opts?.confidence ?? 0.87, offline: opts?.offline ?? true }];
      local({ ...overrides, scans }, "Leaf scan synced from Sunita's phone");
      set({ selectedPlot: season.heroPlot, layer: "pest" });
    },
    rainTwist: () => {
      const { overrides, t } = get();
      const day = Math.min(SEASON_DAYS - 1, Math.floor(t) + 1);
      local({ ...overrides, rain: { day, mm: 18 } }, "Forecast: 18 mm rain within 18 hours");
    },
    heroHarvest: (shift, market) => {
      const { overrides } = get();
      local({ ...overrides, heroPickShift: shift, heroMarket: market }, `Sunita set her first picking ${shift === 0 ? "as planned" : `${Math.abs(shift)} days ${shift < 0 ? "earlier" : "later"}`}, selling at ${market === "phaltan" ? "Phaltan APMC" : market === "pune" ? "Pune" : "Vashi"}`);
    },
    resetDemo: () => {
      local({}, "Demo reset");
      set({ ripple: null });
    },
  };
});

export const dayOfT = (t: number) => Math.floor(t);
