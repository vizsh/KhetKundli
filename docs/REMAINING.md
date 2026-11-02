# What remains

The living list of work between today's code and the product in [PRODUCT-PLAN.md](PRODUCT-PLAN.md). **Update it in the same commit as the work**: tick what a commit finishes, add what it leaves behind, keep the dates. The plan says *why* and *how*; [GAPS.md](GAPS.md) is the register of problems; this file says *what is left, in order, and how we will know it is done*.

Last updated: **3 November 2026**, after Phase 1 slice 2 (accounts, roles, authorisation, Postgres inbox and messages, backups).

---

## Where we are

| Phase | Slice | State |
| --- | --- | --- |
| 1 · A record you can trust | 1 · The season record as events (append-only, hash-chained, per-event sync) | ✅ Done, `6f96543` |
| | 2 · Accounts, roles, authorisation; inbox and messages in Postgres; send by batch id; backups and a restore drill | ✅ Done (this commit) |
| | 3 · Consent, server-side projections, the last of SQLite, real-Postgres CI, structured logs | ⏳ Next |
| 2 · Real channels, real data | Job runner, DLT SMS, WhatsApp, enrolment, live ingest, staging | ⬜ Not started (people work must start now: §4) |
| 3 · A pilot that proves impact | Impact ledger, field data, fitted models, security review, operations | ⬜ Not started |

```mermaid
flowchart LR
  S1["P1·S1 events ✅"] --> S2["P1·S2 access ✅"] --> S3["P1·S3 consent,<br/>projections ⏳"] --> P2["Phase 2<br/>channels, data"] --> P3["Phase 3<br/>pilot, impact"]
  PEOPLE["People work:<br/>agronomist, FPO,<br/>DLT, WhatsApp"] -.-> P2
```

## 1. Phase 1 · slice 3 (next)

Goal: finish "a record you can trust": consent decides what is shared, the server computes what is shared, nothing important lives outside Postgres, and the same tests pass on a real Postgres server.

| # | Item | Done when | Gap |
| --- | --- | --- | --- |
| 1.3.1 | **Consent model**: grant and revoke events per purpose (*Pest Radar*, *pooled transport*, *fair-slip index*, *research*); a person's consents on `/api/v1/auth/me` | Property test: revoking consent removes the plot from every shared view; the owner still sees her record | G-B5 |
| 1.3.2 | **Server-side projections**: the server computes radar cells, wave and water from events and serves them; farmers stop receiving other farmers' raw events (they get projections and their own record) | A farmer's stream carries no other plot's raw events; the desk is unchanged; season hash from server equals the browser's | G-B2 |
| 1.3.3 | **Agent log and weather snapshots move to Postgres**; SQLite (`web/data/khetkundli.db`) retired | No `node:sqlite` import left; backup covers them; restore drill passes | G-B7 |
| 1.3.4 | **CI against a real Postgres** (a service container) as well as embedded Postgres; first green run on GitHub | `.github/workflows/ci.yml` runs `npm test` twice, `DATABASE_URL` set on the second; badge green | G-T3, G-T4 |
| 1.3.5 | **Run the app on the laptop's PostgreSQL 17** (needs a role and database the user creates; see §4) | `api-check`, smoke and the crash test pass with `DATABASE_URL` set | G-T3 |
| 1.3.6 | **Structured logs and request ids** (JSON lines: route, person, status, ms); errors with a stack in one place | Every API response has `X-Request-Id`; a failing request can be found by it | G-B13 |
| 1.3.7 | **Household switching on a shared phone**: several people signed in on one phone, one tap to switch | Two farmers on one phone, each sees only her plot; outbox items keep their author | G-P1 |
| 1.3.8 | **A signed daily digest** of the season chain's head, kept outside the database (file, and later emailed to the FPO) | Deleting the newest row is detected by comparing with yesterday's digest | G-B12 |
| 1.3.9 | **Contract tests for every API response** (zod schemas for responses, validated in api-check) | No route returns a shape that is not in a schema | G-B9, G-B14 |
| 1.3.10 | **Rate limits shared across processes** (Postgres) instead of process memory | Two server processes enforce one limit | G-B10 |

## 2. Phase 2 · Real channels, real data

| # | Item | Done when | Blocked on |
| --- | --- | --- | --- |
| 2.1 | Job runner (pg-boss) in a separate worker process; the code split into packages (`engine`, `contracts`, `core`, `web`, `worker`) | Jobs survive a restart; the gateway simulator's timers move into jobs | — |
| 2.2 | Hourly weather ingest with provenance; daily Agmarknet prices with history; snapshots | `/status` shows the age of every feed; offline mode uses the newest snapshot | data.gov.in key |
| 2.3 | **Delivery service**: outbox, state machine, adapters (DLT SMS, WhatsApp, web push, in-app, labelled simulator), signed webhooks, retries, dead letter, cost per message | A real Marathi SMS on a registered phone; provider outage sends nothing twice | DLT registration, SMS provider, WhatsApp Business |
| 2.4 | OTP by SMS (`KHETKUNDLI_OTP_SINK=sms`); the on-screen sink refused when `NODE_ENV=production` | Sign-in works with no code on screen | 2.3 |
| 2.5 | Enrolment at the FPO desk: register a farmer, her plots (gat number, map pin or GPS walk), bahar date, household | A new farmer signs in and keeps a record within 10 minutes of arriving | FPO |
| 2.6 | Consent flows in the app (grant, revoke, export my data, erase with crypto-shredding of personal fields) | Erase leaves the chain verifying and the person unreadable | 1.3.1 |
| 2.7 | FPO admin: villages, staff, the rate card, message templates, the copper price list | The slip check uses the FPO's own card | FPO |
| 2.8 | Agent: farmer ratings, officer review queue, corrections into router training; guard regression suite in CI; model version with every answer | A wrong answer corrected on the desk changes the next router build | — |
| 2.9 | Scan Lens: grouped split, int8 export, timed on a low-end Android phone | Published honest accuracy and latency | a low-end phone |
| 2.10 | Voice logging; offline Marathi speech evaluation (Whisper, AI4Bharat) | "फवारणी केली" logs a spray offline | — |
| 2.11 | Staging in an India region, infrastructure as code, dashboards and alerts on the SLOs; load test at 10× the pilot | SLOs met under load; a deploy during load loses nothing | hosting account, budget |

## 3. Phase 3 · A pilot that proves impact

| # | Item | Blocked on |
| --- | --- | --- |
| 3.1 | Impact ledger with lineage and a pre-pilot baseline; weekly FPO report | FPO, baseline survey |
| 3.2 | Hybrid view: real cohort plus labelled simulated background | enrolled farmers |
| 3.3 | Field data: Phaltan photos (agronomist-labelled), real pattis, five flow meters, optionally one leaf-wetness station | agronomist, FPO, meters |
| 3.4 | Fit the spread and blight models to pilot reports; re-run the backtest on real detections | pilot data |
| 3.5 | Security: OWASP ASVS level 2 checklist, dependency and secret scanning, an external penetration test | budget |
| 3.6 | Failure testing at scale: a week-long offline phone, network partitions, failover on staging | staging |
| 3.7 | Operations: runbooks, on-call, a support number answered by the FPO, an incident log | FPO |

## 4. Waiting on people (start now)

| Need | For | State |
| --- | --- | --- |
| A Postgres role and database on this laptop's PostgreSQL 17 (`create role khetkundli login password '…'; create database khetkundli owner khetkundli;`, then `DATABASE_URL` in `web/.env.local`) | 1.3.5 | Not done: needs the superuser password, which only the user should type |
| An agronomist (ICAR-NRCP Solapur, MPKV Rahuri or the KVK) | spray table sign-off, photo labels | Not approached |
| A partner FPO in Phaltan taluka | users, rate card, support, data fiduciary | Not approached |
| TRAI DLT registration through an SMS provider | 2.3, 2.4 | Not started (1–3 weeks) |
| WhatsApp Business account and templates | 2.3 | Not started |
| data.gov.in API key | 2.2 | Not requested |
| Hosting account in an India region; a domain | 2.11 | Not started |
| Privacy notice and terms reviewed by someone qualified | 2.6 | Not started |
| Push this branch to GitHub | first CI run (1.3.4) | Commits are local only |

## 5. Known limitations we chose for now

Each is deliberate and has a closing item.

| Limitation | Why it is acceptable today | Closes with |
| --- | --- | --- |
| Sign-in codes are shown on screen (and the demo people are listed on the sign-in sheet) | No SMS sender exists yet; `/status` says so in red | 2.4 |
| Any signed-in farmer receives every plot's raw season events | The season is still computed on each screen | 1.3.2 |
| Rate limits live in one process's memory | One server process | 1.3.10 |
| The gateway simulator uses timers inside a request | No job runner yet; receipts are labelled *sim* | 2.1, 2.3 |
| Desk → Reset deletes the inbox, batches and messages (the season record itself is only reset by an event) | Demo control, staff only | Removed for real deployments in 2.5 |
| Season events recorded before slice 2 have no author, so only staff can undo them | Demo data only | — |
| Staff may record entries for any plot (the FPO logging on a farmer's behalf) | Matches how FPOs work; the row records who wrote it | Consent rules in 1.3.1 may narrow it |
| The agent log and saved forecasts are still in SQLite | Not part of the record; not yet in backups | 1.3.3 |
| Tested on embedded Postgres only | No credentials for the laptop's PostgreSQL 17 | 1.3.4, 1.3.5 |
| CI has never run | Not pushed | §4 |

## 6. Log

| Date | Commit | What changed here |
| --- | --- | --- |
| 3 Nov 2026 | Phase 1 slice 2 (this commit) | File created. Slice 2 done: accounts (OTP), sessions per surface, roles, authorisation on every route, Postgres inbox, messages and batches, send by batch id, backups and a restore drill, 29 unit tests, `api-check` (16), smoke with sign-in |
