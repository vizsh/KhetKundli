# Scenario trial: markets and money

Scope: Sunita selling at Phaltan APMC or sending to Pune or Vashi. The adatiya, the tempo driver, the collection-point volunteer, the buyer or exporter, the FPO and the trader. Every claim was checked against today's code on `main` (after slice 2). Paths are relative to `web/src/` unless they start with `docs/`. This was a read-only trial: I edited nothing and ran nothing that writes.

**How to read it.** Each scenario has: Situation, Walkthrough, Advocate, Skeptic, Verdict, Fix, Gap. Fix sizes are S (under a day), M (days) and L (a week or more). Gap severity follows docs/GAPS.md: S1 blocks real use or can harm the farmer's data or money; S2 blocks a credible pilot; S3 weakens the product. Statements about law and fees (APMC rules, GST, TDS, SMS prices) are from memory and are marked as needing checking.

---

## Scenario 1 · Sale-slip check at the adatiya's shop

**Situation.** Sunita sells 40 crates at Pune market yard. The adatiya's munim hands her a patti: carbon copy, handwritten numbers, folded, some figures in Marathi digits. She photographs it on a ₹7,000 Android phone at 6 a.m. under a tube light.

**Walkthrough.**
- **Reading the photo.** `ocr.ts:15-35` starts Tesseract.js (LSTM only) from files served under `/tesseract`. The reader is about 3.9 MB of WebAssembly plus a 2.9 MB English model, and the Marathi model adds 2.0 MB on demand. The service worker caches them (`public/sw.js:21-26`), so it works offline once loaded.
- **Preparing the photo.** `prepareImage` (`ocr.ts:53-61`) only rescales it. There is no deskew, perspective correction, binarisation or contrast stretch. A grey carbon copy or a folded crease goes to Tesseract as it is.
- **Marathi second pass.** If English finds fewer than four key fields or reads under 60% sure, the photo is read again with Marathi + English (`slip-check.tsx:181-187`). Devanagari digits are converted (`patti.ts:57-66`).
- **Parsing.** It depends on printed labels such as Adat, Hamali or तोलाई, read line by line with the amount at the end of the line (`patti.ts:86-96`, `patti.ts:138-160`).
  - A handwritten kaccha patti in columns, or with the amount on the next line, produces no charges.
  - The farmer then has to type every number into the ledger by hand (`slip-check.tsx:93-122`).
- **Repairs.** Repairs are careful: one digit away, or a weak read. Totals and the net are never corrected (`patti.ts:180-210`).
- **The checks.** `checkSlip` compares against `rateCardFor` (`patti.ts:215-219`), which returns constants: commission 6%, hamali ₹5 a crate, weighment ₹1 a crate (`sim/rules.ts:91-93`). Freight is the pooled-run rate (`rules.ts:102-106`) whether or not she used a pooled run. The screen says "checked against the pooled-run rate card" (`slip-check.tsx:367`).
- **The gross check.** `kg × rate` is compared with the gross, and the whole difference counts as money owed (`patti.ts:250-257`). Nothing checks that the rate is a ₹/kg figure.
  - Suppose a yard quotes ₹/crate, for example "Rate 1500" on 800 kg.
  - The check expects ₹12,00,000 and flags about ₹11.6 lakh "owed".
  - The dispute note then asks the agent to "Please refund" that amount (`patti.ts:350-357`).
- **Charges not on the card.** Any line not on the card counts in full as money owed (`patti.ts:270-273`). This includes lawful charges such as a market fee, cess, crate rent or postage.
- **After the check.**
  - "File in my record" writes a `slip` event (`store.ts:220-222`). Its contract (`events.ts:36-52`) includes agent, pattiNo, net and aboveCard.
  - "Send to the officer" sends only text: up to 500 characters plus four context lines (`slip-check.tsx:224-237`). The photo never leaves the phone, by principle (`docs/PROBLEM.md` principle 5).
  - "Note for the agent" shares a bilingual text that ends "Please refund ₹X" (`slip-check.tsx:238-245`).
  - The officer can only pick a canned reply (`components/desk/inbox.tsx:20-24`). One of them says "I have sent this to the FPO and the APMC office", but nothing in the code does that.

**Advocate.**
- The arithmetic engine is honest and conservative. It never corrects totals, never guesses an unreadable number, and shows every correction in violet.
- It runs offline on the phone and shows the farmer which numbers to check.
- For a printed computer patti from a large Pune or Vashi agent it will work. Those are the slips where hidden charges ("other" lines) and a short-billed weight are most common.
- It turns "few farmers check the arithmetic" into a 20-second habit, and the filed slip feeds her record and the agent's answers (`agent/tools.ts:37`).

**Skeptic.**
1. **The OCR is untested on real slips.** Only three specimen slips made for the demo exist (`public/samples/slips.json`; G-D10). Tesseract handles handwriting badly, and carbon copies and folds get no preprocessing. On the slips Phaltan farmers actually get, expect manual typing most of the time.
2. **The rate card is a constant, not the FPO's.**
   - A 6% commission may not be what was agreed.
   - Legal point to verify: Maharashtra has directed that adat on fruits and vegetables be recovered from the buyer, not the farmer. If so, a card that "agrees" a 6% deduction from the farmer makes an unlawful deduction look normal.
3. **False positives harm the farmer.**
   - Per-crate rates produce absurd "owed" sums.
   - Lawful levies show up as overcharges.
   - Unusual box sizes trip the 20 kg-a-crate weight check (`patti.ts:241-247`). For example, 3–5 kg boxes for Vashi or export.
   - A farmer who shows an adatiya a wrong "Please refund ₹11 lakh" note loses face. She may also lose the agent: many farmers depend on the adatiya for seasonal advances (*udhaar*), and an agent can quietly give her lots late auction slots or lower bids. The UI never warns about this.
4. **The officer cannot act.**
   - With no photo, the officer has an unverifiable claim.
   - A farmer can type any numbers and file a slip with a large aboveCard. The desk feed shows it (`sim/selectors.ts:76`) without evidence.
   - There is no case status: no open, raised, refunded or refused.
   - Nothing reaches the APMC, and no fair-slip index exists (F6 is not built).
5. **Weighing fraud is out of scope.** A tampered scale or a "kat" weight cut gives a slip whose arithmetic is perfect. The app would stamp it "Checked" (`slip-check.tsx:357-364`), which gives false comfort.
6. **The filed slip is not private.**
   - Every signed-in farmer receives all raw season events: `relay.ts:53`, `default: return msg`. That includes her net income, the agent's name and the flagged amounts.
   - So does any anonymous lot-page viewer (see Scenario 4).
   - If the agent learns who complained, the risk of being blacklisted is real.
7. **An unread grade becomes A.** `toSaleSlip` defaults grade to "A" when it cannot read one (`patti.ts:339`), so a grade B lot is recorded at the wrong grade.

**Verdict: PARTLY.** The engine is good for printed slips, the inputs are fragile, and the step after the check (escalation and recovery) does not exist.

**Fix (tailored).**
- **Sanity guards** in `checkSlip` (S):
  - Treat rate > ₹400 or gross/kg outside 0.5–2× the rate as "this looks like a per-crate rate". Ask the unit, don't flag.
  - Cap any single "owed" figure at the gross.
  - A list of lawful levy labels (market fee, cess, crate deposit) shows as information, not as owed.
- **The FPO rate card**, versioned per agent and market, as a `rate_card` table with an effective date (REMAINING 2.7, M). `rateCardFor` reads it and the slip records which card version it used. Freight counts only if the slip's lot was on a pooled run.
- **A soft, private note** (S): change the "Note for the agent" to "Please check these lines" without a refund demand, plus a one-line warning in Marathi: "Show this only if you want to; the FPO can raise it for you without your name."
- **Evidence with consent** (M): on "Send to the officer", offer to attach the photo, encrypted and visible to the officer only, kept 90 days. Add a slip-case state machine: open → raised with agent → refunded or refused → closed. The FPO raises cases in a batch by agent, so no single farmer is exposed.
- **Image preprocessing** (M): adaptive threshold, deskew and crop in a worker, with a "trace the slip edges" step. Then a pilot set of 50 real pattis with measured field-level accuracy (G-D10, G-O4).
- **Keep slips out of other farmers' streams now** (S, as part of 1.3.2): a slip event goes only to the owner and staff.

**Gap.**
- Slip check flags lawful levies and per-crate rates as money owed, and the escalation has no evidence or case state. **S2, NEW (M-4).**
- Related known gaps: G-P6 (rate card constant), G-D10 (OCR), G-O4 (real pattis), REMAINING 2.7.

---

## Scenario 2 · A trader front-runs the Harvest Wave

**Situation.** An adatiya in Phaltan, or a trader's relative with a farmer account, learns that Taradgaon picks 900 crates in the week of 16 November. The trader lowers bids that week, or tells buyers to wait.

**Walkthrough.**
- **The desk.** The Wave is a desk feature for officer and fpo_admin (`docs/CONTEXT.md:172`). `wave-chart.tsx:23-31` charts crates per week. `village-ledger.tsx:42-52,105` shows crates per village with no minimum count. A village with 2 plots is shown exactly.
- **A farmer phone gets the raw data.** Any signed-in farmer receives every plot's raw season events (`relay.ts:53`; REMAINING §5, "Any signed-in farmer receives every plot's raw season events"). The phone runs the full engine, and `harvest-date.tsx:99-110` charts the village's daily crates on the farmer's own screen.
- **Lot streams need no account.** Each lot page can stream its plot's future planned pickings (Scenario 4).
- **Nothing aggregates.** There is no aggregation threshold anywhere: a search for anonymity or threshold logic finds nothing. No consent filter exists yet (G-B5, REMAINING 1.3.1).

**Advocate.**
- The same information in the FPO's hands is bargaining power.
- If the FPO knows 900 crates are coming, it can spread pickings and markets and negotiate a block sale. That is the "crop advisory is the demand forecast" thesis (`docs/PROBLEM.md`).
- Traders already guess the supply from the village grapevine. The wave mostly makes the farmers' side as informed as the traders'.

**Skeptic.**
1. **Today the wave is a public good with no gate.** Any farmer account can compute every plot's pick day and crates, not just village totals.
2. **Some traders hold farmer accounts.** In Phaltan, many adatiyas and traders are also orchard owners, or have relatives who are. Enrolment (G-P2) has no way to flag a conflict of interest.
3. **Small villages identify individuals.** A village with one to three plots in the ledger shows one family's harvest exactly.
4. **Planned dates become a bidding schedule.** Per-plot planned dates via lot pages let a trader time bids or delay a vehicle to buy a distressed lot cheaply.
5. **The FPO itself may trade.** FPOs often trade on their own account, so the "steward" role is conflicted too.

**Verdict: FAILS** on protection. The data is genuinely useful, but no aggregation or access control exists for it.

**Fix (tailored).**
- **Server-side projections with k-anonymity** (part of REMAINING 1.3.2 and 1.3.1, M):
  - Wave cells and village rows are shown only when there are at least 5 plots and no single plot holds more than 40% of the crates. Otherwise merge with the neighbouring village or the H3 parent.
  - The farmer's phone strip shows "low / medium / high" bands, not crate counts.
- **A `trader` flag at enrolment** (S): self-declared or set by the FPO. Such accounts never receive the wave.
- **Time-delay public summaries** (S): any shared wave is published to buyers no earlier than 24 hours before the pickings, and only once the FPO has its block-sale plan.
- **A desk access log** (S, with REMAINING 1.3.6): who viewed the wave and when.

**Gap.** Harvest Wave and village crates have no aggregation threshold or trader exclusion, and every farmer device holds per-plot pick plans. **S1, partly G-B2 and G-B5, but the market-specific threshold and trader role are NEW (M-2).**

---

## Scenario 3 · Moving the picking, pooled runs and the driver

**Situation.** Rain is due, so Sunita moves her first picking two days earlier and chooses Pune. The pooled run should re-plan: a tempo owner-driver from Taradgaon collects from the village collection point at 01:30.

**Walkthrough.**
- **Choosing the date.** `harvest-date.tsx:35-79,137-147`: she drags ±7 days; `heroHarvest(shift, market)` (`store.ts:211-213`) records a `harvest` event.
- **The event has no plot.** It is `{shift, market}` (`events.ts:70`), folded into a single `heroPickShift` and `heroMarket` (`events.ts:122,129`). Only the hero plot uses it (`season.ts:88,360`). Only the hero's owner or staff may record it (`authz.ts:94`; tested at `authz.test.ts:95`).
- **Other farmers.** Shankar's phone shows the same control (`phone.tsx:125`). His screen computes `planned = p.harvestStart - heroPickShift` (`harvest-date.tsx:87`), which is Sunita's shift applied to his plot, and the server refuses his confirmation.
- **Runs.** Runs are rebuilt inside the simulation:
  - bookings are grouped by day, hub and market, then packed largest-first into 75-crate "Pickup 1.5 t" vehicles;
  - one lot can be split across vehicles (`season.ts:393-436`; `rules.ts:90`).
- **Freight.** Freight per crate is a fixed constant per market, whatever the vehicle's fill (`rules.ts:102-106`, `season.ts:442`).
- **What is missing.** A search for driver, tempo or manifest finds nothing in `src`. There is no driver, no acceptance, no payment, no manifest, no crate tags and no insurance. The booking event is "computed" at 19:00 on picking day (`season.ts:435`).

**Advocate.**
- The model is the right shape: picking dates on every plot make a demand forecast, and a three-day view lets the FPO book one vehicle per village instead of a tempo per plot.
- The rain rule moving a picking a day earlier (`season.ts:375-381`) is real agronomy: rain cracks fruit.
- The demo convincingly shows a ripple from one farmer's choice into the run plan.

**Skeptic.**
1. **Only one farmer can move a picking.** The harvest choice is a global singleton for the hero plot. In a real deployment, no other farmer can set a date or market, and the Pune choice is not even per picking.
2. **Runs exist only on screen.**
   - No driver is told, accepts, or is paid.
   - If the driver doesn't come, 40 crates sit at the collection point overnight. Pomegranate tolerates this better than grapes, but a missed Vashi night slot costs a day's price.
   - No fallback vehicle and no SMS to the driver (G-C1).
3. **Who pays for a half-empty vehicle?** With a fixed ₹42 a crate for Pune, a 12-crate tail vehicle earns the driver ₹504 for a 220 km round trip. He will refuse or demand a minimum, and the code has no minimum charge or cost sharing.
4. **Splitting a lot across vehicles is unrealistic.** Farmers want one lot on one patti with one agent. Mixed loads need crate marking (farmer code on each crate) and a manifest signed at loading. The collection-point volunteer has no screen, no count and no signature.
5. **Liability for damage.** Crushed or lost crates in a pooled vehicle: who pays? There is no transit record, no insurance and no photo at loading. A dispute at the market ("you gave 38, not 40") cannot be settled.
6. **Pune runs leave before the move is confirmed.** Pune runs depart at 01:30 on the picking day (`season.ts:413`). A change in the evening can't reach a real driver without a channel.

**Verdict: FAILS** as a real service. It is a simulation of what pooled runs would look like.

**Fix (tailored).**
- **Per-plot harvest events** (M): `harvest {plot, picking, day, crates, market}` replaces the singleton. Change `events.ts:70`, `foldEvents`, `season.ts:88,360` and `authz.ts:94` (owner of that plot).
- **A transport loop run by the FPO, not a marketplace** (L):
  - Vehicles and drivers in a registry, by name and phone.
  - A run offer by SMS the evening before, with a reply YES/NO.
  - A minimum load and a cost split: the per-crate fare = vehicle fare / crates on board, capped at the farmer's solo-hire cost.
  - Never split a lot unless the farmer agrees.
- **Collection-point manifest** (M): the volunteer's phone screen lists expected lots. Count crates in by farmer code, take a photo of the loaded vehicle, get the driver's OTP acknowledgement, and produce a manifest PDF for the agent. A count mismatch at the market becomes a record, not an argument.
- **Driver no-show playbook** (S): if no YES by 18:00, the FPO coordinator is alerted and a second driver is offered. The farmer is told "hold the picking".
- **Insurance** (people work): get a group transit policy through the FPO; until then the screen says plainly "not insured".

**Gap.**
- Harvest choice exists only for the hero plot; there is no driver or booking loop, manifest, cost split or damage record. **S1 for F7, NEW (M-3).**
- Related: G-C1 (SMS); F7 in docs/PRODUCT-PLAN.md is planned for Phase 3, with no gap id.

---

## Scenario 4 · Lot passport scanned at Vashi

**Situation.** A buyer at Vashi APMC, or an exporter's field agent, scans the QR on Sunita's crates. The QR is `TAR-214-P1`. The page shows origin, sprays, water and "Export PHI clear".

**Walkthrough.**
- **How the page is built.** `lot.ts:56-89` builds the passport from `season.eventsByPlot`. `lot-passport.tsx:58-62` stamps "Export PHI clear" when `exportCheck.eligible`. `exportCheck` returns eligible when no copper spray falls within 60 days (`lot.ts:48-54`), including when no sprays are recorded at all (`lot.ts:52`).
- **What can be logged.** Spray entries allow only `preventive | curative`, the two copper products (`events.ts:31`, `rules.ts:10-21`). No other insecticide or fungicide can be recorded.
- **Simulated sprays look like hers.**
  - The simulation adds advisory-driven sprays to every plot, including a real farmer's plot, with provenance `"human"` (`season.ts:236`), plus a scripted washed-off spray for the hero (`season.ts:249`).
  - Her own logged sprays are also `"human"` (`season.ts:221`). The passport shows `Ink by={s.by}` (`lot-passport.tsx:85`), so the buyer cannot tell a simulated spray from a logged one; the `logged` flag is not shown.
- **The lot id holds the gat number.** The id is `${village 3 letters}-${gat}` (`season.ts:78`, `lot.ts:10`). The footer says "no gat number" (`lot-passport.tsx:106`), and the phone tells her "not your name or gat number" (`lot-passports.tsx:33`).
- **Re-identification is easy.** The passport adds first name and last initial, acres and irrigation type, village and H3 cell (`lot.ts:73-79`). In a 200-household village that is enough to identify her.
- **The public stream.**
  - `GET /api/sync?lot=` requires no account and no rate limit (`api/sync/route.ts:53-61`).
  - It accepts any picking number for an existing plot (`route.ts:46-51` checks only the plot id).
  - It streams all of that plot's raw events, live, for as long as the page is open (`relay.ts:30-36,40-44,241`). That includes slip events (net, agent, aboveCard, flags), entries, scans, retracts and the `by` device id.
  - Plot ids are guessable: about 23 village prefixes × gat 101–899, roughly 18,000 ids.
- **Forging.** The QR encodes `window.location.href` (`lot-passport.tsx:22,67`). There is no signature, so a cloned page on another domain, or a real lot id printed on someone else's crates, is indistinguishable.

**Advocate.**
- Traceability is a selling point for export-grade Bhagwa.
- The page is honest about its limits: "Not a certificate… residue testing go through APEDA's AnarNet" (`lot-passport.tsx:101`).
- It hides the full name, and it labels the record synthetic.
- A buyer who sees "copper 35 days before picking: domestic market" is saved a rejected container.

**Skeptic.**
1. **"Export PHI clear" is absence of evidence presented as evidence.** A farmer who logs nothing, or forgets, gets a green stamp. A dishonest one can retract the late spray (`events.ts:72`) before the buyer looks; the retract stays in the chain, but the passport doesn't show it.
2. **The record cannot hold a real spray diary.** Pomegranate growers spray many molecules in a season: insecticides for thrips and fruit borer, fungicides, growth regulators. AnarNet registration requires a full spray diary, and the app's two-product enum can't carry it, so the passport is incomplete by construction.
3. **Fiction on a real record.** Today the simulation writes sprays into a real farmer's plot record and the buyer sees them as hers. In a pilot this is a false statement about a real person's lot.
4. **A privacy breach that also leaks market intelligence.** The anonymous stream exposes the gat number (contradicting two on-screen promises), her net income, her agent's name, her complaints, and her future planned pickings ("Planned" stamp, `lot-passport.tsx:57`). The lot QR becomes a way to watch one farmer for the whole season.
5. **No binding between the QR and the fruit.** Nothing ties the code to crate count, weight or date of packing. A trader can reuse a "clear" lot's QR on other fruit.

**Verdict: FAILS** for real use. The concept is right, but today's passport can be wrong in both directions and leaks private data.

**Fix (tailored).**
- **Close the public stream** (S): the lot page fetches a server-computed passport JSON (`GET /api/v1/lot/:id`) with only the passport fields. No raw events and no SSE.
  - Rate-limit it.
  - Use an opaque random lot code (`L-7KQ3-9F`) mapped server-side, so the gat number does not appear.
  - Drop acres and the last initial.
- **Three-state export check** (S):
  - "Clear by the record" only if the farmer confirmed "this is my complete spray diary" for the season.
  - "No sprays logged: unknown" otherwise, never green.
  - Show retracted sprays struck through with the date retracted.
- **A full spray diary** (M): a product list from the FPO, mirrored from the CIB&RC labels and the APEDA residue plan, each with its own PHI. `exportCheck` uses the longest PHI. Needs G-O1 (agronomist).
- **Provenance tiers on the passport** (S): logged by the farmer (ballpoint), logged by FPO staff for her (stamped "on behalf"), simulated (never shown on a real plot's passport). Stop the simulation writing into any enrolled plot: gate `season.ts:236,249` on `!plot.real`.
- **Signed passports** (M): the server signs `{lot, crates, packedOn, exportState, headHash}` with an Ed25519 key. The QR carries the signature and the page verifies it against the published key, so a clone fails. The collection-point manifest (Scenario 3) supplies the crate count.
- **Residue reality** (people work): the passport links to an uploaded NABL lab report when one exists; "residue tested: yes/no" becomes a field.

**Gap.**
- Anonymous lot SSE leaks the whole plot record including slips; the lot id holds the gat number; "Export PHI clear" when nothing is logged; simulated sprays shown as the farmer's. **S1, NEW (M-1, M-5).**
- Related: G-B2, G-B5; F10.

---

## Scenario 5 · Market choice: she follows the advice and gets less

**Situation.** The phone says Pune nets ₹1,494 a crate and Phaltan ₹1,380. Sunita sends 40 crates to Pune at ₹42 a crate freight. Pune pays ₹8/kg below the "advised" price, and she nets less than Phaltan would have paid.

**Walkthrough.**
- **The advice uses simulated prices on the sale day.** Options use `season.prices[id][saleDay]` (`harvest-date.tsx:112-119`). These are prices from a monthly base, AR(1) noise and a hard-coded "Pune glut" at day 168 (`season.ts:308-332`).
- **The future is treated as known.** The sale day may be 8 days ahead, and the screen shows a ₹/crate figure to the rupee with no range.
- **"Best".** `best` is the argmax of net (`harvest-date.tsx:120`) and is preselected (`:121`).
- **Live prices are decoration.** With `DATA_GOV_IN_API_KEY` set, `/api/prices` (`api/prices/route.ts:14-34`) takes today's single Agmarknet record per market, the first regex match: `^pune` may hit Pune (Moshi) or Pune (Manjri), and `mumbai|vashi|navi` for Vashi (`:10,30`). It is displayed as a strip (`harvest-date.tsx:184-192`) but never used in the calculation.
- **Misleading header.** The header says "Prices are simulated until an Agmarknet key is set" (`:126`), which implies a key makes the advice real. It does not.
- **Freight.** It is constant: Phaltan `10 + 0.6×km`, Pune ₹42, Vashi ₹78 a crate (`rules.ts:102-106`). There is no market fee, no unloading at destination, no grade risk at a distant market, and no payment-delay cost.
- **Nothing is kept for later.** The advice shown is not stored: the `harvest` event keeps the shift and market only (`events.ts:70`), not the expected net or the price source.

**Advocate.**
- Net after deductions is the right comparison, and it is shown per crate in Marathi.
- The glut flag compares with the days either side, not the season (`harvest-date.tsx:115-118`), which is good thinking.
- Honest labelling exists ("SIMULATED" stamp; the slip check says "(simulated mandi price)" at `slip-check.tsx:440`).

**Skeptic.**
1. **A forecast presented as a fact.** No one can know Pune's price eight days out to the rupee. Agmarknet itself arrives late (often the previous day, some markets not daily) and Phaltan may not report pomegranate at all. One bad call ("the app told me Pune") destroys trust for the season, and she tells the village.
2. **The key does not change the advice.** Once a key is set, the screen shows a LIVE stamp beside numbers that are still simulated. That mix of labels is worse than none.
3. **Liability.** There is no statement of who stands behind the advice. Indian consumer-protection exposure for paid advice is plausible, and the FPO's credibility is on the line. The screen gives no ranges, no "last 3 seasons on this date", and no "not a guarantee".
4. **Missing costs.** Grade A is assumed (from the first pick event, `:95`). A distant market re-grades harshly, and returns or unsold stock are not modelled.

**Verdict: FAILS** as advice for real money. It works as a labelled demonstration.

**Fix (tailored).**
- **Stop computing future prices in the farmer UI** (S). Replace them with:
  - (a) yesterday's real modal per market with its date and age;
  - (b) a 3-season band for this week from stored history (REMAINING 2.2);
  - (c) net per crate as a range, using the FPO's freight and charges.
  - No "best" preselection. Instead: "Pune has paid ₹4–11/kg more than Phaltan in this week in past seasons, after freight."
- **Correct the header** (S): "Advice uses simulated prices" stays true even with a key until the computation uses real data.
- **An advice record** (S): store `{shownNet, priceSource, priceDate}` with the harvest event. After the sale (slip filed), show "advised vs got". The impact ledger (F9) and the desk then see systematic errors, and the FPO can own them.
- **Per-market price ingest with history** (M, REMAINING 2.2): map Agmarknet market names explicitly, keep the arrival date, mark stale over 48 h.
- **A disclaimer in Marathi** at the point of choice, and the FPO named as the adviser of record (S).

**Gap.**
- Market advice uses a perfect-foresight simulated price even when the live key is set; no uncertainty; no record of the advice. **S1 once real farmers use it, NEW (M-6).**
- Related: G-D8.

---

## Scenario 6 · Glut week: the advice causes the glut

**Situation.** The week of 16 November, every grade-A farmer on KhetKundli sees "Pune nets more". Two hundred lots go to Pune, and Pune prices crash harder than the model predicted.

**Walkthrough.**
- **Same answer for every lot.** In the simulation every grade-A lot picks the argmax of next-day net (`season.ts:361-365`). Same hub, same day, same answer: the whole village goes one way.
- **Arrivals are fixed.** Arrivals are a fixed function of the day (`season.ts:321-327`), not the sum of KhetKundli's bookings, so the advice cannot affect the price in the model.
- **The glut is scripted.** The "Pune glut" is hard-coded at day 168 (`season.ts:321`) and labelled on the desk (`wave-chart.tsx:44,67`).
- **Every phone shows the same "best"** (`harvest-date.tsx:120`).

**Advocate.** The desk shows the wave and the glut together, so the coordinator can see the herding risk. The phone's glut stripe warns on the day.

**Skeptic.**
- **The model is built so that herding cannot appear.** It will validate the very policy that harms farmers.
- **The real effect.** With tens of thousands of crates a week entering Pune in season, a few hundred extra crates may matter only a little. But at Phaltan APMC, where arrivals are small, re-routing everyone *away from* Phaltan collapses the local auction's competition. Traders then stop coming to Phaltan, which hurts the farmers who must sell locally (grade B and C).
- **The farmer is better off; the group may not be.** A recommender that gives everyone the same argmax is individually rational and collectively harmful. "Collective sight" is the premise of the product, so this matters more than usual.

**Verdict: FAILS** (the risk is unmodelled and the advice amplifies it).

**Fix (tailored).**
- **Allocate, don't recommend** (M): the FPO desk sets a daily quota per market from expected absorption. The phone shows each farmer an assigned slot with a reason ("Pune full on 17 Nov; Vashi slot open"). Rotate fairly across farmers over the season, and record it.
- **Make arrivals in the simulation endogenous** (M): `arrivals[m][d] += sum(bookings to m on d) × share`. Prices then respond, and the backtest can show that the allocation beats the argmax.
- **Show the platform's own load** (S): "34 KhetKundli lots already going to Pune that day."

**Gap.** Every farmer gets the same market advice and the model can't see its own effect on prices; there is no FPO allocation or quota. **S2, NEW (M-7).**

---

## Scenario 7 · Payments: late, partial or in cash

**Situation.** The Pune adatiya pays ₹1.4 lakh 30 days late, partly by UPI and partly in cash, after deducting an earlier advance. An FPO collective sale pays the FPO, which must then pay 40 farmers.

**Walkthrough.**
- **No payment field anywhere.** The sale event has gross, deductions and net (`season.ts:447-455`; slip contract `events.ts:36-52`). It has no paid amount, payment date, payment mode, advance netted, or due date. A search for paid, payment, due or GST finds nothing in `src`.
- **A simulated sale wears the "verified" stamp.** Simulated sales are written with provenance `"verified"` (`season.ts:447`). The passbook calls a simulated sale "Sale slip read" (`passbook.tsx:23`).

**Advocate.** The passbook waterfall (`passbook.tsx:29-75`) makes the gross-to-net path readable, which is a good base for "paid vs owed".

**Skeptic.**
- **What farmers fear most is not being paid.** Late payment and short payment hurt more than a ₹300 hamali overcharge, and there is no tracking or reminder.
- **Legal point to verify:** Maharashtra's APMC rules are understood to require prompt payment to the farmer, often same day. A record of "sold on X, paid on Y" is exactly the evidence the FPO or APMC needs.
- **Collective sales need a ledger.** An FPO sale needs a split: the FPO's receipt, each farmer's share by kg and grade, and FPO deductions. Nothing models it.
- **Tax points to verify** (details from memory):
  - Fresh fruit is understood to be GST-exempt, and commission agents' services for agricultural produce are understood to be exempt.
  - Large buyers may deduct TDS under Section 194Q when buying from an FPO company above the threshold.
  - The FPO's own income tax position (for example Section 80PA) needs advice.
  - None of this concerns the individual farmer's arithmetic, but the FPO admin needs it.
- **Cash leaves no trail.** Cash payments with no record mean a later dispute has no evidence.
- **The "verified" stamp on a simulated sale is a provenance lie.** For an enrolled farmer it would show a sale that never happened as stamped.

**Verdict: FAILS** (not built).

**Fix (tailored).**
- **Payment events** (M): `payment {sale, amount, mode: upi|cash|cheque|advance-adjust, on}` and `sale.dueOn`.
  - The phone shows "owed ₹X, 23 days" with a one-tap "paid today" in Marathi.
  - The FPO sees ageing by agent, aggregated so no single farmer is named to the agent.
  - The UPI screenshot is optional, kept on the phone.
- **Advance (udhaar) ledger** (M): advances from the agent recorded so netting can be checked.
- **FPO collective sale split** (L): one buyer invoice, then pro-rata farmer statements; produce the documents the FPO accountant needs (invoice, TDS certificate reference).
- **Fix provenance** (S): simulated sales `"computed"`, never `"verified"`; passbook says "Simulated sale" (`season.ts:447`, `passbook.tsx:23`).

**Gap.** No payment tracking (paid, due, late, cash, advances), no FPO collective-sale ledger, and simulated sales stamped "verified". **S2, NEW (M-8).**

---

## Scenario 8 · Export: 60-day copper PHI from logged sprays

**Situation.** An exporter buys Sunita's P3 lot on the passport's "Export PHI clear". The residue test fails, because she sprayed copper oxychloride 40 days before picking and logged it as a "preventive" spray on the wrong date, or didn't log it.

**Walkthrough.**
- `EXPORT_PHI_DAYS = 60` (`rules.ts:27`). The check counts all sprays in the window, including washed-off ones (`lot.ts:48-53`).
- The two-option entry (`events.ts:31`) maps any copper product onto Copper hydroxide 77% WP or Bordeaux 1% (`rules.ts:10-21`). The passport shows the mapped name, not what was sprayed.
- A late correction is a later event in the same slot (`events.ts:117`). The original stays in the chain but not on the passport.

**Advocate.**
- Counting washed-off sprays is correct: residue stays on the fruit.
- Saying "a picking from X would clear it" is actionable.
- The page refuses to call itself a certificate.

**Skeptic.**
- **The product is mislabelled by construction.** The farmer sprayed copper oxychloride, the passport says copper hydroxide. Non-copper molecules can't be logged at all.
- **The farmer's own records may not be trusted.** Exporters already require AnarNet farm registration and lab tests. They will trust the lab, not the farmer's own record. The passport's value is as a pre-screen and a diary, not as proof.
- **Liability on rejection.** If an exporter rejects a container and blames "the KhetKundli passport said clear", there are no terms, no disclaimer acknowledged by the buyer, and no signature. G-O3 (no terms) is relevant.
- **A missed log is invisible**, as in Scenario 4.

**Verdict: PARTLY.** The logic is right and honestly labelled, but the data model can't represent real spray practice.

**Fix (tailored).**
- **Free product entry from the FPO's product list** (M), each with an active ingredient, a PHI from the label or APEDA plan, and a photo of the bottle (kept on the phone).
- **"Diary complete" confirmation and a three-state check** (S, as in Scenario 4).
- **An export-readiness view for the FPO** (M): lots per farmer with "clear by the record", "unknown" and "inside PHI", plus a lab-test status field. The FPO then decides which lots to send for testing. That is the real workflow with AnarNet.
- **Buyer terms on the passport page** (S): "This page reports the farmer's own record; residue is established only by a lab test."

**Gap.** The spray log holds only two copper products, so the export check cannot reflect real spray diaries or other molecules. **S1 for export use, NEW (M-5, together with Scenario 4).**

---

## Scenario 9 · Business model: who pays and what it costs

**Situation.** After the pilot, someone must pay for SMS, hosting and the people who answer the phone. Who pays, how much, and for which features?

**Walkthrough.**
- Nothing in the code or docs covers pricing or who pays. A search of `docs/PRODUCT-PLAN.md`, `ROADMAP.md`, `NEXT-STEPS.md` and `CONTEXT.md` finds no business model.
- Cost per message is planned for the delivery service (`docs/PRODUCT-PLAN.md:265`).
- `docs/CONTEXT.md` §11 question 7, "Who owns the product", is open.

**Cost per farmer per season.** These are estimates to check with real quotes.

| Item | Assumption | Cost per farmer per season |
| --- | --- | --- |
| DLT SMS | 30 messages at about ₹0.15–0.25 | ₹5–8 |
| WhatsApp utility templates | 40 messages at about ₹0.12 | about ₹5 |
| OTPs | 6 | about ₹1 |
| Hosting (India region, managed Postgres, backups) | ₹12–20k a month for the pilot | 500 farmers × 8 months: ₹200–300. 10,000 farmers: ₹15–25 |
| Support (FPO coordinator, phone and village visits) | ₹15–20k a month per 300 farmers | ₹400–550 |
| **Total** | | **Pilot: about ₹600–850. At scale: about ₹450–600, mostly people** |

**What the farmer has at stake.** Sunita's 1.5 acres × 4.8 t (`season.ts:89`) at about ₹80–100/kg is about ₹6–7 lakh gross a season.
- 1% of that recovered from patti overcharges is about ₹6,000.
- One copper spray not wasted is ₹500–1,000.
- Blight caught early protects lakhs.

**Who could pay.**

| Payer | Plausibility | What justifies it |
| --- | --- | --- |
| **Farmer, about ₹300–500 a season** | Low on its own. Farmers resist subscriptions, but will pay a share of money recovered | Slip check with FPO recovery ("10% of what we get back"), payment tracking, spray timing |
| **FPO subscription, about ₹50–150k a year per FPO** | **Most plausible core** | Pooled transport savings (₹/crate), collective sale and payment ledger, export-readiness list, fair-slip index for negotiation, impact report for funders |
| **Buyer or exporter fee per verified passport, ₹2–5 a crate** | Medium, only after signed passports, a full spray diary and lab linkage | Pre-screened, traceable, export-ready lots |
| **Government or scheme** (for example a state agriculture department, KVK digital extension, or schemes funding FPO support) | Medium, slow | Blight early warning, water kept, number of farmers reached |
| Input companies or lenders | Rejected: no named lenders (`docs/CONTEXT.md:62`), and a conflict of interest with spray advice | — |

**Skeptic.**
- Support cost dominates, and it is people.
- A free farmer app with an FPO subscription works only if the FPO sees money it can count. Today none of the money features (payments, collective sale, real rate card, transport loop) exists.
- The impact ledger (G-P5) is the sales document, and it is missing.

**Verdict: FAILS** (unaddressed).

**Fix (tailored).**
- **Decide the payer before Phase 3** (people work): an FPO-paid core, a farmer success fee only on recovered money, and a buyer fee later.
- **Add a cost meter to the delivery service** (2.3) and `/status` (S).
- **Build the impact ledger to report ₹ per farmer in the FPO's own terms** (F9, M): ₹ flagged and recovered, ₹/crate transport saved, sprays saved.

**Gap.** No business model, cost model or payer; the features an FPO would pay for (payments, collective sale, transport loop) are unbuilt. **S2, NEW (M-9).**

---

## Scenario 10 (added) · Standing-crop and farm-gate sales

**Situation.** Many Phaltan pomegranate growers sell the whole orchard standing, or at the farm gate, to a trader or exporter's agent for a lump sum or ₹/kg at the orchard. The trader picks, grades and transports; there is no APMC patti.

**Walkthrough.**
- **The model assumes the farmer picks and books.** Simulated pickings are booked on runs to APMCs (`season.ts:356-390`), and market ids are only Phaltan, Pune and Vashi (`rules.ts:95-108`).
- **A farm-gate sale has nowhere to go.** The slip parser defaults `market: "phaltan"` (`patti.ts:100`). There is no "trader at farm" market, and no contract terms (advance received, rate, picking date set by the buyer, rejection allowance).

**Advocate.** The record (sprays, scans, pick dates) is still valuable to a farm-gate buyer, perhaps more than at the APMC: the lot passport helps an exporter's agent decide on the spot.

**Skeptic.**
- **Common disputes are not covered.** Farm-gate deals are often disputed on rejection percentage, delayed picking (fruit over-matures), and payment.
- **The wave and runs miscount.** They treat these lots as pooled-run volume, inflating pooled demand and the APMC supply forecast.

**Verdict: FAILS** (not modelled).

**Fix.**
- A `farm-gate` market and a sale-agreement event (M): buyer name (private), rate basis, advance, agreed picking window, rejection %.
- A pick checklist with the buyer's grade count, signed with OTP by the buyer's agent.
- The run planner excludes these lots.

**Gap.** Farm-gate and standing-crop sales and buyer contracts are not represented, which distorts the wave and runs. **S2, NEW (M-10).**

---

## Scenario 11 (added) · Grade disputes at the market

**Situation.** Sunita grades her lot A at the collection point. The adatiya calls it B and pays B. The app's grade price factors are A 1, B 0.68, C 0.42 (`rules.ts:110`).

**Walkthrough.**
- **Grade comes from the farmer or the simulation.** It comes from her pick entry (`events.ts:33`) or the simulation's infection state (`season.ts:341-342`).
- **The slip check doesn't look at grade.** It reads a grade only if printed (`patti.ts:129-130`) and defaults to A (`patti.ts:339`). The modal comparison is information only (`patti.ts:259-267`).
- **No evidence is captured.** There is no photo or size or colour evidence at packing.

**Skeptic.** Re-grading is a major hidden deduction, often worth more than all charges together, and the slip check is blind to it. A one-grade drop costs 32% of the gross at these factors.

**Verdict: FAILS.**

**Fix.**
- Two packing photos and a crate-sample count by size class at the collection point (M). The volunteer's manifest records the declared grade.
- The slip check flags "slip grade lower than declared grade at loading" as a question, not as money owed.

**Gap.** No grade evidence at packing; re-grading at the market is invisible to the slip check. **S2, NEW (M-11).**

---

## Five cross-cutting findings for markets

1. **Market data leaks today, including to people with no account.**
   - `/api/sync?lot=` streams a plot's whole raw record, slips included, to anyone, unauthenticated and unlimited (`api/sync/route.ts:53-61`, `relay.ts:30-44,241`). Plot ids are guessable and contain the gat number (`season.ts:78`).
   - Every farmer account receives every plot's events (`relay.ts:53`).
   - In the market world, that hands front-running data and agents' complaint records to traders. Fix this before any real farmer is enrolled: a passport JSON endpoint, opaque lot codes, and the projections in 1.3.2.
2. **The simulation writes into the record as if it were the farmer.** Simulated sprays are stamped "human" (`season.ts:236,249`) and simulated sales "verified" (`season.ts:447`). Once real farmers exist, a buyer, an exporter or an agent would read invented facts about a real person. Gate simulation off enrolled plots and fix the inks.
3. **Advice is given without the uncertainty or accountability that money needs.**
   - Perfect-foresight simulated prices and a preselected "best" market (`harvest-date.tsx:112-121`).
   - Live prices shown but unused, under a header that implies they are used.
   - No stored record of the advice given.
   - Everyone gets the same argmax, and the model cannot see herding (`season.ts:321-365`).
4. **The money loop stops at the check.** The slip check, wave and runs all end at a screen. There is:
   - no case management for disputes, and no evidence (the photo is never sent);
   - no payment tracking;
   - no driver or booking loop, manifest or collective sale;
   - no per-farmer harvest event (the harvest choice is a singleton for the hero plot, `events.ts:70`, `authz.ts:94`).
   
   These are exactly the features an FPO would pay for (Scenario 9).
5. **The rules come from the demo, not the FPO or the law.**
   - The rate card is a constant (6%, ₹5, ₹1; `rules.ts:91-93`).
   - Freight is a pooled-run constant.
   - Lawful levies are treated as overcharges.
   - Per-crate rates can produce absurd refund demands (`patti.ts:250-257,270-273,350-357`).
   - The spray log holds two copper products (`events.ts:31`).
   
   Each one can harm the farmer's relationship with her agent or her buyer. Each needs an FPO-owned, versioned configuration (REMAINING 2.7) and an agronomist (G-O1).

---

## NEW gaps, ranked

| Id | Gap | Sev | Evidence | Fix size | Nearest existing item |
| --- | --- | --- | --- | --- | --- |
| **M-1** | Public `/api/sync?lot=` streams a plot's whole raw record (slips with net, agent, aboveCard; entries; retracts; future pickings) with no account and no rate limit; plot ids are guessable and the lot id contains the gat number despite "no gat number" on screen | **S1** | `api/sync/route.ts:46-61`; `relay.ts:30-44,241`; `season.ts:78`; `lot.ts:10`; `lot-passport.tsx:106`; `lot-passports.tsx:33` | S–M | G-B2, G-B5 (not covering anonymous lot streams) |
| **M-2** | Harvest Wave and village crates have no aggregation threshold; no trader or conflict flag; farmer phones can compute per-plot pick plans | **S1** | `village-ledger.tsx:42-52,105`; `harvest-date.tsx:99-110`; `relay.ts:53` | M | REMAINING 1.3.1, 1.3.2 |
| **M-3** | Harvest choice is a singleton for the hero plot; no other farmer can set a picking date or market; no driver, booking acceptance, manifest, cost split, minimum load, no-show handling or damage record for pooled runs | **S1** (for F7) | `events.ts:70,122,129`; `season.ts:88,360,393-436`; `authz.ts:94`; `harvest-date.tsx:87` | M + L | F7 in docs/PRODUCT-PLAN.md (Phase 3) |
| **M-5** | Lot passport and export check: "Export PHI clear" when nothing is logged; spray log limited to two copper products; simulated sprays shown as the farmer's; retractions hidden; no signature binding QR to crates | **S1** (for export and buyers) | `lot.ts:48-54`; `events.ts:31`; `season.ts:221,236,249`; `lot-passport.tsx:22,58-62,85` | S–M | F10; G-O1 |
| **M-6** | Market advice uses perfect-foresight simulated prices even with a live key; live price unused; no uncertainty; preselected "best"; advice not recorded for later accountability | **S1** once real | `harvest-date.tsx:112-126,184-192`; `api/prices/route.ts:10,30`; `events.ts:70` | S–M | G-D8 |
| **M-4** | Slip check flags lawful levies and per-crate rates as money owed (unbounded refund demand); no evidence photo on escalation; no dispute case state; confrontational note; slips visible to other farmers | **S2** | `patti.ts:241-257,270-273,339,350-357`; `slip-check.tsx:224-245`; `inbox.tsx:20-24` | S–M | G-P6, G-D10, REMAINING 2.7 |
| **M-7** | Herding: the same market argmax for every lot; arrivals fixed, so the model cannot see its own effect; scripted glut; no FPO quota or allocation | **S2** | `season.ts:321-327,361-365`; `harvest-date.tsx:120`; `wave-chart.tsx:44` | M | — |
| **M-8** | No payment tracking (due, paid, late, cash, advances); no FPO collective-sale ledger; simulated sales stamped "verified" and called "Sale slip read" | **S2** | `season.ts:447`; `passbook.tsx:23`; `events.ts:36-52` | S (provenance) + M–L | G-P5 (impact), not payments |
| **M-9** | No business model, cost model or named payer; the FPO-payable features are unbuilt | **S2** | docs have no business model; `docs/CONTEXT.md` §11 question 7 | people + S | G-O2 |
| **M-10** | Farm-gate and standing-crop sales and buyer contracts are not represented; they inflate the wave and runs | **S2** | `rules.ts:95-108`; `patti.ts:100`; `season.ts:356-390` | M | — |
| **M-11** | No grade evidence at packing; market re-grading is invisible to the slip check (a one-grade drop is 32% of the gross) | **S2** | `rules.ts:110`; `patti.ts:129-130,339` | M | — |

**Order of work suggested by these findings:**
1. M-1 and the simulation-provenance part of M-5. Both are small, and both must be done before any real farmer is enrolled.
2. M-6's S-sized UI changes: no "best", ranges, an honest header, an advice record.
3. M-2 thresholds, together with 1.3.2.
4. Per-plot harvest events (the M-3 code change), which unblocks F7.
5. The M-4 sanity guards and the FPO rate card (2.7).
6. Payments (M-8), which with the transport loop is the FPO's reason to pay (M-9).
