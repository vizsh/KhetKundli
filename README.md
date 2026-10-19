# KhetKundli · खेतकुंडली

Every pomegranate plot in Phaltan taluka keeps a living season record, its *kundli*. Together the records show what no single farmer can see: blight fronts, the village harvest wave, and the shared water table. Built by Team Outliers for the Phaltan Hackathon (agriculture track).

| Surface | What it does |
| --- | --- |
| `/` | The pitch: one season told in seven scroll chapters that drive the live engine, then the six problem statements it answers and an honest ledger of what is live |
| `/farmer` | Sunita's phone: the kundli season wheel, today's one action with a live 72-hour spray window, on-device Scan Lens, Marathi voice questions answered from her own record, picking date and market, a sale-slip check that reads the agent's patti on the phone, passbook |
| `/desk` | The taluka desk for the FPO or extension officer: real Phaltan survey map with Pest Radar, Harvest Wave, Water Commons and pooled runs, a rolling date stamp that replays the season, daily register, officer inbox, plot records |

A scan saved on the phone ripples on the desk: spray re-planned, neighbours warned, Pest Radar redrawn, harvest grade improved. A photographed sale slip is read and checked on the phone in about a second, with no upload: every deduction is compared with the agreed rate card, the overcharge is circled in red, and the dispute goes to the officer's inbox. Phone and desk stay in step in two windows or on two devices on the same Wi-Fi.

## Run it

```bash
cd web
npm install        # also fetches the scan and OCR models, and the ONNX Runtime and Tesseract WebAssembly files
npm run dev        # http://localhost:3000 (pitch), /farmer and /desk
npm run smoke      # end-to-end check (needs the dev server and Chrome)
npm run test:slips # reads both specimen slips and checks the parser
```

Optional: copy `web/.env.example` to `web/.env.local` and add a data.gov.in key for live Agmarknet prices. For a real phone, run `npm run dev -- -H 0.0.0.0` and open `http://<laptop-ip>:3000/farmer` on the same Wi-Fi.

## What is live and what is simulated

Weather (Open-Meteo), geography (OpenStreetMap), tomato and capsicum leaf scans (MobileNetV2 in the browser) and sale-slip reading (Tesseract in the browser) are live. The 192 farmers and their plots, the pomegranate scan result, mandi prices (until a key is set) and the two specimen slips are simulated and labelled so on screen.

## Repository

- `web/` Next.js 16 app (TypeScript, Tailwind v4, shadcn, Motion, React Bits, D3)
- `ml/` training pipeline for the Scan Lens model on field photos
- `data/raw/` OpenStreetMap extracts for Phaltan taluka (ODbL)
- `docs/ARCHITECTURE.md` architecture, honest numbers and build plan
- `PRODUCT.md`, `DESIGN.md` product record and design system

Map data © OpenStreetMap contributors. Sample leaf photos credited in `web/public/samples/samples.json`. OCR by Tesseract.js (Apache-2.0).
