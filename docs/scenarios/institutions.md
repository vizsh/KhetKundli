# Scenario trial: the institutions (extension officer, FPO coordinator, KVK scientist, taluka officer)

Trial of `main` at `cd03f34` (3 Nov 2026), after Phase 1 slice 2. Nothing was edited or run. Every claim below cites a line in the code. Paths are relative to `web/src/` unless they start with `docs/`.

**Personas**
- **KS**: Krishi Sahayak, the extension officer. About 40 villages and 6,000 farmers, a government laptop, Marathi first, and liable for the advice he gives.
- **FPO**: the FPO coordinator. Runs the desk, enrols farmers, deals with adatiyas and must report to her board.
- **KVK**: the KVK scientist asked to sign off the spray table.
- **TAO**: the taluka agriculture officer, who asks for data and reports.

---

## Scenario 1: Enrolling 150 farmers at a gram sabha in one afternoon

**Situation.** The FPO coordinator sits in the panchayat hall with a laptop and a hotspot, and 150 farmers queue up. Some numbers are mistyped, some farmers have two plots or a plot in joint names, and about a third have no smartphone. Some share one phone with a son.

**Walkthrough with today's code**
- **No enrolment screen or API.** People enter only through `seedDemo`, which inserts four synthetic people when the table is empty (`lib/server/seed.ts:316-321`). `upsertPerson` is called from nowhere else (it is defined at `lib/server/identity.ts:192`). The desk has no "add farmer" control: `components/desk/desk.tsx:64-114` holds the map, the figures, the register and the plot extract.
- **Plots are engine plot indices, not real land.** `person_plots.plot` is an `int` (`lib/server/schema.ts:39-44`) that points at one of the 192 generated plots (`seed.ts:301-313`). A real gat number has nowhere to go.
- **A mistyped number can overwrite someone else.** If a developer script enrolled through `upsertPerson`, a number that matches an existing person runs `on conflict (phone) do update set name = excluded.name, … role = excluded.role` (`identity.ts:197-198`). That person's name, and even their role, would be replaced without a warning. Plot links are only ever added (`identity.ts:202`), so the wrong person also gains a plot.
- **No phone, no record; one phone, one person.** `people.phone` is `not null unique` (`schema.ts:33`). A farmer without a phone cannot be registered, and a husband and wife on one phone cannot both be registered.
- **Joint ownership has a column but no meaning.** `person_plots.relation` defaults to `'owner'` (`schema.ts:42`). Only `owner` is ever read (`identity.ts:187`), and `authz.owns` ignores the relation entirely (`lib/server/authz.ts:37`).
- **Validation is all or nothing.** `normalizePhone` accepts any 10-digit number starting 6–9 (`identity.ts:133-138`). It cannot tell 98xxxxxx12 from 98xxxxxx21, and there is no confirmation step such as sending a code to the new number before saving.

**Advocate.** The identity model is sound underneath. Each person has a role and plots, sessions are per device, and `upsertPerson` is idempotent by phone, so the same farmer enrolled twice is not duplicated. That is the right base for an FPO enrolment screen.

**Skeptic**
- The afternoon cannot happen at all; the coordinator goes home with a paper list.
- If someone wires `upsertPerson` up quickly, one mistyped digit silently renames an existing farmer and gives her someone else's plot.
- Farmers without phones (about 30% are SMS-only in the simulation, `lib/sim/people.ts:27`) and joint holders cannot be represented. The FPO's real membership register will not match the app.
- Combined with Scenario 10: the moment 150 real people are in the table while codes are still shown on screen, `/api/v1/auth/me` lists all of them publicly (see O-1).

**Verdict: FAILS.**

**Fix for the FPO**
- An "Enrol" sheet on the desk, Marathi first:
  - Name in Marathi and English, village, gat number, area, bahar date.
  - Phone, typed twice.
  - A household or "no phone, reached through" field, plus a co-holder relation.
- The server sends a code to the new number and only links it when the code comes back, or marks the farmer "unverified, SMS only".
- An offline queue so enrolment works with no signal in the hall.
- Split `upsertPerson` into `create` (fails on a duplicate phone and shows "this number belongs to X") and `update` (explicit, audited).
- A `farmers` table separate from `phones` (one phone to many people, a person with no phone), and a `plots` table keyed by village and gat.
- Where: `lib/server/identity.ts`, a new `app/api/v1/enrol/route.ts`, a new `components/desk/enrol.tsx`.
- Size: **L**.

**Gaps**
- No enrolment: S1. Already logged as G-P2 and REMAINING 2.5.
- Phone-unique identity (no phoneless farmers, no shared phone): S1. Partly G-P1 and REMAINING 1.3.7.
- `upsertPerson` silently overwrites a person's name and role on a phone collision: S1. **NEW (O-7)**.

---

## Scenario 2: Monday morning, 60 escalations in the inbox

**Situation.** Over the weekend 60 questions arrived, in Marathi and English. Some are duplicates, a few are urgent blight reports, and some are off-topic (crop loans, PM-Kisan instalments). The officer has one hour before a meeting. Next month he goes on leave and a new officer takes over.

**Walkthrough with today's code**
- **The inbox is one undifferentiated list.**
  - `Inbox` maps every escalation into an `Item` (`components/desk/inbox.tsx:388-403`), loaded newest first with a hard limit of 200 (`lib/server/relay.ts:140-146`). The oldest, most overdue question sits at the bottom.
  - There is no filter, search, priority, status other than Open or Answered (`inbox.tsx:327`), assignee or due time.
  - The `Escalation` type has no such fields (`lib/channel.ts:4-16`), and the `escalations` table has none either (`schema.ts:84-93`).
- **Off-topic questions are flagged but not routed.** The agent sets `escalate` for out-of-scope questions (`lib/agent/agent.ts:69`, `agent.ts:161`). Nothing tags them as "not ours, refer to the bank or the PM-Kisan helpdesk"; they sit in the same list.
- **Drafting is slow and in English.**
  - "Draft with the agent" is one item at a time and takes 5–15 s each (`inbox.tsx:347-363`, `docs/AGENTS.md`). That is roughly 10 minutes for 60, if the officer clicks each one.
  - The draft is English only: Marathi is produced only for `audience === "farmer"` (`agent.ts:236`), and the draft joins the English headline and steps (`inbox.tsx:305`).
  - The three quick replies are English (`inbox.tsx:286-290`), and one hard-codes a copper dose.
  - A Marathi-speaking farmer therefore gets an English reply unless the officer types Marathi himself.
- **The reply is not checked, and a second reply overwrites the first.**
  - The officer's free text is sent unchecked; the guard is never applied to replies.
  - The relay stores the reply with `update escalations set reply = $2 … where id = $1` and no `and reply is null` (`relay.ts:218-222`). A second officer answering the same question overwrites the first answer. The farmer receives both broadcasts, but the record keeps only the last.
- **Duplicates are not merged.** Each question is its own row. A question can even be dropped silently: ids are `Q${Date.now().toString(36)}` (`lib/store.ts:250`) and the insert is `on conflict (id) do nothing` (`relay.ts:216`), so two phones escalating in the same millisecond lose one question.
- **Leave, handover and visibility.**
  - Every staff member sees every plot's inbox (`relay.ts:47`, `143-145`). There is no jurisdiction: an officer for 40 villages sees all, and so does the FPO.
  - There is no "assigned to" and no out-of-office.
  - `replied_by` is stored (`relay.ts:220`) but the reply shows only `by: actor.person.name` (`relay.ts:219`), and the inbox never shows who answered.
  - A new officer is a new person row, which cannot be created (Scenario 1).

**Advocate**
- Each question arrives with the plot and the last five record entries attached (`store.ts:245-248`, shown at `inbox.tsx:331`), so the officer answers from facts.
- Agent drafts cite the record and pass the guard.
- Replies reach the right farmer only (`relay.ts:50-51`).
- For a few questions a day this is a good console.

**Skeptic**
- At 60 a morning it is a scroll with no triage. An urgent blight report from Taradgaon sits beside a PM-Kisan query, with no "urgent" flag and no SLA clock.
- English drafts break "Marathi first".
- Silent overwrite of replies means the record of what the government told the farmer can change after the fact. That is a liability problem for the officer.
- With no assignment, two staff answer the same question differently, or nobody answers it.

**Verdict: PARTLY** (it works for a demo load; it fails at Monday scale).

**Fix for the officer**
- Inbox triage:
  - Status: open, drafted, sent, referred, closed as duplicate.
  - Priority set automatically by the router (blight and scan reports first; `other` goes to a "Refer" tray with ready Marathi referral texts for bank, PM-Kisan and tehsil).
  - Village and assignee filters, and an age badge with a 24 h SLA.
  - Oldest first within each priority.
  - "Merge duplicate", and bulk "Draft all".
- A Marathi draft for officers: drop the `audience === "farmer"` condition at `agent.ts:236`, and make quick replies bilingual.
- Run the guard on officer free text as a warning, not a block.
- Make the reply append-only (`reply is null`, or a `replies` table), and show `replied_by`.
- Use server-generated question ids (UUIDv7).
- Size: **M**.

**Gaps**
- Inbox has no triage, priority, SLA, assignment, Marathi drafts or duplicate merge: S2. **NEW (O-13)**. G-P4 and REMAINING 2.8 cover only ratings and a review queue.
- Reply overwrite and unguarded free text: S2. **NEW (part of O-13)**.
- Question id collision drops a question: S3. **NEW (O-19)**.

---

## Scenario 3: Evening advisory to 200 plots

**Situation.** At 6 pm the 72-hour forecast says to warn about 200 plots. The officer is unsure.
- A false alarm costs every farmer a copper spray, and resets the 60-day export interval for anyone near harvest.
- A missed alarm can cost a whole orchard.
- He wants to send to some plots, not others, never send twice, and correct a mistake.

**Walkthrough with today's code**
- **There are two ways to send, and only one is reviewed.**
  - **Reviewed path:** the Advisories tab.
    - "Prepare tonight's batch" asks the server to select plots (`components/desk/advisories.tsx:151-162`, `app/api/agent/advisories/route.ts:19-28`).
    - It lists them with checkboxes (`advisories.tsx:222-244`) and previews **one** message: the demo plot's, or the first (`advisories.tsx:177`, `214-220`).
    - "Approve and send N" sends by batch id (`advisories.tsx:163-173`, `relay.ts:104-121`).
  - **One-click path:** the forecast's **"Warn N plots"** stamp (`components/desk/forecast.tsx:288-302`) calls `warnCells`. That records an `advisory` event, then immediately prepares and sends a batch with no list, no preview and no confirmation (`lib/store.ts:162-173`). This contradicts the promise "Nothing is sent without the officer's approval" (`advisories.tsx:129-132`).
- **The officer cannot see why each plot was chosen.**
  - Selection is "cell at risk ≥2, not infected, not sprayed in 10 days" (`lib/agent/pipelines.ts:103-110`).
  - Each advisory carries `facts` (`pipelines.ts:120`), but the console row shows only farmer, plot, village and channel (`advisories.tsx:228-241`). There is no "why", no distance to the source and no export status.
- **Plots near harvest are not protected.**
  - Selection ignores crop stage and the export pre-harvest interval, even though `export_check` exists in `lib/agent/tools.ts:216-222` and `EXPORT_PHI_DAYS = 60` in `lib/sim/rules.ts:27`.
  - A plot 20 days from an export picking is told to spray Bordeaux, and nothing warns that this costs the export grade.
- **The guard result does not stop a send.** It is computed per message (`pipelines.ts:125`) and shown as "check the messages" (`advisories.tsx:211`), but the send button is enabled regardless (`advisories.tsx:264`).
- **Sending twice is easy.**
  - A second send of the same batch gets a 409 (`relay.ts:107-111`).
  - But "Prepare again" makes a new batch, and nothing filters plots already advised today. The selection checks only sprays (`pipelines.ts:109`).
  - The radar path and the forecast path can both fire on the same evening. The same 200 farmers get two SMS.
- **The record keeps only one advisory per day.** `foldEvents` keeps one advisory per day: `advisories.set(e.day, e.hexes)` (`lib/events.ts:120`). A second warning on the same day replaces the first one's cells in the season projection, and the forecast's "Advisory sent" check is per day (`forecast.tsx:220`).
- **A sent advisory cannot be recalled or corrected.** `SyncMsg` has no recall, correction or follow-up kind (`lib/channel.ts:48-57`). The only message the pipeline can compose is "blight near X, spray Bordeaux" (`pipelines.ts:123-124`). There is no "ignore yesterday's message" template.
- **An advisory changes the plots' records.** In the engine, an advisory event **books simulated preventive sprays** on the advised plots: all app users, and 45% of the others (`lib/sim/season.ts:206-215`). From then on the record shows sprays that nobody logged.

**Advocate**
- The reviewed path is well designed:
  - The server, not the client, decides who is warned (`advisories/route.ts:18-19`).
  - The text sent is exactly the text prepared (`relay.ts:93-121`).
  - A double click cannot double-send one batch.
  - Unticking works.
  - Receipts per farmer are visible.
  - Messages are bilingual and come from reviewed templates.

**Skeptic**
- The biggest button on the desk ("Warn 200 plots") bypasses the officer's review.
- The officer cannot see evidence per plot, so unticking is guesswork.
- Export growers can be pushed into an unnecessary copper spray that costs them the export grade, with the officer's name on it. In the database it is `sent_by` (`relay.ts:107`); in the farmer's eyes it is "the government said".
- There is no recall when he realises at 9 pm that the source scan was wrong (Scenario 4).
- Duplicate SMS will cost money on DLT and will train farmers to ignore warnings.
- Simulated sprays written after an advisory mean the season record no longer shows what farmers actually did.

**Verdict: PARTLY** (the console is good; the one-click path, the missing export check and the missing recall are unsafe for a real taluka).

**Fix for the officer**
- Remove the immediate send from `warnCells` (`store.ts:166-172`). The forecast stamp should open the Advisories tab pre-filled with the cells.
- Show per-plot "why" (source scan, km, wind, ensemble %) and a red "export picking in N days: copper resets the 60-day interval" badge from `export_check`. Default those rows to unticked.
- Exclude plots advised in the last N days, and show "already warned at 18:05 by …".
- Block sending while any message fails the guard.
- Add a **follow-up / correction** message kind ("Ignore the 3 Nov warning: lab result negative"), sent to exactly the recipients of batch X and linked to it.
- Make the advisory event additive (key by batch id, not day) at `events.ts:120`.
- Stop `season.ts:206-215` from booking sprays on any plot that has a real owner.
- Size: **M**.

**Gaps**
- One-click forecast warning bypasses review: S1. **NEW (O-3)**.
- No recall or correction; a same-day advisory overwrites the earlier one in the fold: S1. **NEW (O-4)**.
- Selection ignores the export interval, stage and earlier advisories; no per-plot evidence; the guard does not block a send: S1. **NEW (O-8)**.
- Advisory books simulated sprays into records: S1 for real plots. **NEW (O-6)**, partly G-B2 and G-D1.

---

## Scenario 4: The wrong-diagnosis chain

**Situation.** A farmer's Scan Lens says bacterial blight. It is really a fungal leaf spot. Her neighbours get warned and spray copper. The officer has to verify, and to explain afterwards who decided what.

**Walkthrough with today's code**
- **The scan does not record what the model saw.** A `scan` event carries plot, day, confidence and offline, but **no finding or class** (`lib/events.ts:66`).
- **The simulation decides the diagnosis.** In the engine, a scan counts as blight **only if the simulated plot is infected**; otherwise it is recorded as "healthy" (`lib/sim/season.ts:190-196`). For a real farmer whose phone said blight, the record will say healthy or blight according to a random simulation, not the photo.
- **One scan puts its cell on warning.** A blight scan in a cell gives `own = 1`, multiplied by at least 0.6 for weather (`season.ts:496-509`). That is ≥ 0.55, so the cell is at risk 2, "warning", on the day of the scan, and the radar batch then selects every plot in the cell (`pipelines.ts:107`).
- **Neighbours are warned automatically in the record.** On a detection, the engine itself writes advisories to up to 8 app-using neighbours within 2.5 km and books preventive sprays (`season.ts:150-160`, `WARN_KM` at `season.ts:28`), with no officer step.
- **"Verified" means something else.** The `verified` provenance is given to simulated detections on **non-app** farmers (`season.ts:202`), and the register shows it as a "Read" stamp (`components/desk/register.tsx:148`). No code path lets an officer or the KVK mark a scan verified or refuted.
- **The only correction is a retract.** Staff may retract any event (`lib/server/authz.ts:99-101`). That removes the scan from the fold. The radar recomputes, but the advisories already sent stay sent, with no follow-up (Scenario 3).
- **Liability chain.** Who sent the advisory is in `advisory_batches.sent_by` (`relay.ts:107`). Which scan triggered it is not stored with the batch: `saveBatch` stores plot, text and channel only (`relay.ts:94-97`, `advisories/route.ts:26`).

**Advocate**
- The architecture can support this. Retracting the scan is an append-only event (`events.ts:71-72`), so the record shows both the report and its withdrawal, hash-chained.
- The guard keeps the agent from inventing a different chemical.
- `docs/GAPS.md` G-D3 and G-D4 are honest that the model is not field-validated.

**Skeptic**
- The diagnosis in the official record is produced by the simulation, not by the camera, the farmer or the officer. That is indefensible if challenged.
- One unverified phone scan, from a model with 99.7% accuracy on a random split of one public dataset (G-D3), immediately turns a cell to "warning" and triggers automatic neighbour advisories.
- The "verified" stamp suggests a person checked it when nobody did.
- The officer has no "Verify / Refute / Needs field visit" step, no photo to look at (photos stay on the phone by design, `docs/CONTEXT.md` §5), and no link from batch to source.
- The table has no fungal-spot entry, so even a correct fungal diagnosis cannot produce correct advice.

**Verdict: FAILS.**

**Fix for the officer and the KVK**
- Add `finding`, `model` and `modelVersion` to the scan event.
- Add a new `verdict` event: confirmed or refuted by a person, with method (field visit, photo, lab) and role. Only **confirmed** reports raise a cell above "watch".
- Unverified scans show as "reported, unverified" on the radar. Separate the stamp ink: "verified" means a person with a role confirmed it.
- Optionally the farmer can choose to share the scan photo with the officer.
- Store `sourceEvents` with each batch.
- Remove automatic neighbour advisories (`season.ts:150-160`) for real plots.
- Where: `lib/events.ts`, `lib/sim/season.ts`, `lib/server/authz.ts`, a new "Reports to verify" tray in `components/desk/register.tsx`.
- Size: **M**.

**Gaps**
- Scan diagnosis is decided by the simulation; no finding, no verify or refute; one scan means warning; "verified" is mislabelled: S1. **NEW (O-2)**. Related: G-D3 and G-D4 (model quality), not this workflow.

---

## Scenario 5: The agronomist reviews the spray table

**Situation.** The KVK scientist is asked to sign the spray table. She checks:
- label claims (CIB&RC registration for pomegranate and this target)
- dose units and Bordeaux preparation
- intervals
- banned products
- what happens when the farmer buys a different brand.

She asks how she changes it.

**Walkthrough with today's code**
- **The whole table is two entries in a TypeScript constant.**
  - Curative: "Copper hydroxide 77% WP, 2 g per litre".
  - Preventive: "Bordeaux mixture 1%, 10 g copper sulphate + 10 g lime per litre, freshly prepared".
  - Source: `lib/sim/rules.ts:10-21`. The source string says "not yet reviewed by an agronomist; follow the product label" (`rules.ts:29`).
- **Gaps she will see in the table:**
  - No registration number, no target pest on the label, no spray volume per tree or per acre, no maximum number of sprays.
  - No interval: "15 days" is hard-coded in the tool (`lib/agent/tools.ts:128`).
  - No Bordeaux method (dissolve separately, add sulphate to lime, neutralisation test, use the same day).
  - No PPE or re-entry advice, no other diseases, and no brand mapping.
  - The evening SMS says "Spray Bordeaux mixture 1%" with no dose or preparation (`pipelines.ts:123-124`).
- **The guard's "banned" list.** `BANNED` blocks streptocycline, antibiotics, bronopol, **carbendazim, mancozeb, imidacloprid, chlorpyrifos** (`lib/agent/guard.ts:125`). Several of these are registered in India. The check is named "No banned or unreviewed chemicals" (`guard.ts:145`), so the list mixes legal status with "not reviewed". She cannot add a product for fungal spot without a developer.
- **Different brands.** The product pattern recognises "Kocide" and "Blitox" (`guard.ts:126`). A brand the farmer bought is rejected unless it appears in the evidence. The farmer's own log records only `spray: "preventive" | "curative"`-style kinds (`store.ts:228`), not the brand or the dose actually used.
- **Changing the table needs a developer.** It means editing `rules.ts`, rebuilding and redeploying. Messages do not record which version of the table produced them: a `FarmMessage` holds text only (`relay.ts:114-117`).

**Advocate**
- Putting doses in one fixed table that no model can override (`guard.ts:135-170`, `docs/AGENTS.md` stage 5) is exactly what a liable scientist wants.
- The provenance string and the removal of Streptocycline show care.
- The 60-day copper export interval is modelled.

**Skeptic**
- She cannot sign a TypeScript file. There is no review record (who, when, which version), no versioning tied to messages, and no way for her to edit it.
- The SMS that actually reaches farmers has no dose, so farmers will mix Bordeaux by habit.
- Calling registered products "banned" in the guard is factually wrong and could embarrass the KVK.
- The officer's quick reply hard-codes the curative dose in English (`components/desk/inbox.tsx:287`), and the officer's free text is unguarded, so the "only from the table" promise holds only for the agent.

**Verdict: PARTLY** (safe in principle, not reviewable or changeable by the person who must sign it).

**Fix for the KVK**
- Move the table to a versioned `spray_table` (data, not code). Each row holds:
  - target disease, product, CIB&RC registration ref, dose and unit, water volume, interval, maximum sprays, PHI
  - Marathi preparation steps, PPE, an allowed-brands list
  - status (draft, approved) with `approved_by` and `approved_at`.
- A read-only "Spray table" page for the KVK with "Approve version N". The guard and the pipelines read the approved version, and every message stores `tableVersion`.
- Split `BANNED` into `banned` (with gazette reference) and `not_in_table`.
- Size: **M**.

**Gaps**
- No agronomist review: S1. Already G-O1.
- Spray table is code: no versioning, approval, interval, preparation or brands; the guard's "banned" list is wrong; the SMS has no dose: S2. **NEW (O-16)**.

---

## Scenario 6: Proving value to the FPO board after one season

**Situation.** The coordinator must justify the subscription to a board of farmers. They will ask: what did it save, how many were warned in time, and did slips get corrected?

**Walkthrough with today's code**
- **Everything on the desk is labelled simulated.**
  - Blight figures: "Built from scans reported in the simulated network" (`components/desk/figure-sheet.tsx:105`).
  - Picking wave, groundwater kept and pooled runs: simulated stamps (`figure-sheet.tsx:130`, `154`, `186`).
  - The map footer: "plots and events simulated" (`components/desk/desk.tsx:100`).
  - The register: "Entries from the simulated network" (`components/desk/register.tsx:105`).
- **What is real today:**
  - Counts of messages, deliveries and reads, people, sessions and agent answers (`app/api/status/route.ts:21-28`).
  - Sunita's own logged entries (`docs/CONTEXT.md` §7).
- **Even the real counts mislead.** For every plot without an account, "delivered" and "read" come from a random-timer simulator (`app/api/messages/route.ts:65-80`), marked only by a 10.5 px "sim" (`components/desk/advisories.tsx:238`).
- **Real and simulated are mixed in each plot's record.** The water-saved figure (`figure-sheet.tsx:150`) comes from `season.waterSavedByDay`, which is simulated. Advisories book simulated sprays (`season.ts:206-215`).
- **Nothing can be taken to the meeting.** There is no export, CSV, PDF or print view anywhere on the desk; a search for csv, download or print finds only the farmer share card.

**Advocate**
- The labelling is honest. The coordinator will not accidentally present simulated litres as real, because every figure carries a SIMULATED stamp.
- The event store and hash chain are the right base for an impact ledger whose every number traces back to events (PRODUCT-PLAN F9).

**Skeptic**
- After a season she can show essentially nothing real: no baseline, no "sprays saved", no "₹ flagged on slips and recovered", no time-to-warning.
- The one real-looking number, messages delivered, is inflated by simulated receipts.
- No export means screenshots.
- The board will see "SIMULATED" on every chart and ask why they are paying.

**Verdict: FAILS** (expected at this stage, but it is the question the coordinator will actually face).

**Fix for the FPO**
- Before the pilot: a baseline survey form (sprays per season, washouts, slips disputed).
- An impact ledger page with three columns: Real (from logged events), Modelled, Simulated. Each number has a "how computed" drill-down to event ids.
- An exportable one-page Marathi PDF and a CSV per village.
- Count only real receipts in "delivered".
- Size: **L**.

**Gaps**
- No impact ledger or report: S1. Already G-P5 and REMAINING 3.1.
- Simulated receipts presented as delivery: S1 for a pilot. **NEW (O-9)**, partly G-C1 and G-B11.
- No export or report of any desk data: S2. **NEW (O-14)**.

---

## Scenario 7: Data requests (taluka officer, pesticide company, journalist, a farmer's erasure request)

**Situation**
- The taluka officer wants "all farmers with blight and their phone numbers".
- A pesticide company asks for the data.
- A journalist asks for figures.
- A farmer says "delete my data".
- All of this falls under the DPDP Act 2023 and the DPDP Rules 2025.

**Walkthrough with today's code**
- **No export path exists**, so today nobody can fulfil any request except by querying the database by hand. Anyone with laptop access can read `web/data/pg` and plain-JSON backups that contain `people` with phone numbers, `sessions` and `auth_log` (`lib/server/backup.ts:20`, `52-55`, `65`).
- **The bigger exposure is public.** While codes are shown on screen, the unauthenticated `GET /api/v1/auth/me` returns **every registered person's phone, name and role** (`app/api/v1/auth/me/route.ts:13-15`, through `identity.people()` at `lib/server/identity.ts:180-183`). This is not limited to the demo people. The first time real farmers are enrolled, the sign-in page publishes the member list.
- **No consent, purpose or request log.** There is no consent, no purpose register, and no log of data requests (G-B5, G-O3).
- **Erasure is blocked by design.**
  - The season record is append-only (`lib/server/schema.ts:20-28`), and event labels contain farmers' names, for example "`${who} logged …`" (`lib/store.ts:229`).
  - Slips hold the agent's name and patti number (`lib/events.ts:47-48`).
  - Escalations store the question text with `person_id` (`relay.ts:216`).
  - The agent log of questions sits in SQLite, outside backups and outside any erasure path (`docs/REMAINING.md` 1.3.3, `app/api/status/route.ts:34`).
  - So "delete my data" cannot be honoured. Crypto-shredding is planned (REMAINING 2.6) but labels written as free text in hashed rows would survive it.
- **No disclosure rule.** No code distinguishes the taluka officer (a government statistical request, which should get aggregates) from a commercial request (which should be refused without consent).

**Advocate**
- The design intent is right: shared maps aggregate to H3 cells (`docs/CONTEXT.md` §5), photos and slips stay on the phone, and consent per purpose with crypto-shredding is planned (`docs/PRODUCT-PLAN.md:172`).
- The OTP form deliberately does not reveal whether a number is registered (`identity.ts:114-115`).

**Skeptic**
- `/api/v1/auth/me` defeats that non-disclosure entirely.
- Without a fiduciary, notice, consent or request log, the FPO is in breach from the first enrolment.
- A taluka officer's request for names and phones would most likely be met by someone copying the backup JSON.
- Names inside hash-chained labels make the right to erasure technically impossible without breaking the chain.

**Verdict: FAILS.**

**Fix for the FPO as data fiduciary**
- Immediately: `me/route.ts` returns `DEMO_PHONES` only, and only when `KHETKUNDLI_SEED_DEMO !== "0"`. Never `people()`.
- Event labels carry no personal data: a person id in place of the name, with the name resolved at display.
- Personal fields encrypted per person (crypto-shredding).
- A "Data requests" register on the desk: requester, purpose, legal basis, decision, what was released, who approved.
- An aggregate-only export for the government (village by week, k-anonymity of 5 or more).
- A farmer "my data / delete" flow.
- Size: **L**. The `me` route fix alone is **S**.

**Gaps**
- `/api/v1/auth/me` publishes every registered person: S1. **NEW (O-1)**.
- No data-request handling; names in append-only labels block erasure: S1. **NEW (O-11)**, partly G-B5, G-O3 and REMAINING 2.6.

---

## Scenario 8: Staff turnover and access

**Situation.** The officer is transferred and a new one joins. The FPO shares one desk login "to save time". The board asks who sent the 3 November warning. The FPO admin and the officer should have different powers.

**Walkthrough with today's code**
- **The two staff roles are identical.** `officer` and `fpo_admin` are treated alike for every action, including `reset` and `backup` (`lib/server/authz.ts:35-36`, `55-64`), and both may record `rain` and `reset` events and retract anyone's events (`authz.ts:95-101`). There is no admin-only power (staff management, table approval) and no officer-only power (advice).
- **No offboarding.** There is no deactivate, no role change other than the overwriting upsert, and no "revoke all sessions of person X". `revoke` revokes only the presented token (`identity.ts:276-279`), and sessions last 30 days (`identity.ts:128`). The departed officer's laptop session keeps working for a month. His number stays registered, so with codes on screen anyone who knows it can sign in as him.
- **Shared desk login.** Nothing prevents it. Every action would record the same `person_id`.
- **The audit trail exists only in the database and is incomplete.**
  - Recorded: `advisory_batches.created_by` and `sent_by` (`schema.ts:98-102`), `escalations.replied_by` (`schema.ts:91`), `season_events.person_id` (`schema.ts:81`), and `auth_log` (`schema.ts:71-79`).
  - There is no screen to read any of it.
  - **Reset hard-deletes** messages, batches and escalations (`lib/server/relay.ts:228-232`), so "who sent what" can be erased by either staff role in one click.

**Advocate**
- The bones are there: per-person sessions, an author on every event and batch, and `auth_log` of sign-ins and failures.
- Session tokens are stored only as hashes, and the authorisation matrix is tested (`authz.test.ts`).

**Skeptic**
- Offboarding is impossible.
- A coordinator who presses Reset during a dispute wipes the evidence of what was advised.
- There is no jurisdiction. An officer for one circle sees all of Phaltan, and two FPOs in one taluka would see each other's members.
- The policy says "Resets and backups are for the FPO admin and the officer" (`authz.ts:12`). Nobody has thought about separation of duties.

**Verdict: FAILS.**

**Fix for the FPO**
- A "Staff" page for `fpo_admin`: add, deactivate (which revokes all sessions), change role, assign villages.
- Scope staff visibility by village in `relay.visible` (`relay.ts:47`) and in `inboxFor` and `messagesFor`.
- Split the powers:
  - FPO admin: staff, backups, enrolment.
  - Officer: advisories and replies.
  - KVK: spray table approval.
  - Nobody in production: reset.
- An "Activity log" page reading `sent_by`, `replied_by`, retractions and `auth_log`.
- Shorter desk sessions (8–12 h) with re-authentication before sending.
- Size: **M**.

**Gaps**
- No staff lifecycle, jurisdiction or separation of duties: S2. **NEW (O-12)**. G-P6 lists "staff" in passing.
- Reset deletes advisory and inbox history: S1. **NEW (O-5)**. REMAINING §5 lists Reset as a demo limitation, not the audit loss.
- No audit viewer: S2. **NEW (part of O-14)**.

---

## Scenario 9: Server problems during the monsoon peak

**Situation.** It is late September, peak blight weather. The FPO office laptop is off for two days (no power, the coordinator travelling). Then the disk shows errors.

**Walkthrough with today's code**
- **Everything runs on one machine.** One Next.js process, embedded Postgres in `web/data/pg` (`lib/server/sql.ts:51-56`), and live connections held in `globalThis` (`lib/server/relay.ts:17-23`).
- **Laptop off means no service.** No desk, no advisories, no agent answers, no sign-in.
- **Phones keep their work.** They queue events and escalations in the IndexedDB outbox and retry every 8 s (`lib/sync.tsx:122`), so their records survive. But the farmer gets no answer and no warning for two days.
- **Simulated receipts are lost.** Their timers die with the process (`app/api/messages/route.ts:70-79`, G-B11).
- **The phones cannot reach the laptop from the villages anyway.** `npm run demo` serves the laptop over Wi-Fi (`docs/CONTEXT.md` §9). A phone 20 km away cannot reach a LAN laptop. Real field use needs hosting (G-T6).
- **Backups are manual and on the same disk.**
  - They run only when someone clicks "Back up now and drill" on `/status` (`components/status-board.tsx:300-329`, `app/api/v1/admin/backup/route.ts:28-38`).
  - They are written to `web/data/backups` on the same disk (`lib/server/backup.ts:65`), as unencrypted JSON lines including phone numbers and session hashes (`backup.ts:20`).
  - The SQLite agent log and saved forecasts are excluded (REMAINING 1.3.3).
- **There is no real restore.** `restoreDrill` restores into a throwaway database (`backup.ts:120`). `restoreInto` exists (`backup.ts:99`) but no script or route restores the live database (`scripts/` has `restore-drill.mts` only).

**Advocate**
- Offline-first phones and the idempotent, exactly-once event store (crash test, REMAINING log) mean an outage loses no farmer data.
- The restore drill really proves a backup is complete, which most small systems never check.

**Skeptic**
- When the disk fails, the database and every backup go with it.
- Nobody at the FPO will remember to click a backup button in the monsoon.
- There is no alert when the server is down; `/status` is a page you must open (G-B13).
- For two days of peak blight the whole taluka has no warnings, and the officer will not know.
- Unencrypted backups on a shared office laptop are a data-protection breach waiting to happen.

**Verdict: FAILS** for a real deployment (fine for a demo).

**Fix for the FPO**
- Hosted primary in an India region (REMAINING 2.11). Keep the laptop as a venue kit.
- Nightly scheduled encrypted backups copied off the machine (object storage, or at least a USB drive with a reminder).
- `npm run restore -- <dir>` with a confirmation prompt, and a written restore runbook.
- An uptime check that SMSes the coordinator.
- A "desk offline" banner on phones: "officer desk unreachable since …; for an emergency call …".
- Size: **M**.

**Gaps**
- Single process and no hosting: S2. Already G-B6, G-T6 and REMAINING 2.11.
- Backups manual, on the same disk, unencrypted, no live restore command, agent log excluded: S2. **NEW (O-15)**, partly G-B7 and REMAINING 1.3.3.
- No monitoring or alerting: S2. Already G-B13.

---

## Scenario 10: Demo controls, the demo people and the on-screen code in a real deployment

**Situation.** The pilot goes live on the same build. The desk still shows "Demo inputs: Sunita scans a leaf, Rain forecast in 18 h, Open Sunita's phone, Reset". The sign-in sheet lists people and shows the code.

**Walkthrough with today's code**
- **The demo panel is always on the desk.** It renders unconditionally (`components/desk/desk.tsx:88-96`, `components/desk/map-furniture.tsx:227-263`).
- **"Rain forecast in 18 h" changes everyone's weather.** It records a `rain` event (`lib/store.ts:207-210`). The engine then overwrites the next day's weather with 18 mm, an 88% chance and 14 wet hours (`lib/sim/season.ts:50-54`) **for everyone**: the agent, the advisory pipeline and every phone. A stray click makes the taluka-wide spray window and blight risk false.
- **"Sunita scans a leaf" writes a scan** to her real record (`store.ts:198-205`).
- **Reset** records a reset event, so the folded season starts empty, and hard-deletes the inbox and messages (`store.ts:214-219`, `relay.ts:226-233`). Either staff role can press it (`authz.ts:62-64`).
- **The on-screen code works for any registered number.** It is returned whenever the sink is not `sms` (`identity.ts:130`, `227`, `app/api/v1/auth/otp/route.ts:16`). Nothing refuses the screen sink in production: REMAINING 2.4 only plans to. `/status` shows it in red (`components/status-board.tsx:376`), but nothing stops it.
- **The sign-in sheet lists everyone.** It lists every person in the table, not only demo people (Scenario 7). Anyone can tap the officer and be signed in as the officer.
- **Demo people are seeded unless an environment variable is set.** They are seeded unless `KHETKUNDLI_SEED_DEMO=0` (`lib/server/seed.ts:318`), so a forgotten variable puts synthetic people, including a synthetic "Extension officer" account, into production.

**Advocate**
- Everything is honestly labelled ("Demo inputs, simulated", `map-furniture.tsx:238`).
- The status page flags the code sink in red.
- Reset of the season is an event, not a deletion, so the record itself survives.
- The seed is idempotent and can be switched off.

**Skeptic**
- With one environment variable forgotten, a real deployment has open sign-in as anyone, a public member list, a weather-faking button and a history-erasing button on the officer's main screen.
- These are not "limitations"; they are how a production incident or a deliberate cover-up would happen.

**Verdict: FAILS** (acceptable for a demo; dangerous if the pilot runs this build).

**Fix**
- A single `KHETKUNDLI_MODE=demo|pilot|production` flag, checked at server start. In anything except `demo`:
  - refuse to start if the code sink is `screen`
  - never seed demo people
  - refuse `rain` and `reset` events and messages in `canRecord` and `can`
  - do not render `DemoSlip`
  - `me` returns no list.
- Put a "DEMO" ribbon on every screen in demo mode.
- Size: **S**.

**Gaps**
- Demo controls write to the shared record and delete history: S1. **NEW (O-10)**. REMAINING §5 notes Reset only.
- On-screen code and public people list: S1. **NEW (O-1)**, together with REMAINING 2.4.

---

## Scenario 11 (added): Two staff at two desks at once

**Situation.** The officer at the KVK and the coordinator at the FPO both have the desk open on a Monday.

**Walkthrough with today's code**
- **One desk's date stamp moves the other's.** Moving the date or playing the season on one desk posts a `time` message (`lib/sync.tsx:130-136`). The relay stores it in a single global value and broadcasts it to everyone (`lib/server/relay.ts:186-191`).
- **A farmer can do the same.** `can(…, "time")` allows any signed-in non-buyer, farmers included (`lib/server/authz.ts:46-48`). A farmer's phone can move both officers' desks to another day.
- **Advisories prepared on a moved desk use the moved day.** Batches are prepared for `Math.floor(t)` (`components/desk/advisories.tsx:138`). One officer scrubbing back to August while the other prepares tonight's batch can produce a batch for the wrong day.
- **Replies collide** silently (Scenario 2).

**Verdict: FAILS** for more than one desk.

**Fix**
- Make time per screen. Allow replay only on the desk itself, never broadcast; farmers may never set it.
- Make `/api/agent/advisories` always use the real current day unless the request says "replay", and refuse to *send* a replay batch.
- Size: **S–M**.

**Gaps**
- Global clock: already G-B15.
- Farmers allowed to set every screen's clock: S2. **NEW (O-17)**.

---

## Scenario 12 (added): A slip dispute with an adatiya

**Situation.** A farmer's patti shows ₹2,300 above the FPO's agreed card. The coordinator must raise it with the adatiya without accusing him on record before checking.

**Walkthrough with today's code**
- **The dispute arrives with its evidence.** It comes into the inbox as `topic: "slip"` with the checks (`components/desk/inbox.tsx:326`, `331`).
- **The canned replies promise things nobody has done.** They include "I have sent this to the FPO and the APMC office; they will raise it at the next auction" (`inbox.tsx:295`), a statement of action the officer may not have taken, sent with one tap.
- **The rate card is a constant**, not the FPO's own card: `COMMISSION = 0.06`, `HAMALI_PER_CRATE = 5` (`lib/sim/rules.ts:91-93`, G-P6).
- **No dispute tracking.** There is no record of raised, refunded or refused, so "₹ recovered" cannot be counted (Scenario 6).

**Verdict: PARTLY** (the check is good; there is no follow-through).

**Fix**
- Make canned replies templates with blanks ("I will call {agent} on {date}"), not past-tense claims.
- A dispute status (raised, refunded ₹X, refused) recorded as an event, so the impact ledger can count recoveries.
- The FPO's rate card in admin (REMAINING 2.7).
- Size: **S–M**.

**Gaps**
- Canned replies assert actions not taken; the curative dose is hard-coded in English in a quick reply: S3. **NEW (O-18)**.
- Rate card: already G-P6 and REMAINING 2.7.

---

## The five most important cross-cutting findings for institutions

1. **The officer's liability is not protected.** The desk can say "warned" without the officer reviewing it: the one-click forecast warning (O-3), engine-written neighbour advisories (O-2) and simulated sprays written into records (O-6). It can erase what was said (Reset, O-5) and cannot take anything back (O-4). An officer who is liable for advice needs, in this order: an explicit approval on every outgoing message, a visible "why" per farmer, a recall or correction message, and a record of advice that nobody can delete.
2. **Verification is missing from the core loop.** A phone scan becomes a "warning" cell in one step, the diagnosis comes from the simulation, and "verified" is a label, not an act. The institution's real job (KS or KVK confirming a report) has no place in the data model (O-2).
3. **Demo affordances are wired into production paths.** These include:
   - the on-screen code
   - the public people list
   - the rain button that rewrites the shared weather
   - the Reset button that hard-deletes history
   - synthetic plots and simulated receipts mixed into real records.

   All of it is honestly labelled, but one missing environment variable turns it into open sign-in and fake data in front of a government officer. A single mode flag fixes most of it (O-1, O-9, O-10).
4. **The product has no institutional workflow layer**: no enrolment, staff management, jurisdiction, inbox triage or SLA, audit viewer, reports or exports, or data-request register. The farmer side and the record are sophisticated; the "desk" is a demo cockpit, not an office tool for 40 villages and 6,000 farmers (O-7, O-12, O-13, O-14, and G-P2).
5. **The data steward cannot meet DPDP duties as built.** There is a public member list, names in append-only hash-chained labels (so erasure is blocked), backups of phone numbers in plain JSON on the same disk, and no consent or request log. The FPO, as the likely fiduciary, would be exposed from the first enrolment (O-1, O-11, O-15, and G-B5, G-O3).

---

## New gaps, ranked

| Id | Gap | Sev | Evidence | Size | Related existing |
| --- | --- | --- | --- | --- | --- |
| **O-1** | Unauthenticated `/api/v1/auth/me` lists **every** registered person's phone, name and role while the code sink is `screen`, and the code is returned for any registered number: anyone can sign in as anyone, including the officer, and enrolled farmers' numbers are public | S1 | `app/api/v1/auth/me/route.ts:13-15`, `identity.ts:180-183`, `227`; `otp/route.ts:16`; `sign-in.tsx:29` | S | REMAINING 2.4 (SMS only) |
| **O-2** | Scan diagnosis is not recorded (no `finding`); the simulation decides blight or healthy; one scan makes a cell "warning"; the engine auto-warns neighbours; "verified" means "non-app simulated farmer"; there is no verify or refute step for the officer or KVK | S1 | `events.ts:66`; `season.ts:150-160`, `190-202`, `496-509`; `register.tsx:148` | M | G-D3, G-D4 (model only) |
| **O-3** | Forecast "Warn N plots" prepares **and sends** in one click with no list, preview or confirmation | S1 | `forecast.tsx:288-302`; `store.ts:162-173` | S | — |
| **O-4** | No recall, correction or follow-up message; a second same-day advisory replaces the first in the fold | S1 | `channel.ts:48-57`; `events.ts:120`; `forecast.tsx:220` | M | — |
| **O-5** | Reset (both staff roles) hard-deletes messages, batches and escalations, destroying the record of who advised what | S1 | `relay.ts:226-233`; `authz.ts:62-64`; `map-furniture.tsx:257-260` | S | REMAINING §5 (as a demo limit) |
| **O-6** | An advisory books **simulated sprays** into plots' records; the record then shows sprays nobody logged, which affects the export check and lot passport | S1 | `season.ts:206-215`; `tools.ts:216-222` | S–M | G-B2, G-D1 |
| **O-7** | The enrolment model is unsafe: `upsertPerson` silently overwrites name and role on a phone collision; phone is `not null unique` (no phoneless or shared-phone farmers); `relation` is unused (no joint holders) | S1 | `identity.ts:192-205`; `schema.ts:33`, `39-44`; `authz.ts:37` | L (with G-P2) | G-P2, G-P1, REMAINING 2.5, 1.3.7 |
| **O-8** | Advisory selection ignores stage, the export interval and earlier advisories; the console shows no per-plot evidence; a failing guard does not block a send; duplicate batches on the same evening are possible | S1 | `pipelines.ts:103-110`, `125`; `advisories.tsx:211`, `222-244`, `264` | M | — |
| **O-9** | Simulated receipts ("delivered", "read" on random timers) for plots with no handset look like real delivery; the counts on `/status` include them | S1 for a pilot | `messages/route.ts:65-80`; `advisories.tsx:238`; `status/route.ts:22-24` | S | G-C1, G-B11 |
| **O-10** | Demo controls on the production desk: the rain button rewrites shared weather for the agent, advisories and phones; the demo scan writes to a real record; demo people are seeded unless an environment variable is set; there is no mode flag | S1 | `map-furniture.tsx:227-263`; `store.ts:207-210`; `season.ts:50-54`; `seed.ts:318` | S | REMAINING §5 |
| **O-11** | No data-request handling (government, company, journalist, erasure); farmer names in hash-chained event labels make erasure impossible even with crypto-shredding; the agent log of questions sits outside every control | S1 | `store.ts:229`; `schema.ts:20-28`; `status/route.ts:34` | L | G-B5, G-O3, REMAINING 1.3.1, 2.6 |
| **O-12** | No staff lifecycle (deactivate, role change, revoke all sessions); 30-day desk sessions; no jurisdiction by village or FPO; officer and FPO admin have identical powers including reset and backup | S2 | `authz.ts:35-36`, `55-64`; `identity.ts:128`, `276-279`; `relay.ts:47` | M | G-P6 (in passing) |
| **O-13** | The inbox cannot triage: no status, priority, assignee, SLA or filter; newest first, limited to 200; off-topic questions not routed; drafts and quick replies English only; replies overwrite silently; officer free text unguarded | S2 | `inbox.tsx:286-306`, `388-403`; `relay.ts:140-146`, `218-222`; `agent.ts:236`; `channel.ts:4-16` | M | G-P4, REMAINING 2.8 (ratings only) |
| **O-14** | No audit viewer and no export: `sent_by`, `replied_by`, retractions and `auth_log` exist only in the database; no CSV or PDF for the taluka officer or the FPO board | S2 | `schema.ts:71-102`; no export in `components/desk/*` | M | G-P5, REMAINING 3.1 |
| **O-15** | Backups are manual, on the same disk, unencrypted JSON containing phones and session hashes; no command restores the live database; the agent log is excluded | S2 | `backup.ts:20`, `65`, `99`, `120`; `status-board.tsx:300-329` | M | G-B7, REMAINING 1.3.3 |
| **O-16** | The spray table is code: no version, approval or approver; no interval (hard-coded "15 days"), preparation steps, volume, brands or other diseases; the guard's "banned" list includes registered products; the evening SMS carries no dose | S2 | `rules.ts:10-29`; `tools.ts:128`; `guard.ts:125-126`, `145`; `pipelines.ts:123-124` | M | G-O1 (review only) |
| **O-17** | Any signed-in farmer may set the global clock that every desk follows; advisory batches use the possibly moved day | S2 | `authz.ts:46-48`; `relay.ts:186-191`; `sync.tsx:130-136`; `advisories.tsx:138` | S | G-B15 |
| **O-18** | Canned replies state actions not taken ("I have sent this to the FPO and the APMC office"); a quick reply hard-codes the curative dose in English | S3 | `inbox.tsx:286-296` | S | — |
| **O-19** | Escalation ids are `Q` plus milliseconds with `on conflict do nothing`; two questions in the same millisecond lose one silently | S3 | `store.ts:250`; `relay.ts:216` | S | — |

**Quick wins, all size S and all S1:** O-1, O-3, O-5, O-9 and O-10. A single `KHETKUNDLI_MODE` flag, a `me` route that never lists real people, and removing the immediate send from `warnCells` would close most of the institutional exposure before any pilot conversation with a Krishi Sahayak or an FPO board.
