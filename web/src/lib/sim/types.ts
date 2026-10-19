export type LonLat = [number, number];

/** Who wrote an entry decides its ink: typed (system), ballpoint (a person), stamp (verified). */
export type Provenance = "computed" | "human" | "verified";

export type Stage = "rest" | "bahar" | "flowering" | "fruitset" | "development" | "maturity" | "harvest" | "done";

export type Farmer = { name: string; mr: string; woman: boolean; usesApp: boolean };

export type Plot = {
  id: string;
  gat: number;
  village: number;
  hex: number;
  at: LonLat;
  acres: number;
  drip: boolean;
  soil: "medium black" | "shallow murrum" | "deep black";
  farmer: Farmer;
  baharStart: number;
  harvestStart: number;
  expectedTonnes: number;
};

export type WeatherDay = {
  day: number;
  rainMm: number;
  rainProb: number;
  tMax: number;
  tMin: number;
  rh: number;
  windKmh: number;
  windFrom: number;
  et0: number;
  live?: boolean;
};

type EventBase = { id: string; plot: number; day: number; hour: number; by: Provenance };

export type PlotEvent = EventBase &
  (
    | { type: "bahar"; note: string }
    | { type: "irrigate"; litres: number }
    | { type: "irrigate-skip"; litresSaved: number; reason: string }
    | { type: "scan"; finding: "bacterial-blight" | "healthy" | "anthracnose"; confidence: number; offline: boolean }
    | { type: "spray"; product: string; dose: string; washedOff: boolean; reason: string }
    | { type: "advisory"; text: string }
    | { type: "voice"; question: string; answer: string }
    | { type: "pick"; picking: number; crates: number; grade: "A" | "B" | "C" }
    | { type: "booking"; crates: number; hub: string; run: string; market: MarketId }
    | { type: "sale"; crates: number; market: MarketId; pricePerKg: number; gross: number; deductions: Deduction[]; net: number; kg?: number; grade?: "A" | "B" | "C"; slip?: SlipMark }
  );

export type PlotEventType = PlotEvent["type"];

/** `card` is the amount the agreed rate card allows, when the sale came from a checked slip. */
export type Deduction = { label: string; amount: number; card?: number };

/** A sale that came from a slip the farmer photographed and checked on the phone. */
export type SlipMark = { pattiNo?: string; agent?: string; aboveCard: number; flags: string[] };

/** What a checked sale slip (patti) files into the record. */
export type SaleSlip = SlipMark & {
  id: string;
  plot: number;
  day: number;
  market: MarketId;
  crates: number;
  kg: number;
  grade: "A" | "B" | "C";
  pricePerKg: number;
  gross: number;
  deductions: Deduction[];
  net: number;
};

export type MarketId = "phaltan" | "pune" | "vashi";

export type Market = { id: MarketId; name: string; mr: string; km: number; freightPerCrate: number; commission: number };

export type Run = {
  id: string;
  hub: string;
  day: number;
  departHour: number;
  crates: number;
  capacity: number;
  vehicle: string;
  plots: number[];
  km: number;
};

export type RiskLevel = 0 | 1 | 2 | 3;

export type Season = {
  plots: Plot[];
  weather: WeatherDay[];
  events: PlotEvent[];
  eventsByDay: PlotEvent[][];
  eventsByPlot: PlotEvent[][];
  hexRisk: Uint8Array[]; // [day][hex] RiskLevel
  hexScore: Float32Array[]; // [day][hex]
  hexDetections: Uint8Array[]; // [day][hex] detections reported in the last 14 days
  infected: Uint8Array[]; // [day][plot] 0 healthy, 1 latent, 2 symptomatic, 3 treated
  harvestByWeek: number[][]; // [week][village] crates
  prices: Record<MarketId, number[]>; // ₹/kg grade A modal, by day
  arrivals: Record<MarketId, number[]>; // tonnes/day
  runs: Run[];
  runsByDay: Run[][];
  waterSavedByDay: number[]; // litres, cumulative
  forecastIrrigationShare: number[]; // share of app users skipping on forecast, by day
  heroPlot: number;
};

export type Overrides = {
  /** A forecast rain event injected for the demo twist. */
  rain?: { day: number; mm: number };
  /** A live scan injected from the farmer phone. */
  scans?: { plot: number; day: number; confidence: number; offline: boolean }[];
  /** Hero farmer chooses an earlier picking date on Harvest Wave. */
  heroPickShift?: number;
  /** Hero farmer's market choice. */
  heroMarket?: MarketId;
  /** Sale slips read on a phone; each replaces the simulated sale it matches. */
  slips?: SaleSlip[];
};
