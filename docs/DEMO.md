# The demo: one leaf, one season, one sale

Seven minutes. The thread is Sunita's plot, but every step shows something only the whole taluka can see.

## Setup

| Option | How | When to use |
| --- | --- | --- |
| **Two devices** (best) | `npm run demo -- --https` on the laptop; it opens `/desk` and prints a QR code; scan it with a phone on the same Wi-Fi and accept the certificate warning once | Venue Wi-Fi allows device-to-device traffic |
| **One laptop, two windows** | Open `/desk`, then *Open Sunita's phone* in the desk's demo slip (a narrow popup) | Wi-Fi isolates devices |
| **Offline** | Run `npm run demo` once with the network (it saves the forecast); at the venue run `npm run demo -- --offline` | No internet at all: the saved forecast is served and the desk says *saved forecast · offline*; the agent runs on the laptop; Chrome's voice input needs the internet, so type questions |

Before going on stage: open `/status` (models warm, database, saved forecast, screens connected), press **Reset** on the desk (clears every screen, the relay and the messages), check the weather slip says **Live** (or *saved forecast* offline), and check the Pest Radar's leaf-wet strip says *recorded to* yesterday.

## Script

| Time | Screen | Do | Say |
| --- | --- | --- | --- |
| 0:00 | Pitch `/` | Scroll the first chapters | "Every plot remembers; every village sees together. The season you are watching runs on Phaltan's recorded 2026 weather." |
| 0:40 | Desk | Point at the leaf-wet strip, then the wind field | "Red days had twelve hours of wet canopy: blight weather. These pencil strokes are the live wind, from nine forecast points over the taluka." |
| 1:10 | Phone | *Ask* → "Why did my last spray fail?" (or speak it in Marathi) | "Her own record answers: on 21 September she sprayed at three, and 24 mm of rain fell that evening. That rain really fell." |
| 2:00 | Phone | Airplane mode on → *Scan a leaf* → Pomegranate → Photo → Save; the header shows *Offline · 1 to send*; airplane mode off | "No signal in the orchard: the scan runs on the phone and waits in its outbox. Signal back: it goes, in order, once." |
| 2:20 | Desk | Read the ripple | "Her spray is set for the first dry morning, neighbours are warned, the radar redraws, and her harvest grade rises." |
| 2:50 | Desk | *Rain forecast in 18 h* → press play on the 72-hour strip | "If a storm comes, the wind carries blight from the reported cells: watch the plume grow, hour by hour." |
| 3:30 | Desk | *Warn* | "One tap: an advisory to every plot in the plume, on the app or by SMS, and the season re-plans." |
| 3:40 | Desk → phone | *Advisories* tab → *One village* → Taradgaon → *Prepare* → *Approve and send*; the phone shows the banner; open it | "The officer reads exactly what goes out, in Marathi, and approves it. Sunita's phone has it now: delivered, and read when she opens it. The receipts are real." |
| 3:45 | Desk | *Storm brush* → drag from south-west of Adarki to the north-east | "Or ask what if: draw a storm and watch the gust front carry blight from the warning cell. The ensemble line says all 51 forecast runs are dry this week; this is the what-if." |
| 4:00 | Desk | *Clear storm*; click the season track at 19 September; play the strip | "The same forecast on the real monsoon. Warning the plume books 52 preventive sprays and cuts new infections from 14 to 11." |
| 4:50 | Desk | *Harvest Wave*, hover the Pune glut week | "Crop stage on every plot is the harvest forecast, and the harvest forecast is the transport plan." |
| 5:20 | Phone | Harvest date: move the first picking earlier, choose Phaltan | "Pooled runs re-plan on the desk." |
| 5:50 | Phone | *Check a sale slip* → *A slip with extra charges* | "Read on the phone in a second: commission at 8% against 6% agreed, hamali at ₹7 against ₹5, ₹250 of 'misc'. ₹1,863 to ask about." |
| 6:20 | Phone, desk | *Send to the officer*; reply from the inbox; *Listen* on the phone | "The officer answers with the slip in front of them, and Sunita can listen to the reply." |
| 6:35 | Phone, then any phone | *Lot passports* → P1 → scan the QR with another phone | "Every picking has a passport: where it grew, every spray, and whether copper is too close to picking for export." |
| 6:50 | Phone | *Check a sale slip* → *A Marathi slip*; then *Share my season* | "Slips in Marathi too; a misread digit is corrected only when the line proves it. And the season, as one image for WhatsApp." |
| 6:45 | Pitch | The honest ledger | "Weather, wind, map, scans and slip reading are real. The farmers are synthetic, and the roadmap is how they become real." |

## Fallbacks

- **Live forecast down**: the weather slip shows *Simulated*; the forecast panel uses recorded or simulated days; say so.
- **Phone cannot reach the laptop**: use the popup phone on the laptop; BroadcastChannel keeps the two windows in step.
- **Camera blocked on HTTP**: the slip reader's Camera button opens the phone's camera app over plain HTTP; Scan Lens falls back to the same.
- **Something looks wrong**: *Reset* on the desk, reload both screens.

## After the demo

`node web/scripts/capture-docs.mjs` refreshes the screenshots in `docs/images`.
