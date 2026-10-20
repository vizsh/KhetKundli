# The demo: one leaf, one season, one sale

Seven minutes. The thread is Sunita's plot, but every step shows something only the whole taluka can see.

## Setup

| Option | How | When to use |
| --- | --- | --- |
| **Two devices** (best) | Laptop runs `npm run dev -- -H 0.0.0.0` (or `npm run build && npm start`); laptop opens `/desk`; a phone on the same Wi-Fi opens `http://<laptop-ip>:3000/farmer` | Venue Wi-Fi allows device-to-device traffic |
| **One laptop, two windows** | Open `/desk`, then *Open Sunita's phone* in the desk's demo slip (a narrow popup) | Wi-Fi isolates devices |
| **Offline** | `npm run build && npm start`; open `/farmer` once online and read one slip (to cache the OCR core); then airplane mode | No internet at all: weather falls back to simulated, and every stamp says so |

Before going on stage: press **Reset** on the desk (clears every screen and the relay), check the weather slip says **Live**, and check the Pest Radar's leaf-wet strip says *recorded to* yesterday.

## Script

| Time | Screen | Do | Say |
| --- | --- | --- | --- |
| 0:00 | Pitch `/` | Scroll the first chapters | "Every plot remembers; every village sees together. The season you are watching runs on Phaltan's recorded 2026 weather." |
| 0:40 | Desk | Point at the leaf-wet strip, then the wind field | "Red days had twelve hours of wet canopy: blight weather. These pencil strokes are the live wind, from nine forecast points over the taluka." |
| 1:10 | Phone | *Ask* → "Why did my last spray fail?" (or speak it in Marathi) | "Her own record answers: on 21 September she sprayed at three, and 24 mm of rain fell that evening. That rain really fell." |
| 2:00 | Phone | *Scan a leaf* → Pomegranate → Photo → Save | "No signal in the orchard; the scan runs on the phone." |
| 2:20 | Desk | Read the ripple | "Her spray is set for the first dry morning, neighbours are warned, the radar redraws, and her harvest grade rises." |
| 2:50 | Desk | *Rain forecast in 18 h* → press play on the 72-hour strip | "If a storm comes, the wind carries blight from the reported cells: watch the plume grow, hour by hour." |
| 3:30 | Desk | *Warn* | "One tap: an advisory to every plot in the plume, on the app or by SMS, and the season re-plans." |
| 4:00 | Desk | Click the season track at 19 September; play the strip | "The same forecast on the real monsoon. Warning the plume books 52 preventive sprays and cuts new infections from 14 to 11." |
| 4:50 | Desk | *Harvest Wave*, hover the Pune glut week | "Crop stage on every plot is the harvest forecast, and the harvest forecast is the transport plan." |
| 5:20 | Phone | Harvest date: move the first picking earlier, choose Phaltan | "Pooled runs re-plan on the desk." |
| 5:50 | Phone | *Check a sale slip* → *A slip with extra charges* | "Read on the phone in a second: commission at 8% against 6% agreed, hamali at ₹7 against ₹5, ₹250 of 'misc'. ₹1,863 to ask about." |
| 6:20 | Phone, desk | *Send to the officer*; reply from the inbox | "The officer answers with the slip in front of him." |
| 6:45 | Pitch | The honest ledger | "Weather, wind, map, scans and slip reading are real. The farmers are synthetic, and the roadmap is how they become real." |

## Fallbacks

- **Live forecast down**: the weather slip shows *Simulated*; the forecast panel uses recorded or simulated days; say so.
- **Phone cannot reach the laptop**: use the popup phone on the laptop; BroadcastChannel keeps the two windows in step.
- **Camera blocked on HTTP**: the slip reader's Camera button opens the phone's camera app over plain HTTP; Scan Lens falls back to the same.
- **Something looks wrong**: *Reset* on the desk, reload both screens.

## After the demo

`node web/scripts/capture-docs.mjs` refreshes the screenshots in `docs/images`.
