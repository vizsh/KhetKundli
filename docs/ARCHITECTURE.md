# KhetKundli: architecture and build plan

Phaltan Hackathon, agriculture track. Team Outliers. Status as of 20 Oct 2026.

## The idea in one line

Every pomegranate plot keeps a living season record (the plot's "kundli"); combining the records reveals what no single farmer can see: blight fronts (Pest Radar), village harvest timing (Harvest Wave) and the shared water table (Water Commons). Pooled transport is planned days ahead because crop stage on every plot predicts when each village will pick.

## What is built

| Piece | Where | State |
| --- | --- | --- |
| Real Phaltan geography | `data/raw/*.json` → `web/scripts/build-geo.ts` → `web/src/data/phaltan.json` | OpenStreetMap boundary (relation 10354585), 23 villages, Nira river and canals, NH160/NH965, rail, 244 H3 cells (res 7), pooled-run routes by Dijkstra on the real road graph |
| Season simulation | `web/src/lib/sim/` | Deterministic, ~130 ms: 192 plots, weather, wind- and humidity-driven blight, scans, sprays, irrigation, prices for Phaltan/Pune/Vashi, pickings, bookings, sales, ~980 pooled runs. Per-plot hashed randomness keeps injected events causal |
| Event-sourced plot record | `season.eventsByPlot` | Every module writes events with provenance: computed (typed), human (ballpoint), verified (stamp) |
| Taluka Desk `/desk` | `web/src/components/desk/` | Survey map with four layers, rolling-band date stamp, poster figure per layer, Harvest Wave chart, daily register with ripple slip, plot record, village ledger, demo inputs |
| Farmer phone `/farmer` | `web/src/components/farmer/` | Kundli season wheel (drag to scrub, English and Marathi month rim), today's single action, live 72-hour spray ribbon, Scan Lens, voice Ask, picking date strip and market ledger, passbook with Marathi twin lines and sale-slip waterfall |
| Scan Lens (on device) | `web/public/workers/scan-lens.js`, `web/src/lib/scan.ts` | MobileNetV2 (PlantVillage, 38 classes) in ONNX Runtime Web, fp32, ~80 ms per leaf, crop-conditioned, occlusion heatmap; runs with no network |
| Voice Ask | `web/src/lib/voice.ts`, `ask-sheet.tsx` | Web Speech API (mr-IN) or typed; intent from Marathi/English keywords; answers built from the plot record, in Marathi and English, read aloud; unknown questions hand off to the extension officer |
| Phone ↔ desk sync | `web/src/lib/sync.tsx` | BroadcastChannel between windows on one device: overrides and the season clock |
| Live weather | `/api/weather` | Open-Meteo daily (7 days) and hourly (spray ribbon), cached hourly |
| Mandi prices | `/api/prices` | Agmarknet via data.gov.in when `DATA_GOV_IN_API_KEY` is set; otherwise says so |
| Offline | `web/public/sw.js` | Service worker (production builds) caches the phone, model and runtime |
| Training pipeline | `ml/train.py` | Fine-tunes the Scan Lens model on field photos, reports per-class field accuracy, exports fp32 ONNX (browser) and INT8 (Snapdragon NPU) |
| Pitch surface `/` | `web/src/app/page.tsx` | Placeholder index; next |

## How the pieces fit

```
OpenStreetMap ──► build-geo.ts ──► phaltan.json ─┐
                                                  ├─► generateSeason(seed, overrides, live) ─► Season
Open-Meteo ──► /api/weather (cached) ─────────────┘          │
                                                             ▼
                        zustand store: one clock t (day + hour), overrides, selection
                         │                                   │
              BroadcastChannel sync                    every view derives from season at floor(t)
                         │                                   │
        ┌────────────────┴───────────┐        ┌──────────────┴───────────────┐
   Farmer phone (/farmer)       Taluka Desk (/desk)   map · registers · records · charts
   scan → override ──────────► ripple slip
```

- **One clock.** The desk's date stamp, its season track and the phone's wheel all move the same `t`; with two windows open they move together. On load the clock rolls to the device's real date (clamped to the 1 Jun 2026 to 31 Jan 2027 season), so today's weather is always the live forecast.
- **Overrides, not mutations.** A scan, a rain forecast or a picking-date change is an override; the season regenerates and `diffSeasons` writes the ripple.
- **Doses only from rules.** `rules.ts` holds the pomegranate spray table; tomato and capsicum advice gives categories with "label dose", never a number the app made up.
- **Privacy.** Shared maps show H3 cells and approximate village areas only.

## Live vs simulated (stamped on screen)

| Source | Status |
| --- | --- |
| Weather, ET0, hourly spray window | LIVE (Open-Meteo) for the next 7 days; synthetic climatology elsewhere |
| Geography | Real (OSM); village areas approximate (Voronoi) |
| Tomato and capsicum scans | LIVE on-device inference; field accuracy is poor until retrained (see below) |
| Pomegranate scan result | SIMULATED (scripted) until a pomegranate model is trained |
| Plots, farmers, sprays, harvests, runs | SIMULATED, labelled synthetic |
| Mandi prices | SIMULATED until `DATA_GOV_IN_API_KEY` is set, then today's modal price is shown LIVE |

## Honest numbers for judges

- Scan Lens base model: 95.4% on PlantVillage lab photos (model card). On three public field photos it misread two diseases. That gap is the reason for `ml/train.py`: retrain on field photos (Phaltan pomegranate, plus PlantDoc for tomato and pepper) and report the per-class field accuracy it writes to `metrics.json`.
- Browser inference uses the fp32 model: ONNX Runtime Web ran it in 141 ms (single) and 56 ms per image in a batch of 7, against 775 ms for the INT8 build. INT8 is the format for the Snapdragon NPU path through Qualcomm AI Hub.

## Run it

```
cd web
npm install                      # also copies ONNX Runtime's wasm into public/ort
npm run dev                      # http://localhost:3000/desk and /farmer
node scripts/smoke.mjs           # end-to-end: scans, voice answer, phone-to-desk ripple
npm run build:geo                # rebuild map data from data/raw
npx tsx --tsconfig tsconfig.json scripts/simtest.ts   # engine checks, incl. causal isolation
node scripts/capture.mjs <url> <out.png> <w> <h> [--full] [--mobile]   # review screenshots
node scripts/capture-sheets.mjs <outDir>                               # Scan Lens and Ask in action
```

Two-window demo on one laptop: open `/desk` and `/farmer` side by side (narrow window for the phone). Offline demo: `npm run build && npm start`, open `/farmer` once online, then switch to airplane mode and scan.

## Build plan (remaining week)

1. **Pomegranate photos.** Collect 50–100 per class from Phaltan orchards (bacterial blight, healthy, plus anthracnose if available), split train/val, run `ml/train.py`, point Scan Lens at the new model and replace the scripted result.
2. **Two-device sync.** BroadcastChannel only links windows on one device. For phone plus laptop, add a small relay (an SSE route with in-memory state, or a hosted realtime channel).
3. **Pitch surface `/`.** The season told as the file being opened, ending on the live desk.
4. **Auction slip OCR.** Tesseract.js on a photographed patti feeding the sale event and the waterfall.
5. **Rehearse** "one leaf, one season, one sale" and record a backup video.

## Open items

- 22 Marathi village names are best-effort transliterations (`mrVerified: false` in `phaltan.json`); verify locally.
- Spray doses in `rules.ts` must be checked against current ICAR-NRCP guidance and product labels.
- The base model's licence on Hugging Face is listed as "other"; confirm before distributing it beyond the demo. Sample leaf photos are credited in `web/public/samples/samples.json`.
- Dev server quirk: if a new Tailwind class does not appear, restart `npm run dev`.
- `npx motion-ai` (Motion's AI kit) is interactive; run it in a terminal. The shadcn MCP server in `.mcp.json` activates after restarting Claude Code in this folder.
