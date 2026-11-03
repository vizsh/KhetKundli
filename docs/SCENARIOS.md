# Scenario trials: does it work when real people use it?

Written 3 November 2026, against `main` at `cd03f34` (after Phase 1 slice 2). This is a different way of finding gaps from [GAPS.md](GAPS.md). Instead of asking "what is missing?", we put the product in front of the people who would really use it and asked, scenario by scenario: **what happens, what works, what breaks, and what would fix it for this person.**

The four full trials are in [scenarios/](scenarios/). This page is the summary: the verdicts, the themes that cut across all four, a fix for each situation tailored to its user, and the work that has to happen before any real farmer is enrolled. The gaps found here are folded into [GAPS.md](GAPS.md) §7 and the order of work into [REMAINING.md](REMAINING.md).

---

## How the trials were run

Four agents each took one world of users. Each read the docs, then the code, and played out real-life scenarios in that world step by step. Every claim cites a file and line. For each scenario two voices argued:

- the **advocate**: what works today, and why it matters to this person;
- the **skeptic**: what breaks, confuses, costs money, can be gamed or causes harm, as concretely as possible.

Each scenario then gets a **verdict**, a **fix tailored to that user** (sized S under a day, M days, L a week or more), and a **gap** (new, or the id it already has). The trials only read the code; nothing was changed. The most serious claimed bugs were then checked by hand before this page was written.

| World | Who | Scenarios | Report |
| --- | --- | --- | --- |
| **The farmer** | Sunita Jadhav: 1.5 acres on drip, reads Marathi slowly, an ₹8,000 phone shared with her husband and son, patchy signal, ₹19 data packs | 12 | [scenarios/farmer.md](scenarios/farmer.md) |
| **The institutions** | The Krishi Sahayak (40 villages, about 6,000 farmers, liable for advice), the FPO coordinator, the KVK scientist, the taluka agriculture officer | 12 | [scenarios/institutions.md](scenarios/institutions.md) |
| **The market** | The adatiya, the tempo driver, the collection-point volunteer, the buyer and exporter, the trader, the FPO deciding where to sell | 11 | [scenarios/markets.md](scenarios/markets.md) |
| **Adversaries, failures and scale** | A malicious farmer, someone on the venue Wi-Fi, a privacy lawyer, an SRE during the monsoon, a skeptical judge | 9 | [scenarios/adversaries.md](scenarios/adversaries.md) |

## The verdicts

| World | Works | Partly | Fails or breaks |
| --- | --- | --- | --- |
| Farmer | 0 | 5 | 7 |
| Institutions | 0 | 4 | 8 |
| Market | 0 | 2 | 9 |
| Adversaries | 0 | 4 | 5 |
| **All 44** | **0** | **15** | **29** |

This is the honest result, and it is not a contradiction of the earlier work. The engine, the record's storage (append-only, hash-chained, exactly-once under crashes) and the tests are strong. The trials measure something else: **whether a real person, in a real situation, ends up better off and safe.** Today the prototype is a convincing demonstration and a trustworthy store. It is not yet a product a farmer, an officer or a buyer can rely on.

What held up, in every world:

- **The record's storage.** No trial broke the append-only chain, idempotent appends or convergence.
- **The guard on advice.** No invented dose, product or number reached a farmer in English.
- **Honest labelling.** LIVE, RECORDED and SIMULATED stamps, "not a certificate", synthetic people.
- **Offline capture.** Scans and slips work on the phone with no signal, and the outbox survives a closed tab.
- **The right shape of idea.** Every world found the core thesis sound: one record, read together, makes the advisory layer the demand forecast for the market.

## Nine themes across all four worlds

Each theme lists the gaps the trials found (F = farmer, O = institutions, M = market, X = adversaries; full text in the reports) and the fix, tailored to the people it serves.

### 1. Anyone can sign in as anyone today

`/api/v1/auth/me` lists every registered person's phone number and role to anyone, while the on-screen code sink (the default) hands the code to whoever asks. The sign-in rate limits trust a header any client can set, and the code-attempt counter is not atomic. *(X-6 / O-1, X-2, X-3, X-10, X-18, X-21, X-22; F-8, F-9; O-12)*

**Fix, for the FPO that will hold real phone numbers.** One `KHETKUNDLI_MODE` (`demo` | `pilot`) setting. In `pilot`:
- the people list is never served;
- the on-screen code sink is refused;
- the demo people are not seeded;
- the demo controls (rain, demo scan, Reset) are absent.

Also:
- trust `X-Forwarded-For` only from a configured proxy;
- make the attempt and issue limits atomic in SQL;
- limit request bodies;
- check `Origin` on POSTs;
- shorten staff sessions and add "sign out everywhere".

All size S. **Before any real number is entered.**

### 2. Nothing a farmer did may be lost, and today it can be

Storage is exactly-once, but the path to it is not lossless:

- **Rejected messages are deleted.** The phone's outbox deletes a message as soon as the server answers 200, even when every event in it was *rejected*.
- **A shared phone loses work.** On a shared phone, Sunita's queued work is sent under Shankar's session, refused as "not your plot", and deleted.
- **One bad receipt blocks everything.** A receipt with a malformed date makes the database throw, and the queue stops behind it for good.
- **The clock never learns from other devices.** Event stamps are never observed by other devices' clocks.
- **Reset is judged two ways.** A reset is ordered by clock in one place and by arrival in another.
- **Schema changes drop old phones' work.** Events from an older app version will be refused, then dropped.
- **Her own record isn't kept on the phone.** An offline reload shows the simulated plan instead of her entries.
- **There's no visible sign-out on the phone.** The phone screen hides the sign-out button.

*(X-25 / F-2, X-39, X-7, X-8, X-31, F-1, F-3, F-20, F-22, F-23)*

**Fix, for a farmer on a shared ₹8,000 phone with no signal.**
- Rejected events are never deleted. They go to a "needs attention" list in Marathi, bound to the person who made them, and are sent only under that person.
- Her events and messages are kept in IndexedDB, so the record she reads works offline.
- A visible "this phone is…" switch, with each person's own store.
- Clocks observe every event stamp.
- Reset is decided by one rule.
- The server accepts every schema version up to its own and upgrades old ones.

A new property test: **no accepted or queued fact ever disappears from the projection.**

### 3. The record must say only what is true

Today the simulation writes into the record in the farmer's own ink:

- Sprays the system *booked* are recorded as *done*, with human provenance, and then:
  - protect the canopy in the model;
  - feed the lot passport's export check.
- Simulated sales are stamped *verified*.
- A farmer's scan counts as blight only if the *simulator* already thinks her plot is infected. The scan event carries no finding, model or image hash.
- Demo rain and demo scans are permanent facts in the trusted chain.
- The spray log offers two products, so a farmer who used anything else must mislabel it.

*(X-1 / O-2, F-4 / O-6, M-5, M-8, F-5, F-19, X-20, X-34 / O-10)*

**Fix, for the officer who is liable and the buyer who trusts the passport.**
- Three distinct states for every fact: **confirmed by her**, **assumed by the system**, **unknown**.
- The simulation never writes into an enrolled plot.
- A scan is evidence in its own right, recorded with its finding, confidence and model version. It becomes a radar report as a *report*, and the officer or KVK can **verify or refute** it.
- Spray logging takes any product from the FPO's list (active ingredient and label pre-harvest interval), plus "other, I'll show the bottle".
- Demo controls write to a separate sandbox stream, never the production chain.

### 4. Privacy, and market intelligence for traders

- A public lot page (no account, no rate limit) streams the whole raw record of that plot, including slips with net income, the agent's name and complaints. Lot ids are guessable and contain the gat number, despite "no gat number" on screen.
- Every signed-in farmer receives every plot's raw events, so anyone with a farmer account can compute everyone's picking plan.
- H3 cells average under one plot each, so a lit cell names a family.
- Backups are plain JSON with phone numbers on the same disk.
- Farmers' names sit inside immutable event labels, so erasure is impossible.

*(M-1 / X-4, X-26, M-2, X-11, X-13, X-14, X-19, O-11, O-15)*

**Fix, for a farmer who fears her adatiya or a trader learning what she earns or when she picks.**
- A lot passport is a small server-computed JSON with an opaque lot code. No stream, no gat number, no slips, rate-limited.
- Shared views are server-side projections with a minimum of five plots per cell or village, and no single plot over 40% of a cell.
- Farmers get bands, not crate counts.
- A `trader` flag at enrolment excludes the wave.
- Names stay out of event labels.
- Backups are encrypted, rotated and copied off the laptop.
- The service worker never caches API answers.

### 5. The officer's name is on every advisory

- **One-click sending.** "Warn downwind" prepares *and sends* to every plot in one click, with no list or preview.
- **No correction or recall.** Nothing can correct or recall a sent advisory.
- **Reset destroys the record.** Desk → Reset hard-deletes the record of who advised whom.
- **Weak advisory selection.** The selection ignores crop stage, the export interval and earlier advisories, and a failing guard does not block a send.
- **Fake delivery receipts.** Simulated receipts look like real delivery in the counts.
- **No working inbox.** The inbox has no status, priority, assignee, SLA or Marathi drafts.
- **False claims in canned replies.** Canned replies claim actions nobody took.
- **Any farmer can move the clock.** Any farmer can move the clock every desk follows.
- **Unchecked Marathi.** The model's Marathi translation is not guarded.

*(O-3, O-4, O-5 / X-35, O-8 / X-23, O-9, O-13, O-14, O-16, O-17 / X-17, O-18, X-5, X-15)*

**Fix, for a Krishi Sahayak with 6,000 farmers and personal liability.**
- Every outgoing message passes an explicit approval screen showing who, why (the evidence per plot) and the exact Marathi text.
- A guard failure blocks sending.
- A **correction** message type that references the original.
- An advice log nobody can delete; Reset is gone in pilot mode.
- Receipts are labelled *simulated* everywhere they are counted.
- The inbox gets status, assignee, a two-day SLA with a backup officer, and Marathi quick replies that state only what was done.
- Only staff move the clock.
- The guard checks the Marathi text too.

### 6. Guidance in the field has to be honest about how sure it is

- A stale cached forecast is shown as a LIVE spray window.
- A fruit-only model sits behind a "Scan a leaf" button, with no rejection of non-pomegranate photos.
- Advisories show no date.
- Voice fails silently offline, and the keyword router misreads common Marathi.
- Market advice uses a perfect-foresight simulated price to the rupee, preselects "best", and is not recorded.
- Every farmer gets the same "best market", so the app would cause the glut it warns about.

*(F-6, F-7, F-12, F-14, F-15, M-6, M-7)*

**Fix, for a farmer who will tell the whole village if the app is wrong once.**
- Every piece of guidance carries its date, its source and a range, spoken in Marathi.
- "Scan a fruit" until a leaf model exists, and "this does not look like pomegranate" for anything else.
- Market screens show yesterday's real price, a three-season band and a net range; no preselected "best".
- The advice shown is recorded, then compared with the sale.
- The FPO allocates markets (a quota per market per day) instead of everyone receiving the same answer.

### 7. The money loop stops at the screen

- **Slip check.**
  - It treats lawful levies and per-crate rates as money owed, which can produce absurd "please refund ₹11 lakh" notes.
  - It shows a red accusation at the adatiya's counter.
  - It keeps no photo as evidence, and a dispute has no case state.
- **Grades.** Re-grading at the market (a 32% loss per grade) is invisible.
- **Pickings and runs.** Only the hero plot can move a picking. Pooled runs exist only on screen: no driver, booking, manifest, minimum load, cost split or damage record.
- **No payments.** There is no payment tracking (due, late, cash, advances) and no FPO collective-sale ledger.
- **Farm-gate sales.** Farm-gate and standing-crop sales are not represented.
- **No business model.** Nobody pays yet.

*(M-3, M-4, M-8, M-9, M-10, M-11, F-18)*

**Fix, for the FPO that has to justify a subscription to its board.**
- Slip check:
  - sanity guards (rate unit, a cap at the gross, lawful levies shown as information);
  - a soft "please check these lines" note;
  - evidence sent to the officer with consent;
  - a case state;
  - the FPO raises cases in a batch by agent, so no single farmer is exposed.
- Per-plot harvest events.
- An FPO-run transport loop: driver registry, run offer by SMS with YES/NO, minimum load and a fair split, never splitting a lot without consent, a collection-point manifest with crate counts and photos.
- Payment events and an advance ledger.
- An FPO collective-sale split.
- The business model: **the FPO pays for the core, the farmer pays only a share of money recovered, buyers pay later for signed passports**. This rests on these money features, so they are what to build for the FPO.

### 8. Running it for real

The server today:
- runs as `next dev` on one laptop with no supervisor;
- sends a full snapshot to every reconnecting phone, with no back-pressure;
- runs an uncached 150 ms season per anonymous lot request;
- runs migrations lazily with no backup first;
- has no restore-to-live procedure.

Elsewhere:
- backups read tables outside one snapshot;
- model weights download from mutable URLs with no hash check;
- the service worker precaches 46 MB all-or-nothing over ₹19 packs;
- there is no installable app, and the first visit shows a certificate warning.

*(X-12, X-26, X-27, X-28, X-30, X-33, X-36, X-29, X-32, F-16, F-17, F-21)*

**Fix, for a low-budget FPO.**
- A ₹2,000-a-month India VPS with Postgres, systemd and Caddy (real TLS), and encrypted off-site dumps.
- Backups in one transaction.
- A backup before every migration.
- A measured restore-to-live.
- SSE with cursors and limits.
- Cached lot projections.
- Hash-checked model downloads.
- A web app manifest.
- A small first download, with models fetched on first use.

### 9. The desk is a demo cockpit, not an office

- There is no enrolment (people come only from the seed).
- The person model overwrites names on a phone collision and has no place for joint holders, phoneless farmers or real gat numbers.
- There is no staff lifecycle or jurisdiction.
- There is no audit viewer or export, no data-request register, and no reports for the taluka officer or the FPO board.
- The spray table is code, with no version, approver or interval.

*(O-7, O-11, O-12, O-13, O-14, O-16; G-P2, G-O1)*

**Fix, for the FPO coordinator enrolling 150 farmers in an afternoon.**
- An enrolment desk:
  - number checked by a test code before saving;
  - plots by gat number and map pin;
  - joint holders;
  - "no phone, reached by SMS or a neighbour";
  - household members.
- Staff with jurisdictions and deactivation.
- An audit view with CSV and PDF exports.
- A data-request register.
- The spray table as versioned data, approved by a named agronomist.

## What has to happen before any real farmer is enrolled

The trials agree on a short, cheap batch. It closes the S1 exposures and the bugs before Phase 1 slice 3 continues. It is now **Phase 1 · slice 2.5** in [REMAINING.md](REMAINING.md). Almost every item is size S. Together they take about four to six working days.

| # | Fix | Closes | Size |
| --- | --- | --- | --- |
| 1 | `KHETKUNDLI_MODE=demo\|pilot`: in pilot no people list, no on-screen codes, no seeding, no demo controls or Reset | X-6/O-1, O-10, O-5/X-35, X-34 (pilot) | S |
| 2 | Sign-in hardening: trusted-proxy address, atomic code attempts and issue limits, body size limits, `Origin` check, security headers, shorter staff sessions and sign-out everywhere | X-2, X-3, X-18, X-22, X-10 (part), F-9 (part) | S |
| 3 | Lossless outbox: rejected events kept in a "needs attention" list, bound to their author; receipts and dates validated; a visible person switch on the phone; the store cleared on a switch | X-25/F-2, X-39, F-3, F-22 | S–M |
| 4 | Clocks and versions: clocks observe event stamps; reset decided by one rule; accept older schema versions; only staff move the clock | X-7, X-8, X-31, X-17/O-17 | S |
| 5 | Lot passport as server JSON with an opaque code; no public stream; cached | M-1/X-4, X-26 | S–M |
| 6 | Truthful record: simulated sprays and sales "computed", never "human" or "verified"; no simulation on enrolled plots; the scan event carries finding, confidence and model; the passport's export check says "unknown" when nothing is logged | X-1, F-4/O-6, M-5 (part), M-8 (part) | S–M |
| 7 | Officer control: "Warn downwind" opens the approval list; a guard failure blocks sending; the guard checks Marathi; canned replies state only what was done | O-3, O-8/X-23, X-5, O-18 | S |
| 8 | Backups in one snapshot, encrypted, rotated, with an off-laptop copy | X-12, X-13 | S |
| 9 | Honest guidance: dates on advisories and forecasts, stale forecasts not shown as live, "Scan a fruit", no preselected "best market", a soft slip note | F-6, F-7 (label), F-12 (part), M-6 (part), M-4 (part) | S |
| 10 | Tests for the above: the "nothing disappears" property, a shared-phone outbox test, a mode test, a lot-passport privacy test | — | S |

## How to keep doing this

Run a trial whenever a slice lands, and before every pilot conversation:

1. Pick a world and a persona with real constraints: phone, signal, literacy, money, liability.
2. Write the scenarios as they would happen, including the bad days.
3. For each scenario, read the code it touches and argue both sides: advocate and skeptic.
4. Record a verdict, a fix for *that* person, and a gap with a severity.
5. Check the serious claims by hand, then fold the gaps into GAPS.md and the order into REMAINING.md.

Run the same scenarios again after the fixes land. The verdict table above is the baseline to beat.
