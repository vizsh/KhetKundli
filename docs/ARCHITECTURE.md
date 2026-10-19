# KhetKundli: architecture and build plan

Phaltan Hackathon, agriculture track. Team Outliers. Status as of 20 Oct 2026, second push.

## The idea in one line

Every pomegranate plot keeps a living season record (the plot's "kundli"); combining the records reveals what no single farmer can see: blight fronts (Pest Radar), village harvest timing (Harvest Wave) and the shared water table (Water Commons). Pooled transport is planned days ahead because crop stage on every plot predicts when each village will pick.

## What is built

| Piece | Where | State |
| --- | --- | --- |
| Real Phaltan geography | `data/raw/*.json` → `web/scripts/build-geo.ts` → `web/src/data/phaltan.json` | OpenStreetMap boundary (relation 10354585), 23 villages, Nira river and canals, NH160/NH965, rail, 244 H3 cells (res 7), pooled-run routes by Dijkstra on the real road graph |
| Season simulation | `web/src/lib/sim/` | Deterministic, ~130 ms: 192 plots, weather, wind- and humidity-driven blight, scans, sprays, irrigation, prices for Phaltan/Pune/Vashi, pickings, bookings, sales, ~980 pooled runs. Per-plot hashed randomness keeps injected events causal |
| Event-sourced plot record | `season.eventsByPlot` | Every module writes events with provenance: computed (typed), human (ballpoint), verified (stamp) |
| Taluka Desk `/desk` | `web/src/components/desk/` | Survey map with four layers, rolling-band date stamp, poster figure per layer, Harvest Wave chart, daily register with ripple slip, plot record, village ledger, demo inputs |
| Farmer phone `/farmer` | `web/src/components/farmer/` | Kundli season wheel (drag to scrub, English and Marathi month rim), today's single action, live 72-hour spray ribbon, Scan Lens, voice Ask, picking date strip and market ledger, passbook with Marathi twin lines, sale-slip check and waterfall |
| Sale slip check | `web/src/lib/ocr.ts`, `web/src/lib/patti.ts`, `slip-check.tsx` | Photograph the agent's patti; Tesseract.js (English LSTM, 3 MB, served from `/tesseract`) reads it on the phone in about a second. The parser pulls crates, weight, rate, gross, each deduction, total and net; every number is checked by arithmetic and against the pooled-run rate card (6% commission, ₹5 hamali, ₹1 weighment, the run's freight per crate). Red pen rings mark the lines to question; the farmer corrects any number in ballpoint, files the sale into her record, and can send the dispute to the officer's inbox |
| Scan Lens (on device) | `web/public/workers/scan-lens.js`, `web/src/lib/scan.ts` | MobileNetV2 (PlantVillage, 38 classes) in ONNX Runtime Web, fp32, ~80 ms per leaf, crop-conditioned, occlusion heatmap; runs with no network |
| Voice Ask | `web/src/lib/voice.ts`, `ask-sheet.tsx` | Web Speech API (mr-IN) or typed; intent from Marathi/English keywords; answers built from the plot record, in Marathi and English, read aloud; unknown questions hand off to the extension officer |
| Phone ↔ desk sync | `web/src/lib/sync.tsx`, `web/src/lib/channel.ts`, `/api/sync` | Two transports for one message stream: BroadcastChannel between windows on one device, and a server-sent-events relay for a real phone and laptop on the same network. The relay keeps the latest overrides, clock and inbox in the server process and replays them to a device that joins late |
| Officer inbox | `web/src/components/desk/inbox.tsx` | Questions the app cannot answer from the record, and sale-slip disputes, arrive with the plot's recent entries; the officer replies in one tap or types, and the reply lands in the farmer's Ask sheet |
| Live weather | `/api/weather` | Open-Meteo daily (7 days) and hourly (spray ribbon), cached hourly |
| Mandi prices | `/api/prices` | Agmarknet via data.gov.in when `DATA_GOV_IN_API_KEY` is set; otherwise says so |
| Offline | `web/public/sw.js` | Service worker (production builds) caches the phone, model and runtime |
| Training pipeline | `ml/train.py` | Fine-tunes the Scan Lens model on field photos, reports per-class field accuracy, exports fp32 ONNX (browser) and INT8 (Snapdragon NPU) |
| Pitch surface `/` | `web/src/components/pitch/` | Hero, then the season told in seven scroll chapters that drive the same engine (wheel, Pest Radar, the washed-off spray answer, a live-computed ripple, the harvest wave, pooled runs and the sale slip, the season's ledger), the six source problem statements, and an honest ledger of live versus simulated |

## How the pieces fit

```
OpenStreetMap ──► build-geo.ts ──► phaltan.json ─┐
                                                  ├─► generateSeason(seed, overrides, live) ─► Season
Open-Meteo ──► /api/weather (cached) ─────────────┘          │
                                                             ▼
                        zustand store: one clock t (day + hour), overrides, selection
                         │                                   │
     BroadcastChannel + /api/sync SSE relay           every view derives from season at floor(t)
                         │                                   │
        ┌────────────────┴───────────┐        ┌──────────────┴───────────────┐
   Farmer phone (/farmer)       Taluka Desk (/desk)   map · registers · records · charts
   scan → override ──────────► ripple slip
   slip photo → OCR → checks → sale override ──► ripple + register line
   question or dispute ──────► inbox ──► reply ──► Ask sheet
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
| Sale slip reading | LIVE on-device OCR and checks; the two specimen slips and their agent are made up for the demo; the rate card is the demo's (it matches the season engine's rules) |

## Honest numbers for judges

- Scan Lens base model: 95.4% on PlantVillage lab photos (model card). On three public field photos it misread two diseases. That gap is the reason for `ml/train.py`: retrain on field photos (Phaltan pomegranate, plus PlantDoc for tomato and pepper) and report the per-class field accuracy it writes to `metrics.json`.
- Browser inference uses the fp32 model: ONNX Runtime Web ran it in 141 ms (single) and 56 ms per image in a batch of 7, against 775 ms for the INT8 build. INT8 is the format for the Snapdragon NPU path through Qualcomm AI Hub.
- Slip reader: about 1.2 s per slip in the browser and 90% mean OCR confidence on the specimens, with every number read correctly. It reads computer-printed slips with English labels; Marathi labels need Tesseract's `mar` model, and handwritten pattis are out of reach for now. Numbers the OCR was unsure of are underlined for the farmer to check, never silently trusted.

## Run it

```
cd web
npm install                      # also copies ONNX Runtime's wasm into public/ort
npm run dev                      # http://localhost:3000/desk and /farmer
node scripts/smoke.mjs           # end-to-end: scans, voice answer, ripple, relay escalation and reply, slip check
npm run test:slips               # OCR both specimen slips in Node; checks the parser and the rate-card checks
node scripts/make-slips.mjs      # re-render the specimen slips
node scripts/capture-pitch.mjs <outDir> [w] [h] [--mobile]             # the pitch page at points through the story
npm run build:geo                # rebuild map data from data/raw
npx tsx --tsconfig tsconfig.json scripts/simtest.ts   # engine checks, incl. causal isolation
node scripts/capture.mjs <url> <out.png> <w> <h> [--full] [--mobile]   # review screenshots
node scripts/capture-sheets.mjs <outDir>                               # Scan Lens and Ask in action
```

Two-window demo on one laptop: open `/desk` and `/farmer` side by side (narrow window for the phone). The pitch page's "Open Sunita's phone" button opens the phone in a popup.

Two-device demo: run `npm run dev -- -H 0.0.0.0` (or `npm start` after a build) on the laptop, open `http://<laptop-ip>:3000/farmer` on a phone on the same Wi-Fi and `/desk` on the laptop; both join the relay. The slip reader's Camera button uses the phone's camera app and works over plain HTTP; Scan Lens's live viewfinder needs HTTPS (`next dev --experimental-https`) and otherwise falls back to the camera app. The relay lives in one server process, so use `next dev` or `next start`, not a multi-instance serverless deploy. Reset on the desk clears every screen and the relay.

Offline demo: `npm run build && npm start`, open `/farmer` once online (and read one slip, so the OCR core is cached), then switch to airplane mode and scan.

## Build plan (remaining week)

Done since the first push: the pitch surface, the two-device relay, the officer inbox and the sale slip check.

1. **Pomegranate photos.** Collect 50–100 per class from Phaltan orchards (bacterial blight, healthy, plus anthracnose if available), split train/val, run `ml/train.py`, point Scan Lens at the new model and replace the scripted result.
2. **Real pattis.** Photograph five to ten real slips from Phaltan adat shops (with the farmers' consent, names blurred), tune the parser's label keywords, and add Tesseract's `mar` model if the labels are in Marathi.
3. **The FPO's rate card.** Replace the demo rate card with the one the FPO agrees with its agents, per market.
4. **Rehearse** "one leaf, one season, one sale" on a real phone over the venue Wi-Fi, and record a backup video.

## Open items

- 22 Marathi village names are best-effort transliterations (`mrVerified: false` in `phaltan.json`); verify locally.
- Spray doses in `rules.ts` must be checked against current ICAR-NRCP guidance and product labels.
- The base model's licence on Hugging Face is listed as "other"; confirm before distributing it beyond the demo. Sample leaf photos are credited in `web/public/samples/samples.json`.
- Dev server quirk: if a new Tailwind class does not appear, restart `npm run dev`.
- The relay is a demo transport: no authentication and in-memory state. A real deployment needs accounts, a database for the inbox, and a hosted realtime channel.
- The slip check compares against an agreed rate card, not the law. It tells the farmer what to ask about; it never calls a charge illegal.
- `npx motion-ai` (Motion's AI kit) is interactive; run it in a terminal. The shadcn MCP server in `.mcp.json` activates after restarting Claude Code in this folder.
