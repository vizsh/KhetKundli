# Gaps: what stands between the prototype and a real product

An honest register of what is missing, wrong or only simulated, written on 3 November 2026 (commit `cd40d62`) when the goal changed from "an excellent local prototype" to "an actual product with a real demonstration". Each gap has an id, its severity for a real product, the evidence in the code, and the phase of [PRODUCT-PLAN.md](PRODUCT-PLAN.md) that closes it.

Severity: **S1** blocks any real use or can lose or corrupt a farmer's data · **S2** blocks a credible pilot · **S3** weakens the product or the demo.

---

## 1. Backend and data integrity

| Id | Gap | Sev | Evidence | Phase |
| --- | --- | --- | --- | --- |
| G-B1 | **Lost updates between devices.** The whole `Overrides` object travels as one message and the newest clock wins. If two phones (or a phone and the desk) change the season before seeing each other's change, one change is silently lost. | S1 | `relay.ts` `accept()` keeps `r.overrides = msg.overrides` when its clock is newer; `sync.tsx` replaces the local overrides with what arrives | 1 |
| G-B2 | **The client is the source of truth.** Every browser generates all 192 plots and holds the overrides; the server stores what clients send. There is no server-side record of a plot. | S1 | `store.ts` regenerates locally; the relay keeps a blob in `kv` | 1 |
| G-B3 | **The server trusts client input.** The agent and the advisory pipeline regenerate the season from overrides sent in the request body; `/api/messages` sends whatever text the client posts. A tampered client could make the agent answer from a fake record or send any SMS. | S1 | `api/agent/ask` and `api/agent/advisories` read `body.overrides`; `api/messages` takes `items[].sms` | 1 |
| G-B4 | **No identity, no authentication, no authorisation.** Anyone on the network can read the stream, post messages, reset the database. | S1 | No auth in any route handler; `reset` clears everything | 1 |
| G-B5 | **No consent model.** Nothing records who agreed to share what, for which purpose (needed under the DPDP Act 2023 and the DPDP Rules 2025). | S1 | No consent table or check | 1 (model), 2 (flows) |
| G-B6 | **Single process, in-memory fan-out.** The relay's subscribers live in `globalThis`; scaling past one process or restarting drops live connections. | S2 | `relay.ts` | 2 |
| G-B7 | **No migrations, backups or restore drill.** The schema is `create table if not exists`; one SQLite file. | S2 | `db.ts` | 1 |
| G-B8 | **Corrections are overwrites.** Undo deletes an entry from the overrides; there is no history of what was changed and by whom. | S2 | `store.ts` `removeEntry` | 1 |
| G-B9 | **Validation is partial.** `/api/sync` checks entries, escalations and replies; scans, slips, advisories and the rest of overrides are accepted as sent. No shared schema between client and server. | S2 | `api/sync/route.ts` | 1 |
| G-B10 | **No rate limits, no request size limits beyond a few fields, no abuse controls.** | S2 | All route handlers | 1 |
| G-B11 | **Timers in request handlers.** The gateway simulator uses `setTimeout` inside `/api/messages`; receipts are lost on restart. There is no job runner. | S2 | `api/messages/route.ts` | 2 |
| G-B12 | **No audit trail an outsider can trust.** The `events` table is append-only by convention, but rows can be edited and nothing proves they were not. | S2 | `db.ts` | 1 |
| G-B13 | **No observability.** No structured logs, metrics, traces or error tracking; `/status` is a page, not monitoring. | S2 | — | 1 |
| G-B14 | **No API versioning or contract.** Clients and server change together; an old phone in the field would break. | S2 | — | 1 |
| G-B15 | **One global demo clock** (`t`) is shared by every screen. A product needs real time per user, with replay as a separate mode. | S2 | `store.ts`, `relay.ts` (`time` messages) | 1 |

## 2. Testing and delivery

| Id | Gap | Sev | Evidence | Phase |
| --- | --- | --- | --- | --- |
| G-T1 | **No unit-test framework.** The engine, parser and guard are tested only through scripts and the browser smoke test. | S2 | `package.json` scripts | 1 |
| G-T2 | **No property tests of the sync invariants** (idempotency, convergence, order independence). | S1 | — | 1 |
| G-T3 | **No integration tests against the database**, no contract tests for the API. | S2 | — | 1 |
| G-T4 | **No continuous integration.** Nothing runs on a push. | S2 | No `.github/workflows` | 1 |
| G-T5 | **No load, soak or failure tests** (kill the server mid-sync, partition a phone for a week). | S2 | — | 3 |
| G-T6 | **No staging environment or deployment.** Everything runs on one laptop. | S2 | — | 2 |

## 3. Channels: reaching real farmers

| Id | Gap | Sev | Evidence | Phase |
| --- | --- | --- | --- | --- |
| G-C1 | **No real SMS.** Messages reach only browsers in the room. In India, commercial SMS needs TRAI DLT registration of the sender, header and every template. | S1 for a pilot | `api/messages` simulator | 2 |
| G-C2 | **No WhatsApp.** The channel most farmers already use; needs a WhatsApp Business account and approved templates. | S2 | — | 2 |
| G-C3 | **No IVR or missed-call flow** for feature phones and low literacy. | S3 | — | 3 |
| G-C4 | **Voice needs the internet** (Web Speech API in Chrome). Offline Marathi speech-to-text and text-to-speech are not built. | S2 | `voice.ts` | 2 |
| G-C5 | **No push notifications** to the installed app. | S3 | — | 2 |

## 4. Data and models

| Id | Gap | Sev | Evidence | Phase |
| --- | --- | --- | --- | --- |
| G-D1 | **The 192 farmers are synthetic.** Every collective view (radar, wave, water, runs) is computed from simulated history. | S1 for impact claims | `sim/people.ts`, `season.ts` | 2–3 |
| G-D2 | **Model parameters are hand-calibrated**, not fitted (blight hazard, spread kernel, detection rates). | S2 | [MODELS.md](MODELS.md) | 3 |
| G-D3 | **The pomegranate model's 99.7% is optimistic**: random split of one public dataset, fruit only, none from Phaltan; near-duplicates may sit on both sides. | S2 | `ml/scanlens/train_pomegranate.py` | 2 (group split), 3 (field set) |
| G-D4 | **No pomegranate leaf model.** Leaf scans use a PlantVillage tomato/capsicum model that misread two of three field photos. | S2 | [MODELS.md](MODELS.md) §7 | 3 |
| G-D5 | **Only an fp32 model ships (16.8 MB).** No int8 build, no measurement on a low-end Android phone or a Snapdragon NPU (the Qualcomm problem statement). | S2 | `public/models/pomegranate/` | 2 |
| G-D6 | **The router is trained on generated templates** (0.71 on unseen templates), not real questions. | S3 | [AGENTS.md](AGENTS.md) | 3 |
| G-D7 | **The forecast backtest is on simulated reports** (AUC 0.577 vs 0.559 distance-only). | S2 | `docs/data/backtest.json` | 3 |
| G-D8 | **Prices are simulated** without a data.gov.in key; there is no stored price history. | S2 | `api/prices` | 2 |
| G-D9 | **Weather is a reanalysis grid**, not an orchard station; the wind grid has nine points for a 60 km taluka. | S3 | [DATA.md](DATA.md) | 3 (one station to validate) |
| G-D10 | **Slip OCR has been tested on three specimen slips**; handwriting and real layouts are unknown. | S2 | `scripts/slip-test.ts` | 3 |

## 5. Product

| Id | Gap | Sev | Evidence | Phase |
| --- | --- | --- | --- | --- |
| G-P1 | **One farmer per installation.** The phone is fixed to Sunita; there is no "this phone belongs to…", no shared-phone household support. | S1 | `phone.tsx` uses `season.heroPlot` | 1 |
| G-P2 | **No enrolment**: registering a farmer, a plot (gat, GPS walk), a bahar date. | S1 | — | 1–2 |
| G-P3 | **No voice logging** of work ("I sprayed today"). | S3 | `log-work.tsx` is taps only | 2 |
| G-P4 | **No feedback loop**: farmers cannot rate answers; the officer has no review screen, although `agent_log` has `rating` and `correction` columns. | S2 | `db.ts` | 2 |
| G-P5 | **No impact measurement**: nothing computes litres kept, sprays saved, rupees flagged or time-to-warning from real events with a baseline. | S1 for "real impact" | — | 2–3 |
| G-P6 | **No FPO or officer administration**: villages, rate cards, staff, templates. | S2 | Rate card is a constant | 2 |

## 6. People, legal and operations (not code, still blocking)

| Id | Gap | Sev | Phase |
| --- | --- | --- | --- |
| G-O1 | **No agronomist has reviewed the spray table**; advisories must stay within registered label claims (CIB&RC). | S1 | Before Phase 3 |
| G-O2 | **No partner FPO or KVK**, so no real users, no rate card, no pilot villages. | S1 | Before Phase 3 |
| G-O3 | **No privacy notice, terms or data-processing agreement**; no named data fiduciary. | S1 | 2 |
| G-O4 | **No field photos or real pattis** from Phaltan. | S2 | 3 |
| G-O5 | **No support process** (who answers the farmer's phone call when the app is wrong). | S2 | 3 |
| G-O6 | **Licence questions**: the tomato/capsicum model ("other" on Hugging Face); the pomegranate dataset is CC BY 4.0 (credit required). | S3 | 2 |

## 7. What is already solid (keep it)

- The deterministic engine and its causal isolation (`simtest.ts`).
- Hybrid logical clocks, the IndexedDB outbox and the idempotent relay: the right shape, to be moved to per-event sync.
- The guard: no dose, product, date or number reaches a farmer unless it is in the evidence.
- Provenance inks and LIVE / RECORDED / SIMULATED labels throughout.
- Offline-first scan and slip check on the device.
- 24 end-to-end smoke checks, the backtest, the agent evaluation, router parity.

## 8. The five gaps that matter most

1. **G-B1 + G-B2 + G-B3**: make the server the source of truth, with per-event sync that cannot lose an update and never trusts client-sent state.
2. **G-B4 + G-B5 + G-P1**: real people with accounts, roles and consent; one phone, any farmer.
3. **G-C1**: a real SMS that arrives on a real farmer's phone, DLT-registered.
4. **G-P5**: an impact ledger that derives every claimed litre and rupee from real events.
5. **G-O1 + G-O2**: an agronomist and a partner FPO. No code closes these.
