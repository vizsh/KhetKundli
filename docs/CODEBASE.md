# Codebase guide

A guided tour of the repository for someone about to change it: where each thing lives, how a request flows through, the conventions to keep, and step-by-step recipes for the changes people make most. Status: 3 November 2026, commit `cd40d62`. For the system design itself see [ARCHITECTURE.md](ARCHITECTURE.md); for the background see [CONTEXT.md](CONTEXT.md).

---

## 1. The repository at a glance

```
KhetKundli/
├─ README.md, PRODUCT.md, DESIGN.md     product record, design system
├─ .impeccable/                          design contracts per surface (phone, desk, pitch)
├─ .claude/launch.json                   dev server for the Claude desktop preview
├─ data/raw/                             OpenStreetMap extracts for Phaltan taluka (ODbL), fetch.sh
├─ docs/                                 everything written down (this file, CONTEXT, GAPS, PRODUCT-PLAN …)
│  ├─ data/                              measured results: backtest, router-eval, agent-eval, season-stats
│  ├─ images/                            screenshots used by the README
│  └─ report/                            figures and frames for the Word/PDF report
├─ ml/                                   Python, offline only
│  ├─ train.py                           generic Scan Lens fine-tune on field photos (folder per class)
│  ├─ scanlens/train_pomegranate.py      the pomegranate model actually shipped (MobileNetV3, CUDA)
│  ├─ scanlens/samples.py                picks held-out sample photos for the app
│  └─ router/train.py                    the question router (TF-IDF + embeddings → JSON)
└─ web/                                  the one Next.js 16 app (TypeScript, Tailwind v4, shadcn, Motion, D3, h3-js, zustand)
   ├─ public/models/                     ONNX models + configs + metrics (pomegranate, plant-disease)
   ├─ public/workers/scan-lens.js        module worker running ONNX Runtime Web
   ├─ public/samples/                    sample leaves, fruit, slips (credited in samples.json, slips.json)
   ├─ public/sw.js                       service worker (production builds only)
   ├─ scripts/                           build, test, capture, demo and report scripts
   └─ src/
      ├─ app/                            pages and route handlers
      ├─ components/                     farmer/, desk/, pitch/, lot/, record/ (shared "paper" primitives), ui/ (shadcn)
      ├─ data/                           generated JSON: geography, terrain, router model and embeddings, KB index
      └─ lib/                            engine, sync, agent, server, on-device helpers
```

## 2. Pages and routes

| Path | File | What it is |
| --- | --- | --- |
| `/` | `app/page.tsx` → `components/pitch/*` | The pitch: a scroll-driven season story on the live engine |
| `/farmer` | `app/farmer/page.tsx` → `components/farmer/phone.tsx` | Sunita's phone |
| `/desk` | `app/desk/page.tsx` → `components/desk/desk.tsx` | The taluka desk |
| `/lot/[id]` | `app/lot/[id]/page.tsx` → `components/lot/lot-passport.tsx` | A buyer's page for one picking, e.g. `/lot/TAR-214-P1` |
| `/status` | `app/status/page.tsx` → `components/status-board.tsx` | Models, database, snapshot, connected screens |
| `GET /api/weather` | `app/api/weather/route.ts` | Recorded season + 7-day forecast, cached hourly, snapshot fallback |
| `GET /api/weather/wind` | `app/api/weather/wind/route.ts` | 3 × 3 hourly wind grid, 96 h |
| `GET /api/weather/ensemble` | `app/api/weather/ensemble/route.ts` | 51-member ECMWF ensemble at Phaltan |
| `GET /api/prices` | `app/api/prices/route.ts` | Agmarknet via data.gov.in when `DATA_GOV_IN_API_KEY` is set |
| `GET, POST /api/sync` | `app/api/sync/route.ts` | The relay: POST a message, GET a server-sent event stream |
| `GET, POST /api/messages` | `app/api/messages/route.ts` | Send an approved advisory batch; gateway simulator for receipts |
| `POST /api/agent/ask` | `app/api/agent/ask/route.ts` | The Ask pipeline, streamed as server-sent events |
| `POST /api/agent/advisories` | `app/api/agent/advisories/route.ts` | Prepare an advisory batch (sends nothing) |
| `GET /api/agent/health` | `app/api/agent/health/route.ts` | Ollama and models |
| `GET /api/status` | `app/api/status/route.ts` | Feeds `/status` |

## 3. The library, file by file

### `lib/sim/`: the season engine (pure, runs in the browser and on the server)

| File | Responsibility |
| --- | --- |
| `types.ts` | Every engine type: `Plot`, `PlotEvent` (with `by` provenance and `logged`), `WeatherDay`, `Season`, `Overrides`, `FarmerEntry` |
| `season.ts` | `generateSeason({ seed, overrides, live })`: weather merge → plots → blight spread day by day (scans, advisories, logged sprays, the spray queue) → irrigation → markets → pickings, bookings, sales, runs → event index → Pest Radar |
| `rules.ts` | **The spray table** (`SPRAYS`), the export interval, crop coefficients, stages, `sprayable`, `firstSprayWindow`, `blightFavour`, market charges |
| `selectors.ts` | Read-only views: risk counts, harvest weeks, `stageOf`, `blightStatus`, the register, and `diffSeasons` / `loggedSince` (the ripple) |
| `weather.ts` | Synthetic Phaltan climatology and the `LiveDaily`/`LiveHourly` types |
| `calendar.ts` | Day 0 = 1 June 2026, 245 days; `fmtDay`, `dayOf`, `realToday`, `weekOf` |
| `rng.ts` | Seeded RNG and `hash01(seed, a, b, salt)` for causal isolation |
| `people.ts` | Synthetic names and the hero, Sunita |

### `lib/`: client state, sync, on-device work

| File | Responsibility |
| --- | --- |
| `store.ts` | The zustand store: clock `t`, overrides, season, ripple, inbox, messages, wind, ensemble; every action that changes the season (`heroScan`, `logEntry`, `fileSlip`, `warnCells`, …) goes through `applyOverrides` |
| `sync.tsx` | `SyncBridge`: applies messages from other windows and devices to the store |
| `channel.ts` | The sync message types (`SyncMsg`, `Escalation`, `FarmMessage`) and `post()` over BroadcastChannel + the outbox |
| `outbox.ts` | IndexedDB outbox, hybrid logical clocks, retry on `online` and every 8 s |
| `spread.ts` | The 72-hour spread forecast, storm brush and ensemble runs |
| `farmer.ts` | Phone helpers: Devanagari digits, `todayAction`, the spray ribbon |
| `lot.ts` | Lot passports and the 60-day copper export check |
| `patti.ts`, `ocr.ts` | Sale slip parsing and checks; Tesseract workers |
| `scan.ts` | Image preprocessing and the photo check for Scan Lens |
| `voice.ts` | Rules-based answers (the fallback when the model server is down) and Web Speech helpers |
| `deliver.ts` | Client calls to prepare and send advisory batches |
| `geo.ts` | Geography: villages, H3 cells, routes, distance and bearing |
| `share-card.ts` | Draws the season card to a canvas |

### `lib/agent/`: the reasoning backend (server only)

| File | Responsibility |
| --- | --- |
| `agent.ts` | The five-stage Ask pipeline: route → evidence → plan → compose → guard, each traced |
| `router.ts` | The trained router (exact TS port of scikit-learn's `char_wb` TF-IDF) + embedding model; language detection |
| `tools.ts` | Twelve tools over the season; `describeEvent` turns a record entry into a citable fact |
| `guard.ts` | Deterministic checks: banned chemicals, doses and products only from the table, every date and number in the evidence |
| `llm.ts` | Ollama client (chat with tools, structured output, embeddings) |
| `kb.ts` | Retrieval over `src/data/kb-index.json` |
| `pipelines.ts` | The evening advisory batch: who to warn, channel, English and Marathi SMS |
| `season-server.ts` | `seasonFor(origin, overrides)`: the engine on the server, cached by inputs |
| `warm.ts` | Loads both models at start-up |

### `lib/server/`: persistence (server only)

| File | Responsibility |
| --- | --- |
| `db.ts` | SQLite via `node:sqlite`: `kv`, `events`, `messages`, `agent_log`, `snapshots` |
| `relay.ts` | `accept(msg)`: dedupe by clock, keep latest overrides, inbox, receipts, reset; `broadcast`; `snapshot` |
| `agent-log.ts` | Writes every agent answer |
| `snapshot.ts` | Saves and serves weather snapshots for offline mode |

## 4. How a change travels (the farmer logs a spray)

```mermaid
sequenceDiagram
  participant UI as log-work.tsx
  participant S as store.ts
  participant E as season.ts
  participant O as outbox.ts
  participant R as /api/sync (relay.ts)
  participant D as Desk (sync.tsx → store)
  participant A as /api/agent/ask
  UI->>S: logEntry({plot, day, hour, kind: "spray", spray})
  S->>E: generateSeason({overrides + entry, live})
  E-->>S: new season
  S->>S: diffSeasons(before, after) → ripple ("What changed")
  S->>O: post {kind: "overrides", overrides, label, hlc}
  O->>R: POST when online (retries offline)
  R->>R: validEntry() each entry · appendEvent(hlc) · keep newest overrides
  R-->>D: server-sent event
  D->>E: regenerate with the same overrides → same season, same ripple
  Note over A: Later, Ask sends {question, plot, day, overrides};<br/>tools see the logged spray as done
```

## 5. Conventions to keep

- **The engine stays pure and deterministic.** No `Math.random()`, no clock reads inside `generateSeason`. Use `hash01(seed, plot, day, salt)` for any random draw so a change to one plot does not reshuffle another. `scripts/simtest.ts` checks this.
- **Every change to the season is an override**, applied in `generateSeason`; never mutate a `Season`.
- **Provenance on every event**: `by: "computed" | "human" | "verified"`, and `logged: true` when the farmer entered it on the phone.
- **Products and doses only from `SPRAYS`.** If you add a chemical, add it to the guard's lists too.
- **Every farmer-facing line has a Marathi twin**, set with `var(--font-anek-deva)` or the `font-marathi` class; numbers in Marathi lines use `mrNum`.
- **Every number on screen says where it came from**: `SourceStamp live={…} label="…"`.
- **Design language**: use the `record/` primitives (`Sheet`, `SheetHead` with a form number `KK-n`, `Ink`, `Stamp`, `StampButton`) and the CSS tokens in `globals.css`; touch targets at least 44 px (most are 48+).
- **Comments say why**, in full sentences, at the density of the surrounding code.
- **Honest labels in docs**: say what is simulated, what is optimistic, what is not fine-tuned.

## 6. Recipes

### Add a new kind of override (what the farmer or officer can change)

The farmer-entries change (`cd40d62`) is the worked example.

1. **Type**: add the field to `Overrides` in `lib/sim/types.ts` (and an event type to `PlotEvent` if it writes a new kind of entry).
2. **Engine**: apply it in `generateSeason` at the right stage of the day loop. Keep it causal: it may change only what it causes. Replace the simulated event it stands for rather than adding a duplicate.
3. **Ripple**: teach `diffSeasons` (`lib/sim/selectors.ts`) to describe what changed in a sentence a farmer or officer understands.
4. **Store**: add an action in `lib/store.ts` that builds the new overrides and calls `local(…, label)`; the label is what other screens show.
5. **Relay**: validate the shape in `app/api/sync/route.ts` (`valid`), with sizes bounded.
6. **Agent**: if the agent should cite it, extend `describeEvent` / the relevant tool in `lib/agent/tools.ts`.
7. **UI**: a component under `components/farmer` or `components/desk` using the `record/` primitives, English and Marathi.
8. **Tests**: a smoke check in `scripts/smoke.mjs`; run `simtest.ts` to confirm isolation.
9. **Docs**: the `Overrides` schema in [DATA.md](DATA.md), the feature table in the README.

### Add an agent tool

1. Add an entry to `TOOLS` in `lib/agent/tools.ts`: a `spec` (name, description, JSON-schema parameters) and a `run(ctx, args)` returning `{ data, facts }`. Each fact needs a stable `id` so answers can cite it and the guard can check it.
2. If a route should always fetch it, add it to `PREFETCH` for that intent.
3. Run `npm run eval:agent` and look at the guard results in `docs/data/agent-eval.json`.

### Add a router intent

1. Write templates in `ml/router/train.py` (English, Marathi, Marathi in Latin letters).
2. `npm run train:router`, then `npm run test:router` (parity between Python and TypeScript must stay under 1e-4).
3. Give the intent a `PREFETCH` list and, if it has reviewed Marathi wording, a template in `agent.ts`.

### Retrain the pomegranate Scan Lens

`npm run train:pomegranate` (needs `ml/.venv` with CUDA PyTorch and the dataset in `ml/data/pomegranate-hf`). It writes `web/public/models/pomegranate/{model_fp32.onnx,config.json,metrics.json}`. Unload Ollama first on the 8 GB GPU.

### Add a page or panel

Start from `.impeccable/surfaces/*.md` for the surface's design contract, compose with `components/record/*`, and check it at 375 px (phone) and 1440 px (desk).

## 7. Tests and what each proves

| Command | Proves |
| --- | --- |
| `npx tsc --noEmit`, `npx eslint src` | Types and lint |
| `npx tsx --tsconfig tsconfig.json scripts/simtest.ts` | Engine statistics; a scan far from the hero leaves other plots unchanged |
| `npm run smoke` | 24 end-to-end checks in Chrome across phone and desk (dev server on :3000) |
| `npm run test:slips` | The three specimen slips parse and check correctly |
| `npm run test:router` | TypeScript router matches the Python model |
| `npm run backtest` | Spread-forecast skill against baselines |
| `npm run eval:agent` | 14 agent questions end to end on the local model |

There are **no unit-test framework, no CI and no integration tests against the database** yet; the product plan adds them first ([PRODUCT-PLAN.md](PRODUCT-PLAN.md), Phase 1).

## 8. Scripts

| Script | Purpose |
| --- | --- |
| `demo.mjs`, `cert.mjs` | One-command demo, self-signed HTTPS |
| `build-geo.ts`, `build-terrain.ts`, `build-kb.mts` | Generate `src/data/*` from OSM, DEM and the docs |
| `copy-ort.mjs`, `copy-ocr.mjs`, `fetch-model.mjs` | Postinstall: runtimes and models into `public/` |
| `smoke.mjs`, `slip-test.ts`, `simtest.ts`, `router-parity.mts`, `agent-eval.mts`, `backtest.ts` | Tests and evaluations |
| `capture*.mjs`, `make-slips.mjs` | Screenshots and specimen slips |
| `report/*` | The Word/PDF project report (Windows, needs Word) |
