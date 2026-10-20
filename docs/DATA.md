# Data

## Sources

| Source | What we use | Access | Freshness | Licence | Status |
| --- | --- | --- | --- | --- | --- |
| Open-Meteo archive (`archive-api.open-meteo.com/v1/archive`) | Daily rain, temperature, humidity, wind, ET0; hourly temperature, humidity and rain for leaf-wet hours; Phaltan, 1 June to yesterday | No key; cached hourly in `/api/weather` | Lags a day or two | CC BY 4.0 | **Recorded** |
| Open-Meteo ensemble (`ensemble-api.open-meteo.com/v1/ensemble`) | ECMWF IFS 0.25° ensemble, 51 members: hourly rain, wind, humidity at Phaltan for 4 days | No key; cached hourly in `/api/weather/ensemble` | Model runs | CC BY 4.0 | **Live** |
| Open-Meteo forecast (`api.open-meteo.com/v1/forecast`) | 7 days daily plus hourly at Phaltan; 96 hours hourly at a 3 × 3 grid for wind, rain, humidity, temperature | No key; cached hourly in `/api/weather` and `/api/weather/wind` | Hourly model runs | CC BY 4.0 | **Live** |
| OpenStreetMap (Overpass extracts in `data/raw`) | Taluka boundary (relation 10354585), 23 villages, roads, rivers, canals, railway | Built into `web/src/data/phaltan.json` by `scripts/build-geo.ts` | Frozen at build | ODbL | **Real** |
| Agmarknet via data.gov.in (resource `9ef84268-d588-465a-a308-a864a43d0070`) | Pomegranate modal and min/max prices by market and day | Needs `DATA_GOV_IN_API_KEY` | Daily | Government Open Data Licence – India | **Live** with a key; otherwise the screen says so |
| onnx-community MobileNetV2 plant-disease (PlantVillage) | Scan Lens model, fp32 ONNX | Downloaded on `npm install` | Fixed | Listed as "other": confirm before distribution | **On device** |
| Tesseract English and Marathi LSTM (`@tesseract.js-data/eng`, `/mar`) | Slip OCR; Marathi loaded on demand | Downloaded on `npm install` | Fixed | Apache-2.0 | **On device** |
| Open-Meteo elevation API (Copernicus DEM, 90 m) | Elevation on a 40 × 30 grid and at every H3 cell: contours and low-lying cells | `scripts/build-terrain.ts` → `web/src/data/terrain.json` | Frozen at build | Copernicus DEM licence; CC BY 4.0 (Open-Meteo) | **Real** |
| Sample leaf photos | Three public photos | `web/public/samples` | Fixed | CC BY-SA 4.0 and CC0, credited in `samples.json` | Sample |
| Specimen slips | Two rendered slips with a fictitious agent | `scripts/make-slips.mjs` | Fixed | Ours | **Simulated** |
| Plots, farmers, events | 192 plots in 23 villages, seeded engine | `src/lib/sim` | Deterministic | Ours | **Simulated** |

## How a screen says where a number comes from

Each figure carries a rubber stamp: **Live** (forecast or on-device now), **Recorded** (real past data) or **Simulated**. The forecast panel's stamp follows its frames (live grid, recorded day, simulated day); the weather slip follows the first day shown. Synthetic plot records say so in their headers and footers.

## Schemas

### Weather day (engine)

```ts
type WeatherDay = {
  day: number;          // 0 = 1 June 2026
  rainMm: number; rainProb: number;
  tMax: number; tMin: number; rh: number;
  windKmh: number; windFrom: number;   // daily maximum, dominant direction (degrees, from)
  et0: number;
  wetHours?: number;    // from hourly data on recorded and forecast days
  observed?: boolean;   // recorded (archive)
  live?: boolean;       // from Open-Meteo (recorded or forecast)
};
```

### Ensemble (`/api/weather/ensemble`)

```ts
type Ensemble = {
  model: string;                 // "ECMWF IFS 0.25° ensemble"
  times: string[];               // local ISO hours, 96
  members: { rain: number[]; speed: number[]; from: number[]; rh: number[] }[]; // 51
};
```

### Wind grid (`/api/weather/wind`)

```ts
type WindGrid = {
  points: [lon: number, lat: number][];   // 9, west to east, north to south
  times: string[];                        // local ISO hours, Asia/Kolkata, 96 of them
  speed: number[][]; from: number[][];    // [point][hour], km/h and degrees
  rain: number[][]; rh: number[][]; temp: number[][];
};
```

### Plot event (the record)

```ts
type PlotEvent = { id; plot; day; hour; by: "computed" | "human" | "verified" } & (
  | { type: "bahar"; note }
  | { type: "irrigate"; litres } | { type: "irrigate-skip"; litresSaved; reason }
  | { type: "scan"; finding; confidence; offline }
  | { type: "spray"; product; dose; washedOff; reason }
  | { type: "advisory"; text }
  | { type: "voice"; question; answer }
  | { type: "pick"; picking; crates; grade }
  | { type: "booking"; crates; hub; run; market }
  | { type: "sale"; crates; market; pricePerKg; gross; deductions; net; kg?; grade?; slip? }
);
```

### Overrides (what devices exchange)

```ts
type Overrides = {
  rain?: { day; mm };                                   // demo forecast rain
  scans?: { plot; day; confidence; offline }[];         // from the phone
  heroPickShift?: number; heroMarket?: MarketId;        // the farmer's harvest choice
  slips?: SaleSlip[];                                   // checked sale slips
  advisories?: { day; hexes: number[] }[];              // officer's warnings from the spread forecast
};
```

## Privacy

- **Shared maps aggregate.** The desk shows H3 resolution-7 cells (about 5 km²) and approximate village areas; individual farms are not drawn on shared views. The plot record view is for the farmer and the officer she asks.
- **Photos stay on the phone.** Leaf scans and slip photos are processed in the browser; only the result (a finding with a confidence, or the slip's numbers) enters the record.
- **No personal data in URLs.** Sync messages travel in POST bodies and server-sent events.
- **For the pilot**, the roadmap adds phone-number accounts with explicit, purpose-bound consent under India's Digital Personal Data Protection Act 2023: consent to share the plot's reported scans with the FPO for Pest Radar, separate consent for market data, the right to see and erase one's record, and data held by the FPO as the farmers' own organisation.

## Caveats

- The archive is a **reanalysis** grid of several kilometres, not a station in the orchard; local showers can be missed or smeared.
- The wind grid has nine points across a taluka roughly 60 km wide; valleys and hills are not resolved.
- Agmarknet prices are what markets report; arrivals and modal prices can be revised.
- OCR reads printed English and Marathi labels and Western and Devanagari digits; handwritten amounts and column layouts need the work listed in the roadmap.
