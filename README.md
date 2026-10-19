# KhetKundli · खेतकुंडली

Every pomegranate plot in Phaltan taluka keeps a living season record, its *kundli*. Together the records show what no single farmer can see: blight fronts, the village harvest wave, and the shared water table. Built by Team Outliers for the Phaltan Hackathon (agriculture track).

| Surface | What it does |
| --- | --- |
| `/farmer` | Sunita's phone: the kundli season wheel, today's one action with a live 72-hour spray window, on-device Scan Lens, Marathi voice questions answered from her own record, picking date and market, passbook |
| `/desk` | The taluka desk for the FPO or extension officer: real Phaltan survey map with Pest Radar, Harvest Wave, Water Commons and pooled runs, a rolling date stamp that replays the season, daily register, plot records |

A scan saved on the phone ripples on the desk in another window: spray re-planned, neighbours warned, Pest Radar redrawn, harvest grade improved.

## Run it

```bash
cd web
npm install        # also fetches the scan model and ONNX Runtime's WebAssembly files
npm run dev        # http://localhost:3000/farmer and http://localhost:3000/desk
npm run smoke      # end-to-end check (needs the dev server and Chrome)
```

Optional: copy `web/.env.example` to `web/.env.local` and add a data.gov.in key for live Agmarknet prices.

## What is live and what is simulated

Weather (Open-Meteo), geography (OpenStreetMap) and tomato/capsicum leaf scans (MobileNetV2 in the browser) are live. The 192 farmers and their plots, the pomegranate scan result and mandi prices (until a key is set) are simulated and stamped SIMULATED on screen.

## Repository

- `web/` Next.js 16 app (TypeScript, Tailwind v4, shadcn, Motion, React Bits, D3)
- `ml/` training pipeline for the Scan Lens model on field photos
- `data/raw/` OpenStreetMap extracts for Phaltan taluka (ODbL)
- `docs/ARCHITECTURE.md` architecture, honest numbers and build plan
- `PRODUCT.md`, `DESIGN.md` product record and design system

Map data © OpenStreetMap contributors. Sample leaf photos credited in `web/public/samples/samples.json`.
