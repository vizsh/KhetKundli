# KhetKundli · खेतकुंडली

**Every plot remembers. Every village sees together.**

KhetKundli gives every pomegranate plot in Phaltan taluka (Satara, Maharashtra) a living season record, its *kundli*, kept on the farmer's phone in Marathi. A taluka desk reads all the records together and shows what no single farmer can see: where bacterial blight is, where the wind will carry it in the next 72 hours, when each village will pick, how much groundwater stays in the ground, and whether a sale slip was fair.

Built by Team Outliers for the Phaltan Hackathon (agriculture track). The season runs on Phaltan's **recorded 2026 weather**, hour by hour, with a live forecast and a live wind field over the taluka; the 192 farmers and their plots are synthetic and labelled so on every screen.

![The taluka desk on 20 October 2026: a demo storm in the 72-hour forecast, the live wind field drawn as rain strokes, and violet stipple where blight could travel](docs/images/desk-storm.jpg)

| Sunita's phone | A sale slip, checked on the phone | Asked in Marathi, answered from her record |
| :---: | :---: | :---: |
| ![The kundli season wheel with the real 2026 monsoon drawn as rain ticks](docs/images/phone-home.jpg) | ![A photographed patti with the overcharges ringed in red pen](docs/images/phone-slip.jpg) | ![Why did my last spray fail? Answered from the plot record](docs/images/phone-ask.jpg) |

## What it does

| For | Feature | What is real |
| --- | --- | --- |
| Farmer | **Kundli wheel**: the whole season on one dial (stage, rain, water, sprays, scans, pickings); drag the dot to move through time | Rain ticks are Phaltan's recorded 2026 weather |
| Farmer | **Today slip**: the one thing to do today, and a 72-hour spray window from the hourly forecast | Live Open-Meteo forecast |
| Farmer | **Scan Lens**: photograph a leaf, get a diagnosis with no signal, see where the model looked | MobileNetV2 in the browser, ~80 ms; pomegranate result is scripted until trained |
| Farmer | **Ask**: Marathi or English voice question answered from her own record, read aloud; anything else goes to the officer | Web Speech API; answers built from the record, never invented |
| Farmer | **Sale slip check**: photograph the agent's patti; every number is read and checked against arithmetic and the agreed rate card | Tesseract OCR on the phone, ~1.2 s |
| Officer | **Pest Radar** with a **live wind field** and a **72-hour spread forecast**: where reported blight can travel, hour by hour, and who to warn | 9-point live wind grid; recorded weather for any past day |
| Officer | **Warn downwind**: one tap sends a preventive advisory to the plots in the plume, by app or SMS, and the season re-plans | Simulated outcome, shown as a ripple |
| Officer | **Harvest Wave**, **Water Commons**, **Pooled Runs**, daily register, inbox, plot records | Simulated network |
| Everyone | **Season time machine**: one clock for every screen; replay the season on either device | Two devices stay in step over Wi-Fi |

## How it fits together

```mermaid
flowchart LR
  OM[(Open-Meteo<br/>archive, forecast, wind)]
  OSM[(OpenStreetMap<br/>Phaltan taluka)]
  subgraph Server["Next.js 16 server"]
    WX["/api/weather<br/>season recorded + 7-day forecast"]
    WD["/api/weather/wind<br/>9-point hourly grid"]
    PR["/api/prices<br/>Agmarknet, with a key"]
    SY["/api/sync<br/>SSE relay"]
  end
  subgraph Browser["Every browser runs the same engine"]
    GEN["generateSeason()<br/>blight, water, harvest, markets, runs"]
    SP["spreadForecast()<br/>72 h of wind-driven rain splash"]
  end
  subgraph Phone["Farmer phone /farmer"]
    W[Kundli wheel]
    SL[Scan Lens<br/>ONNX Runtime Web]
    OCR[Slip check<br/>Tesseract.js]
    ASK[Ask<br/>Web Speech mr-IN]
  end
  subgraph Desk["Taluka desk /desk"]
    MAP[Survey map<br/>Pest Radar, Wave, Water, Runs]
    INB[Register and inbox]
  end
  OM --> WX & WD
  OSM --> GEO[build-geo.ts] --> GEN
  WX --> GEN --> SP
  WD --> SP
  GEN --> Phone & Desk
  SP --> MAP
  Phone <-->|overrides, clock, questions| SY <--> Desk
```

A scan, a demo rain, a picking date, an officer's advisory or a sale slip is an **override**. Every screen regenerates the season from the same seed, recorded weather and overrides, and `diffSeasons` writes what changed as a ripple:

```mermaid
sequenceDiagram
  autonumber
  actor S as Sunita (no signal)
  participant P as Phone
  participant R as /api/sync
  participant D as Taluka desk
  S->>P: Photographs a spotted leaf
  P->>P: Scan Lens on the device, saved to her record
  P-->>R: overrides { scans } when signal returns
  R-->>D: server-sent event
  D->>D: generateSeason(seed, recorded weather, overrides)
  D->>D: diffSeasons(before, after) → ripple
  Note over D: Spray set for the first dry morning · neighbours warned<br/>radar redrawn · her harvest grade B, not C
```

## Run it

```bash
cd web
npm install          # also fetches the leaf model, the OCR model, and the ONNX Runtime and Tesseract WebAssembly files
npm run dev          # http://localhost:3000 (pitch), /farmer and /desk
```

```bash
npm run smoke        # 14 end-to-end checks in Chrome (dev server running)
npm run test:slips   # reads both specimen slips in Node and checks the parser
```

For a real phone, run `npm run dev -- -H 0.0.0.0` and open `http://<laptop-ip>:3000/farmer` on the same Wi-Fi. For live mandi prices, copy `web/.env.example` to `web/.env.local` and add a data.gov.in key. The full demo script is in [docs/DEMO.md](docs/DEMO.md).

## Documentation

| Document | What it covers |
| --- | --- |
| [docs/PROBLEM.md](docs/PROBLEM.md) | Phaltan, pomegranate and the problems; the six problem statements and how one record answers them |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data model, the sync protocol, offline, performance and tests, with diagrams |
| [docs/MODELS.md](docs/MODELS.md) | The engine's models: blight, spread forecast, water, harvest, markets, runs, Scan Lens, slip check, voice |
| [docs/DATA.md](docs/DATA.md) | Every data source, schemas, live versus recorded versus simulated, privacy |
| [docs/EXPERIENCE.md](docs/EXPERIENCE.md) | The "Living Record" design world, surfaces, motion, Marathi, accessibility |
| [docs/ROADMAP.md](docs/ROADMAP.md) | From the demo to a pilot to the taluka: features, technical designs, data, metrics, risks |
| [docs/DEMO.md](docs/DEMO.md) | The seven-minute demo, two-device setup and fallbacks |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | Bahar, telya, patti, adat, gat, H3 and the rest |
| [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md) | Product record and design system |

## Live, recorded, simulated

| Source | Status on screen |
| --- | --- |
| Phaltan weather, 1 June to yesterday (hourly, with leaf-wetness hours) | **Recorded**: Open-Meteo archive |
| Next 7 days of weather; 72-hour hourly forecast; 9-point wind grid | **Live**: Open-Meteo forecast |
| Taluka boundary, villages, roads, rivers, canals, rail | **Real**: OpenStreetMap |
| Tomato and capsicum leaf scans; sale slip reading | **Live** inference on the device |
| 192 farmers, plots, sprays, scans, pickings, sales; mandi prices without a key; the two specimen slips | **Simulated**, labelled synthetic |

## Roadmap at a glance

```mermaid
flowchart LR
  H0["<b>Now · demo</b><br/>Oct 2026<br/>recorded weather, live wind,<br/>spread forecast, slip check"]
  H1["<b>Pilot</b><br/>Ambia bahar 2027<br/>one FPO, three villages<br/>accounts, offline sync, IVR,<br/>pomegranate Scan Lens"]
  H2["<b>Taluka</b><br/>Mrig 2027 to 2028<br/>Sentinel-2 plot health,<br/>groundwater, glut warning,<br/>run optimiser, export record"]
  H3["<b>Platform</b><br/>2028 onward<br/>other pomegranate talukas,<br/>more crops, open data"]
  H0 --> H1 --> H2 --> H3
```

Details, technical designs and measures of success are in [docs/ROADMAP.md](docs/ROADMAP.md).

## Repository

```
web/                 Next.js 16 app (TypeScript, Tailwind v4, shadcn, Motion, React Bits, D3, h3-js)
  src/lib/sim/       season engine: weather, blight, water, harvest, markets, runs
  src/lib/spread.ts  72-hour spread forecast
  src/lib/patti.ts   sale slip parser and checks
  src/app/api/       weather, wind, prices, sync
  scripts/           geo build, smoke test, slip test, captures
ml/                  training pipeline for Scan Lens on field photos
data/raw/            OpenStreetMap extracts for Phaltan taluka (ODbL)
docs/                the documents above, and screenshots
```

Map data © OpenStreetMap contributors (ODbL). Weather data by Open-Meteo (CC BY 4.0). Sample leaf photos credited in `web/public/samples/samples.json`. OCR by Tesseract.js (Apache-2.0).
