# Scenario trial: the farmer (Sunita Jadhav, Phaltan)

**Code version:** `main` at `cd03f34`, read on 3 Nov 2026. This is a read-only trial: I edited nothing and ran nothing except reading files. Line numbers are for that commit. Where a point depends on the device or network and not on code, it is marked *(estimate)* or *(unverified)*.

**Persona:** Sunita Jadhav. Pomegranate on drip (1.5 acres). Reads Marathi slowly and little English. Uses an ₹8,000 Android phone shared with her husband and teenage son, with patchy 2G/4G, ₹19 data packs, bright sun and wet hands.

---

## 1. First day: told at the FPO meeting to "open the app"

**Situation.** A coordinator at the FPO meeting reads out a link or shows a QR code. Sunita has never used a web app and has never signed in with a code.

**Walkthrough with today's code**
- **Getting the app.** There is no hosting (G-T6). The app is reached through `npm run demo` on a laptop's Wi-Fi with a QR code. With `--https` the laptop serves a self-signed certificate (CONTEXT §9–10), so Chrome shows "Your connection is not private" and she must tap Advanced → Proceed. There is no web app manifest (`src/app` has none), so she cannot "install" the app properly. The service worker registers only in production builds (`phone.tsx:57-61`), and only on a secure origin.
- **Sign-in sheet.** Phone number, then a 6-digit code (`sign-in.tsx:55-105`). The labels are English first, with smaller Marathi (`sign-in.tsx:58`, `73-74`).
- **OTP shown on screen today.** For a registered number the code is returned and pre-filled (`identity.ts:362`, `sign-in.tsx:38-39`). The demo people are listed with their numbers, so one tap signs anyone in as Sunita (`sign-in.tsx:108-130`, `me/route.ts:52-54`).
- **Number typed wrong, or not registered.** The server answers "sent" either way and gives no code (`identity.ts:354-358`). The sheet moves to the code step with an empty box and no hint (`sign-in.tsx:37-40`). She waits forever. The only way out is the small underlined "change" link (`sign-in.tsx:81`).
- **SMS late or not arriving (once SMS is on).** Codes last 5 minutes (`identity.ts:259`). Only the newest code counts (`identity.ts:371-373`). If she taps "send" again and the first SMS then arrives, typing it gives "That code is not right" and uses up one of 5 tries. There is no resend button or countdown. At most 3 codes per number in 10 minutes (`identity.ts:349-353`).
- **Forty farmers on one hotspot or a carrier NAT.** Limits are per IP address: 10 code requests a minute (`otp/route.ts:11`) and 20 verifications a minute (`verify/route.ts:23`). In a room of 40 farmers, the 11th gets "Too many requests".
- **Number in her husband's name.** One person has one phone number (`identity.ts:327-340`, upsert by phone). If the plot is enrolled under his number, the code goes to his SIM, which may be at the market with him. There is no household member or second number (G-P1, REMAINING 1.3.7), and no enrolment screen (G-P2).

**Advocate.** The sign-in itself is sound: hashed codes, 5 tries, a limit per number, and the same answer for unknown numbers (`identity.ts:240-252`). The buttons are large (min-h-12/13), and the numeric keypad and `one-time-code` autofill (`sign-in.tsx:64-65`, `88-89`) suit a farmer. Once signed in she stays signed in for 30 days, so it is not a daily hurdle.

**Skeptic.**
- Today there is no authentication for a farmer at all: anyone taps "Sunita Jadhav" on the sheet.
- The silent dead end for a mistyped number is the commonest real failure, and the screen gives her nothing to act on.
- Teaching farmers to click through a certificate warning is unsafe.
- The FPO meeting is exactly where per-IP limits will trip.
- "Kोड पाठवा" means nothing to her unless someone explains that an SMS is coming.

**Verdict:** FAILS for real farmers today (on-screen sink, no hosting). PARTLY works as a demo.

**Fix tailored to her**
1. **Sign-in sheet (M):**
   - Marathi first.
   - After "send", show a 60-second countdown, then "पुन्हा पाठवा" (send again).
   - Accept any unexpired, unconsumed code for the number, not only the newest (`identity.ts:371-373`).
   - Make the TTL 10 minutes.
   - After 2 minutes, show "कोड आला नाही? एफपीओ डेस्कला फोन करा: <number>" (code didn't come? call the FPO desk).
2. **Enrolment, then assisted sign-in at the FPO desk (M, REMAINING 2.5):** the coordinator registers her and she signs in there, so a bad number is caught on the spot.
3. **Limits (S):** limit per number and per device, not per IP, at enrolment events, or allow-list the FPO's hotspot.
4. **Distribution (M):** real hosting with a real certificate and a manifest, so she gets a home-screen icon. A missed-call or IVR enrolment for people who cannot type (G-C3).

**Gaps.**
- The on-screen OTP is known: S1, REMAINING 2.4 / G-B4.
- **NEW F-8** (S2): the sign-in dead ends (unknown or typo number gets no signal, no resend, newest-code-only, per-IP limits).
- **NEW F-17** (S2): distribution (no manifest, self-signed certificate, service worker only in production on a secure origin).

---

## 2. Shared phone: son, husband, cleared browser data

**Situation.** Her son signs in with his own number to look at "his" plot, or uses the phone for games and clears Chrome's data. Her husband sprays and wants to log it.

**Walkthrough with today's code**
- **No sign-out on a phone.** The only sign-out control is `SignedInAs`, rendered with `className="hidden sm:inline-flex"` (`phone.tsx:77`). Below 640 px it is hidden, so on her phone there is no sign-out. To use his number, the son must clear site data.
- **What clearing site data does.** It wipes:
  - the session cookie;
  - `localStorage` (`kk-person-phone`, `session.ts:207-216`);
  - the IndexedDB outbox (`outbox.ts:9-23`), including every entry not yet sent;
  - the service-worker cache (about 46 MB to download again, scenario 10).

  Offline afterwards, `load()` finds no person (`session.ts:213-216`) and shows the sign-in sheet, which needs signal (`session.ts:221`). In the orchard the next morning the app is unusable.
- **Son signs in while her outbox still holds items** (for example only the cookie expired or was cleared). `flush()` posts her queued messages with his session:
  - Her events come back as **200** with each event rejected ("Plot N is not yours", `relay.ts:155-171`, `authz.ts:166-167`).
  - Her escalations come back as **403** (`relay.ts:179`, `197`).

  `flush()` keeps an item only on network failure, 5xx, 401 or 429 (`sync.tsx:96`), so it **deletes** both. Her morning's spray and question are silently lost.
- **Leftover data in memory.** The store is global and not cleared on a person change. The inbox merges and is never replaced (`store.ts:274-278`). The Ask sheet lists `inbox.slice(0,3)` without filtering by plot (`ask-sheet.tsx:227-231`). Until the page reloads, the next person can see her questions to the officer.
- **Husband logs a spray on her session.** The server records the signed-in person as author (`relay.ts:158`), so the record says Sunita sprayed. If both log a spray on the same day, the later replaces the earlier: the key is plot|day|kind (`events.ts:117`).
- **Household data model.** `person_plots` has a `relation` column (`identity.ts:322`), but there is no screen to add a household member. The phone shows only `person.plots[0]` (`phone.tsx:46`).

**Advocate.** Separate accounts and a per-event policy (`authz.ts:158-179`) mean the son can never overwrite her plot's record with his. The hash-chained store records who wrote what. Undo is per author (`authz.ts:175-177`).

**Skeptic.** No sign-out on the device that is shared is a basic failure. "Clear data" is what people do on cheap phones to free space, and it silently destroys unsent work. Unsent work leaving the outbox under the wrong person is a data-loss path that the property tests do not cover, because they test merge, not who sends. Attributing the husband's work to her makes the "record you can trust" untrue in the most common household.

**Verdict:** FAILS.

**Fix tailored to her**
1. **Bind outbox items to their author (S):** store `personId` with each queued message and flush only items whose author matches the signed-in person. Keep the others with a banner: "सुनीताच्या ३ नोंदी पाठवायच्या आहेत. सुनीता म्हणून लॉग इन करा." (Sunita has 3 entries to send; sign in as Sunita). Never delete on 403 or on a per-event rejection. Move them to a "not accepted" list she can see. Code: `sync.tsx:93-98`, `outbox.ts`.
2. **Visible person switcher in the phone header, with photo or initial avatars, not names (M):** this is REMAINING 1.3.7. Sign-out goes behind it. Reset the store (`events`, `inbox`, `messages`) on a person change.
3. **"Who did this work?" chip on each log entry (S):** Me / husband / son / labourer. Record it as a field of the entry (zod `entry` in `events.ts:30-34`), not as the session.
4. **`navigator.storage.persist()` on first sign-in (S).** Warn before sign-out if the outbox is not empty.

**Gaps.**
- Household switching is known: S1, G-P1 / REMAINING 1.3.7.
- **NEW F-2** (S1): the outbox is not bound to its author and deletes on 403 or rejection.
- **NEW F-3** (S1): no sign-out on phone-width screens.
- **NEW F-22** (S3): store data stays after a person change.
- **NEW F-23** (S3): no "who did the work" field.

---

## 3. Morning in the orchard with no signal; back to signal at night

**Situation.** At 6 am she scans a fruit, logs a spray and asks a question by voice, all without signal. The phone restarts, battery saver kills Chrome, and she gets signal only at night. Sometimes the outage lasts 5 days.

**Walkthrough with today's code**
- **Opening the page offline.** The service worker serves `/farmer` from cache (`sw.js:58-68`) if it installed (production, secure origin, and the full precache succeeded; see scenario 10). The session falls back to the person saved in localStorage (`session.ts:213-216`).
- **Scan.** Runs on the phone (`scan-lens.tsx:126-147`). "Save to my record" is offered only for a blight result ≥60% (`scan-lens.tsx:355`). The save goes into the outbox (`store.ts:191-196`, `sync.tsx:115`).
- **Log a spray.** Goes to the outbox. But the ripple card stamps **"Synced"** at once, even offline (`log-work.tsx:226-229`). The header chip does say "Offline · N to send" (`sync-chip.tsx:316-318`).
- **Voice question.** `webkitSpeechRecognition` needs the network on Chrome for Android. On error the handler only sets `listening=false` (`ask-sheet.tsx:150`). She holds the mic, it stops, and no message appears. Typed questions get the local keyword answer (`voice.ts:45-126`). The agent card fails with "offline" (`agent-answer.tsx:47`). An escalation is queued (`store.ts:240-262`).
- **Phone restart, or the tab killed.** The season's events live only in memory (`store.ts:138`, `events: []`). Nothing persists them; the only stores on the device are the outbox and the person (grep: `outbox.ts`, `session.ts`). After a restart offline:
  - her earlier logged entries, the officer's messages and replies are gone from the screen;
  - the queued entries in the outbox are **not** folded back into the view;
  - the Today slip goes back to the simulated plan and can tell her again "Spray today at 06:00" (`farmer.ts:125-141`).
- **Back to signal at night.** Items are sent only while the page is open: on the `online` event, every 8 seconds, or on mount (`sync.tsx:118-124`). There is no Background Sync in `sw.js`. If she does not open the app at night, the desk sees nothing.
- **5-day outage.** The outbox holds the items and the stamps keep their order (`channel.ts:269-283`). But the weather comes from the service worker's network-first cache of `/api/weather` (`sw.js:59-68`), possibly 5 days old. The ribbon labels it **live** whenever hourly data exists (`farmer.ts:213-223`, `today-slip.tsx:33`). Its "now" index falls back to 0 when today is not found (`farmer.ts:216`). A forecast older than its 7-day horizon (`api/weather/route.ts:88`) shows old hours as "now".
- **Cleared storage.** See scenario 2: the outbox is gone.

**Advocate.** The bones are right and rare in agritech: an IndexedDB outbox in clock order, idempotent retries (`relay.ts:208-211`), per-event verdicts, scan and slip OCR on the device, and an honest sync chip. Five days of entries are tiny, far under the 240-per-minute limit (`sync/route.ts:96`).

**Skeptic.** "Offline-first" stops at the outbox. The record itself is not on the phone, so the restart that cheap phones do often erases her morning from her own screen and invites a double spray. The "Synced" stamp lies while she is offline. A stale forecast labelled live is the most dangerous single line here: she plans a spray on a weather picture days old. Voice fails silently, which is the one input low-literacy users rely on.

**Verdict:** PARTLY.

**Fix tailored to her**
1. **Keep the record on the device (M):** persist the event set and the messages/inbox in IndexedDB beside the outbox. On startup, load cached events plus pending outbox events before the server snapshot. Code: `store.ts` init, `sync.tsx`.
2. **Ripple stamp (S):** "Saved on phone · पाठवायचे" until the relay accepts, then "Synced" (`log-work.tsx:229`).
3. **Forecast age (S):**
   - Read `fetchedAt` from `/api/weather` (`route.ts:103`) and store it with the response.
   - Show "अंदाज ३ दिवस जुना" (forecast 3 days old) in red.
   - Mark the ribbon not-live when the forecast is older than 12 hours.
   - Refuse to show a window when today is not in the data (`farmer.ts:216`).
4. **Voice offline (S):** in `onerror`, say and show "आवाजाला इंटरनेट लागते; खालील बटणे वापरा" (voice needs internet; use the buttons below). Offer the four sample questions as big tap targets. Offline speech is the longer fix (G-C4).
5. **Background Sync (S):** register a sync tag in `sw.js` so the queue goes out when signal returns even with the tab closed (supported on Chrome for Android).

**Gaps.**
- **NEW F-1** (S1): the record is not kept on the device.
- **NEW F-6** (S1): a stale cached forecast is shown as live.
- Voice offline is known: S2, G-C4 / REMAINING 2.10.
- Phone failure testing is known: G-T5 / REMAINING 3.6.

---

## 4. Spray at 3 pm, rain at 6 pm; forgot to log; logged twice; wrong product

**Situation.** She sprays at 3 pm and rain comes at 6 pm. Another day she forgets to log, or taps twice, or sprays a product the agri-shop sold her that is not in the app's table.

**Walkthrough with today's code**
- **Before spraying.** The Today slip always says "Spray … at 06:00" (`farmer.ts:136-137`). The ribbon rates each hour only on **that hour's** rain, wind and temperature (`farmer.ts:206-212`). A 3 pm hour with rain at 6 pm can be "fair". Nothing checks for a 4 to 6 hour dry spell after spraying. The ribbon is colour-only with tiny labels (`today-slip.tsx:35-57`).
- **Logging.** Spray, then time of day: Morning 7, Afternoon 14 or Evening 18 (`log-work.tsx:26-30`). A red warning appears only if the **day's** rain is ≥5 mm (`log-work.tsx:182-187`).
- **After the rain.** Wash-off is decided by the daily total ≥5 mm whatever the hour (`season.ts:219`). Rain before her spray counts; 4 mm on fresh copper does not. If washed, a repeat is booked (`season.ts:222-224`). She learns this only by opening the app: no push (G-C5).
- **Asking "why did my spray fail?"** The answer invents the delay ("About N hours later") as `19 - hour` (`voice.ts:59`, `64`), not from the hourly data.
- **Forgot to log.** The engine assumes the booked spray happened. Simulated sprays are written with **human** provenance (`say(..., "human", …)`, `season.ts:236`). They protect the canopy (`season.ts:241-242`). The Today slip moves on. They also flow into the lot passport's export check (`lot.ts:48-53`, `67`).
- **Logged twice.** Same plot, day and kind: the later replaces the earlier (`events.ts:117`). A double tap is harmless. Two real sprays in one day (morning Bordeaux, evening copper) become one.
- **Logging later.** Logging is always for the current day `floor(t)` (`log-work.tsx:79`, `112`). The only way to log yesterday is to drag the wheel back. That moves the date on every phone and the desk (scenario 12).
- **Wrong product.** Only two choices: Bordeaux 1% and copper hydroxide (`log-work.tsx:171-179`, zod `events.ts:31`). She must pick one or skip logging. Picking "Bordeaux" for a shop fungicide gives her 10 days of modelled protection (`season.ts:229`) and suppresses booked sprays within 3 days (`season.ts:233`). An antibiotic or unregistered product cannot be recorded at all.

**Advocate.** Logging is three big taps with icons, which suits wet hands. The wash-off rebooking and the "What changed" ripple are a real feedback loop. Doses come only from the fixed table (`rules.ts:10-21`), so the app never invents a product.

**Skeptic.**
- The 3 pm, rain at 6 pm case, the exact story in the pitch, is not modelled by hour. The explanation she hears is made up.
- "Forgot to log = assumed done" is wrong for a record: it hides missed protection and makes the public lot passport claim export eligibility from sprays nobody confirmed.
- A two-product menu in a market where shops sell mixtures guarantees wrong data. The worst case is false protection during blight weather.

**Verdict:** FAILS for decisions; PARTLY for the log itself.

**Fix tailored to her**
1. **Spray-now check (S):** before "Write in my record", or from a "मी आता फवारणी करणार" (I'm about to spray) button, look at the next 6 hourly cells. If rain is likely, say aloud "३ तासांत पाऊस; थांबा" (rain in 3 hours; wait). Code: `farmer.ts`; the ribbon rule becomes "this hour, and the next 4 hours, dry".
2. **Wash-off by hour (M):** compare the spray hour with hourly rain in the following 4 hours (`season.ts:219`). Explain from the real figures (`voice.ts:59`).
3. **Separate simulated from recorded (M):** do not mark unconfirmed sprays as done for her plot. Show "फवारणी केली का? हो / नाही" (did you spray? yes / no) the next morning. Exclude unconfirmed sprays from passports, or label them.
4. **"Other product" choice (S):** take a photo of the bottle or bag and a free-text name. It is stored as an entry with `product: "other"`, gives **no** modelled protection, and flags the officer's inbox if the label photo shows a banned or unregistered product. Extend the zod `entry` (`events.ts:31`) and the engine (`season.ts:218`).
5. **"Yesterday / day before" chips on the log (S)** instead of dragging the wheel. Allow several entries per day: key by event id, not plot|day|kind (`events.ts:117`).

**Gaps.**
- **NEW F-4** (S1): unlogged sprays assumed done, with human ink, feeding the passport.
- **NEW F-5** (S1): two products only; a wrong product gives false protection.
- **NEW F-19** (S2): rain after spray is judged by day, not by hour; the explanation is invented.
- **NEW F-10** (S2): no backdating; one entry per kind per day.
- No push is known: S3, G-C5.

---

## 5. Blight appears: leaf scan, "what should I spray?" by voice, officer on leave

**Situation.** She sees oily spots on leaves. She scans a leaf and asks in Marathi what to spray. The extension officer is on leave for 3 days.

**Walkthrough with today's code**
- **The button.** It says "Scan a leaf · पान स्कॅन करा" (`phone.tsx:151-152`). The frame says "एक पान, चौकट भरून" (one leaf, filling the frame; `scan-lens.tsx:240`). Only a 12 px English line says the pomegranate model wants **the fruit** (`scan-lens.tsx:229`).
- **The model on a leaf.** The pomegranate model is fruit-only (G-D3/G-D4). A leaf photo still produces a softmax over the 5 fruit classes. There is no out-of-distribution rejection: `cropMismatch` is always false for pomegranate (`scan.ts:69-71`). Possible outcomes:
  - "Healthy pomegranate", which falsely reassures her ("The fruit looks healthy", `scan.ts:60`);
  - a fungal class;
  - blight. Blight at ≥60% gives curative-spray advice and a Save button (`scan-lens.tsx:355-363`).
  Below 60% she sees a retake hint (`scan-lens.tsx:333-342`).
- **Model missing.** If `metrics.json` fails to load (not installed, or not cached), the app shows a **scripted "blight 87%"** with copper advice (`scan-lens.tsx:135-143`), marked only by a small SIMULATED stamp.
- **Voice question.** "मी काय फवारू?" (what do I spray?) does not contain "फवारणी", "फवारले" or "औषध" (`voice.ts:13`), so it is "unknown". She gets an escalation and "usually replies the same day" (`voice.ts:119-125`). "कोणते औषध फवारू?" (which medicine do I spray?) matches "औषध", so she gets the next booked spray (`voice.ts:69-81`). "आज फवारणी करू का" (shall I spray today?) matches "का " (padded, `voice.ts:14`, `21`), so she gets the **spray-failed** answer. The chips always say "Gat 214" (`voice.ts:38`). The server agent answers alongside (`ask-sheet.tsx:258`) and can disagree with the spoken local answer.
- **Officer on leave.** The escalation sits in the inbox. There is no acknowledgement, deadline, reassignment or reminder (grep for overdue, reassign or SLA finds nothing). The farmer sees "Queued · usually answered the same day" (`ask-sheet.tsx:94`). A reply reaches her only when the app is open.

**Advocate.** The guard means any dose she hears comes from the spray table, never from the model. Photo-quality checks are in Marathi (`scan.ts:137-142`). Low-confidence results say so. Escalation carries her recent record (`store.ts:245-248`), which saves the officer a phone call.

**Skeptic.** Calling a fruit classifier "Scan a leaf" is a design error with crop-loss consequences: telya on leaves is the early sign, and the app may tell her the plant is healthy. The scripted 87% result must never reach a real phone. The keyword router misreads ordinary Marathi grammar ("…करू का"). Three days without an answer during blight weather is too long, and the app promises same-day.

**Verdict:** FAILS.

**Fix tailored to her**
1. **Make the scan say what it can do (S):** rename it "फळ तपासा" (check the fruit) while only the fruit model exists. Show a picture of a fruit in the frame. For leaves, show "पानांसाठी अजून मॉडेल नाही; फोटो अधिकाऱ्यांना पाठवा" (no leaf model yet; send the photo to the officer), with a one-tap escalation that **includes the photo**.
2. **Reject out-of-distribution input (M):** a "not a pomegranate fruit" check using an entropy or max-probability threshold calibrated on leaf and background photos.
3. **Remove the scripted fallback from the farmer route (S):** `scan-lens.tsx:135-143`.
4. **Router (S):** drop "का " from FAILED; add "फवार", "फवारा", "मारलं", "दवा"; drop the hard-coded Gat 214 (`voice.ts:38`) and use her plot. Speak the guarded agent's answer when online, so there is one answer, not two.
5. **Escalation rules (M):** auto-acknowledge with a named backup officer or the FPO coordinator. If there is no reply in 4 hours during a blight watch or warning, route to the backup and send an SMS. Show the farmer who has it and since when. Desk inbox plus a job (REMAINING 2.1).

**Gaps.**
- No leaf model is known: S2, G-D4; field accuracy is known: G-D3.
- **NEW F-7** (S1): fruit model behind a "leaf" button, no out-of-distribution rejection, scripted result possible.
- **NEW F-14** (S2): router misreads and silent voice failure.
- **NEW F-13** (S2): no escalation SLA or backup (relates to G-O5).

---

## 6. Advisory at 9 pm; not opened for 2 days; neighbour without a smartphone; cannot read it

**Situation.** The officer sends a blight advisory at 9 pm. Sunita does not open the app for two days. Her neighbour has a feature phone. Sunita herself struggles to read it.

**Walkthrough with today's code**
- **Delivery.** Messages arrive over server-sent events only while the app is open. There is no push (G-C5). On open, the snapshot carries them (`relay.ts:242-243`), and "delivered" is sent then (`messages.tsx:39-43`).
- **Old messages get no banner.** A banner appears only for messages sent after the page opened (`messages.tsx:49`). A 2-day-old advisory shows as a red count on a 36 px bell (`messages.tsx:69-71`).
- **No date.** The list shows only the time (`hm()`, `messages.tsx:11`, `119`): "21:00" with no day. Its spray date may already be past.
- **Read receipts.** Opening the list marks **all** messages read (`messages.tsx:64`), so the officer believes she read them.
- **Neighbour.** The channel is chosen at batch time. SMS is a simulator with *sim* receipts (`relay.ts:91-121`; G-C1). Nothing switches an undelivered app message to SMS.
- **Cannot read.** Each message has an "ऐका" (listen) button using a Marathi voice, else Hindi (`messages.tsx:13-20`). If neither is installed, the browser default voice reads Devanagari poorly or not at all *(unverified per device)*. Texts are cut at 160 UTF-16 units (`relay.ts:116`). Marathi can be cut mid-word, and 160 units of Devanagari is about 3 SMS segments in UCS-2.

**Advocate.** Receipts come from the real phone and simulated ones are labelled. The text is prepared and stored on the server and sent once (`relay.ts:104-121`), so a double click never spams her. A listen button on each message is the right instinct.

**Skeptic.** An advisory she sees 2 days late, with no date and no banner, may push her to act on a window that has passed. "Read" receipts that mean "the list was opened" give the desk false confidence. Truncating Marathi is careless.

**Verdict:** PARTLY in the room; FAILS for real reach.

**Fix tailored to her**
1. **Show the date and freshness (S):** "परवा रात्री ९ वाजता" (the day before yesterday, 9 pm), and "ही वेळ गेली" (this window has passed) when the advised day is over (`messages.tsx:11`, `119`).
2. **Banner on next open for any unread advisory less than 3 days old (S)**, with auto-play of the Marathi audio after one tap.
3. **Receipts (S):** count "read" per message when it is expanded or played, not when the list opens (`messages.tsx:64`).
4. **Fallback (M):** if no "delivered" within 2 hours (or by 6 am for a night advisory), send by SMS (and later WhatsApp, or a voice call through IVR). This needs the delivery service, REMAINING 2.3.
5. **Truncate at a word boundary with a "…" (S)** and fit templates to UCS-2 segment lengths.
6. **Pre-recorded audio (M)** of reviewed Marathi templates, served as small files, so listening does not depend on an installed voice.

**Gaps.**
- Push, SMS, WhatsApp and IVR are known: G-C5 (S3), G-C1 (S1 for a pilot), G-C2, G-C3.
- **NEW F-12** (S2): message display and receipts (no date, no banner for older messages, read-on-open, Marathi truncation, no fallback on non-delivery).

---

## 7. Lost, stolen or broken phone; new SIM; changed number; phone sold while signed in

**Situation.** The phone falls in a canal, or is stolen, or is sold second-hand. Sometimes she gets a new SIM with the same number, sometimes a new number.

**Walkthrough with today's code**
- **Broken phone, same number** (a duplicate SIM from the operator). She signs in on another phone. Her record is on the server (append-only, `event-store.ts`). She loses only what was in the old phone's outbox.
- **Stolen phone, or sold while signed in.**
  - The cookie lasts 30 days, fixed, not sliding (`identity.ts:263`, `auth.ts:45`).
  - `revoke` exists only for the caller's own token (`identity.ts:411-414`). There is no "sign out other devices" and no staff revoke route. The `sessions` table has `revoked_at`, but nothing sets it per person.
  - The buyer opens Chrome and sees her name, gat and village, her sale slips (income), her messages and her questions. They can log events and ask questions as her.
  - The service-worker cache also holds `/api/v1/auth/me` (network-first caches every GET, `sw.js:59-68`).
- **Changed number.** People are keyed by phone (`identity.ts:327-340`, upsert on conflict(phone)). There is no change-number flow. A new number is a new, empty person until the FPO edits the database.
- **Recycled number.** Indian operators reassign numbers that have been inactive for about 90 days *(policy, not code)*. The new holder of her old number can request a code and become her.
- **30-day expiry in the field.** Offline, she keeps working (`session.ts:213-216`) and items stay queued on 401 (`sync.tsx:96`). Back online she must sign in again. If someone else signs in first, see scenario 2.

**Advocate.** Losing the phone does not lose the record. That is the payoff of the server-side, hash-chained store. Session tokens are hashed, and each sign-in creates a device row (`identity.ts:386-393`), so remote revocation has a place to hang.

**Skeptic.** A 30-day session with no remote kill on a shared or resold phone exposes income data and lets a stranger write to her record. There is no recovery path for a changed number, which is common with ₹19-pack users who switch operators. Recycled numbers are a real account-takeover route once SMS is live.

**Verdict:** PARTLY (data survives); FAILS (security and recovery).

**Fix tailored to her**
1. **Devices list in the FPO desk (S/M):** "Sunita's phones: Phone, signed in 3 Oct", with "sign out all". Add `Identity.revokeAll(personId)` and an endpoint for staff.
2. **A sliding session of 30 days from last use (S)**, plus a short PIN or pattern lock inside the app for income screens (slips, passbook) on shared phones (M).
3. **Number change at the FPO desk (M):** staff verify her in person (Aadhaar seen, not stored) and move her person to the new number, with an audit row (REMAINING 2.5).
4. **Recycled-number guard (M):** a code request for a number with no sign-in for 60 days or more needs FPO confirmation.
5. **Do not cache `/api/*` GETs other than weather in `sw.js` (S).**

**Gaps.** **NEW F-9** (S1 once real): no remote revoke, no number change, no recycled-number guard, fixed 30-day session, API GETs cached.

---

## 8. Picking day and sale: log a picking; photograph the patti in front of the adatiya

**Situation.** She picks 23 crates (mixed grades) and sells at Phaltan APMC. At the adatiya's shop, she photographs the patti in front of him. Sometimes the patti is handwritten.

**Walkthrough with today's code**
- **The picking tab is disabled until the simulated stage reaches maturity or harvest** (`log-work.tsx:89-90`, `133`, `154-156`). If her real orchard is earlier than the synthetic plot, she cannot log a picking at all.
- **Crate count.** A stepper in steps of ±5 only, starting from the planned count (`log-work.tsx:95`, `206-208`). She cannot enter 23 (the reachable values are 30, 25, 20…). One grade per picking (`log-work.tsx:212`). Two pickings in one day collapse into one (`events.ts:117`).
- **Patti.** OCR runs on the phone: English first, then Marathi plus English if weak (`slip-check.tsx` lines 177-190 per the file's own numbering). Unread fields can be typed in (`setNum`). The rate card is a constant (`patti.ts:215-219`, G-P6). The verdict is a large red line "charged above the agreed rate card" with an alert stamp, readable by anyone looking at the screen (`slip-check.tsx` ~344-355).
- **Evidence.** The photo is not kept with the filed slip. Only the parsed numbers go in the event (`events.ts:36-52`). The escalation to the officer carries text only.
- **Two pattis in one day** (two lots, two adatiyas) collapse to one (`events.ts:119`, key plot|day).
- **Handwriting.** Tesseract was tested on three printed specimens (G-D10). Handwriting will mostly come out as unread fields.

**Advocate.**
- Reading the patti on the phone, with no upload, is right for privacy.
- The checker's arithmetic and the "₹ you may be owed" figure are concrete and useful.
- Sharing a dispute note in Marathi (`slip-check.tsx` share via `navigator.share`) fits WhatsApp habits.

**Skeptic.**
- Showing a red accusation on screen in front of the adatiya, who may be her creditor, puts her in a socially dangerous spot.
- She will simply not use the feature.
- The checker compares against an app constant, not her FPO's agreed card.
- Without the photo, a dispute is her word against his.
- The ±5 stepper and the stage gate make accurate picking records impossible.

**Verdict:** PARTLY.

**Fix tailored to her**
1. **Quiet capture (S):**
   - At the shop, one button "फोटो ठेवा" (keep the photo) saves the image on the device (IndexedDB) with no verdict on screen.
   - The check runs later at home, with a neutral line "३ गोष्टी विचारायच्या" (3 things to ask).
   - Keep the photo with the slip as evidence. If she asks the officer, upload it with consent.
2. **Picking entry (S):**
   - A numeric keypad for the crate count.
   - A split by grade (A: 12, B: 8, C: 3).
   - Allow logging at any stage, with a soft "early?" note.
   - Several pickings per day, keyed by event id.
3. **Rate card per FPO and per adatiya (M):** REMAINING 2.7.

**Gaps.**
- **NEW F-11** (S2): picking gated by simulated stage, ±5 stepper, single grade.
- **NEW F-18** (S2): visible verdict at the shop, no photo kept, one slip per day.
- OCR on real pattis is known: S2, G-D10.
- Rate card is known: S2, G-P6.

---

## 9. Sunlight, font size, Devanagari; a farmer who cannot read; dialect or Hindi

**Situation.** Midday sun on a dim LCD. She reads Marathi slowly. Some neighbours cannot read at all; some speak only Hindi (migrant labour) or a strong local dialect.

**Walkthrough with today's code**
- **English comes first everywhere; Marathi is second and usually smaller.** Examples:
  - Log buttons: English 15 px bold, Marathi 13 px (`log-work.tsx:148-149`).
  - Bottom bar: 17 px against 14 px (`phone.tsx:151-152`).
  - Today slip: 22 px against 19 px (`today-slip.tsx:79-80`).
- **Small text.** 44 places in `components/farmer` use 10 to 11.5 px text (grep count), including the sync chip at 10.5 px (`sync-chip.tsx:329`).
- **Contrast.** Colours are muted manila and paper (`globals.css:12-32`). `--ink-3` (#5f5a50) is used for hints on paper.
- **Page language.** `<html lang="en">` (`layout.tsx:24`), with no `lang="mr"` on Marathi spans. Chrome on a Marathi-locale phone may offer to "translate" the page, and screen readers read Devanagari with English rules.
- **Fonts.** Anek Devanagari, Tiro Devanagari Marathi and Kalam are self-hosted through `next/font` (`layout.tsx:8-11`), so they render without system fonts.
- **Cannot read.** Listening exists for Ask answers (auto-spoken, `ask-sheet.tsx:133`), messages and officer replies. There is **no listen button on the Today slip or on "What I did"**, the two screens she uses daily. Icons help on the log buttons.
- **Hindi or dialect.** Speech recognition is fixed to `mr-IN` (`ask-sheet.tsx:140`). The keyword lists have a few Hinglish words but no Hindi spray words ("छिड़काव", "दवा") and no colloquial "फवारा मारला" (`voice.ts:13`).

**Advocate.** The design is consistent, with large touch targets (min-h-12 to min-h-16), and Marathi is present on almost every control. Self-hosted Devanagari fonts avoid tofu boxes on old phones. Photo-quality hints tell her to step out of direct sun (`scan.ts:141`).

**Skeptic.** For this user Marathi must be the headline, not the subtitle. The screen she needs most (Today) cannot be heard. 10 to 11 px grey text is unreadable in sun. The ribbon is colour-only, a problem in glare and for colour-blind users. Hindi speakers get nothing.

**Verdict:** PARTLY.

**Fix tailored to her**
1. **Marathi-first mode (M):** on by default for farmers. Marathi at the large size, English small or hidden. Set `lang` per span (`lang="mr"` on Marathi text). A language switch Marathi / हिंदी / English with Hindi strings for the core screens.
2. **A "ऐका" (listen) button on the Today slip and after each log (S),** reading the action, date and dose. Pre-recorded audio for the fixed templates (M).
3. **High-contrast "sun mode" (S):** pure black on white, a 14 px minimum, and a pattern plus the word "आता नको" (not now) on bad ribbon cells.
4. **Router words (S):** add Hindi and colloquial forms (`voice.ts:13-17`). Allow the recogniser language to follow the chosen language.

**Gaps.**
- **NEW F-15** (S2): English-first hierarchy, no listen on the Today slip or the log, `lang="en"`, many text sizes ≤11.5 px, no Hindi.
- IVR for those who cannot read is known: S3, G-C3.

---

## 10. Cost: data, storage, old Android and Chrome

**Situation.** She buys ₹19 data boosters *(about 1 GB for a day at recent prices; changes often)*. Her phone has 32 GB, full of WhatsApp videos. It runs Android 9 to 11 with a Chrome she never updates.

**Walkthrough with today's code**
- **First visit.** The service worker's install precaches everything at once, whether or not she ever scans (`sw.js:3-29`), about **46 MB** from file sizes:
  - plant model 9.2 MB;
  - pomegranate model 16.8 MB;
  - ONNX Runtime WebAssembly 14.2 MB;
  - Tesseract `eng` 2.95 MB and `mar` 1.97 MB;
  - samples about 0.8 MB.
  
  The OCR core adds 3.9 MB on first use. Transfer-encoding may shrink the WebAssembly, but fp32 weights barely compress *(estimate)*.
- **On 2G** (about 100–200 kbit/s) that is 30 to 60 minutes *(estimate)*. `cache.addAll` is all-or-nothing, so one dropped request means no offline support, and the whole precache starts again on the next load.
- **Opening Scan.** It loads **both** models every time, plant and pomegranate (`scan-lens.tsx:86`, `99`): more than 26 MB of fp32 weights in memory plus the runtime. On a 2–3 GB RAM phone with the camera open, Chrome may kill the tab *(unverified on device; G-D5)*.
- **Live data.** The event stream sends the **whole season record** to each screen on every (re)connect (`relay.ts:239-243`), and EventSource reconnects after every signal drop. With 1,000 farmers × 60 events × 350 bytes, that is about 20 MB per reconnect *(estimate)*. Pings every 15 s keep the radio awake (`sync/route.ts:77`).
- **Battery.** Every incoming event from any farmer regenerates all 192 plots × 245 days on her phone (`store.ts:120-126`). That takes about 150 ms on the laptop (ARCHITECTURE:255), several times longer on a low-end CPU *(estimate)*. When the officer "plays" the season, `time` messages up to 4 a second go to every phone (`sync.tsx:104-113`, `relay.ts:186-191`).
- **Storage.** There is no `navigator.storage.persist()` (grep finds none). Under disk pressure Chrome evicts the origin's cache **and IndexedDB together**, taking the unsent outbox with them.
- **Old Chrome.** Only the SIMD WebAssembly build of ONNX Runtime is shipped (`public/ort`, `scan-lens.js:6-9`): Chrome before 91 cannot run Scan. Tailwind v4 (`package.json:77`) targets roughly Chrome 111 and later; older Chrome may render without layout *(unverified)*. Tesseract ships non-SIMD cores (`public/tesseract/core`), so OCR works on old phones.

**Advocate.** Everything is self-hosted on the origin, with no CDN calls. After the first download, Scan and OCR cost no data. Models are cached once. The "nothing leaves this phone" line (`scan-lens.tsx:202`) is true and matters for trust.

**Skeptic.**
- Forty-six megabytes before she has done anything, sent over 2G and all-or-nothing, is a wall.
- Re-sending the whole taluka's record on every reconnect will cost more than the models within a season, and it leaks other farmers' data (G-B2).
- Losing unsent work to automatic eviction on a full phone is invisible to her.

**Verdict:** FAILS on the target phone and network *(pending device measurement)*.

**Fix tailored to her**
1. **Precache only the page shell (S)** (pages, JavaScript and fonts, about 1–2 MB). Download models on first use with progress ("फळ तपासणीसाठी १७ MB लागेल; वायफायवर डाउनलोड करा?" — fruit check needs 17 MB; download on Wi-Fi?). Cache each file separately, not with `addAll`. Code: `sw.js`.
2. **int8 pomegranate model (about 4 MB) and load only the chosen crop's model (M):** G-D5, REMAINING 2.9; `scan-lens.tsx:86`, `99`.
3. **Incremental sync (M):** the client sends its last seen stamp and the server sends only newer events, and only her projection (REMAINING 1.3.2). Lengthen ping intervals on mobile. Do not broadcast `time` to farmers (G-B15).
4. **Request persistent storage (S)** after sign-in. Show "space low" if `storage.estimate()` is under 200 MB.
5. **Feature-detect (S):** check WebAssembly SIMD before offering Scan, and show "this phone cannot run the check; send a photo to the officer". Ship the non-SIMD ONNX Runtime build. Run a smoke test on an old Chrome.

**Gaps.**
- **NEW F-16** (S2): data and storage cost (46 MB all-or-nothing precache, both models loaded, no persistent storage, full snapshot per reconnect, full regenerate per event).
- **NEW F-21** (S3): old-Chrome support unverified (SIMD-only runtime, Tailwind v4 baseline).
- int8 model is known: G-D5.
- Projections are known: G-B2.

---

## 11. Extra: the season ends, the phone clock is wrong, or the orchard is not Mrig bahar

**Situation.** It is February, harvest is still going, and she logs pickings. Or the phone's clock reset after the battery died. Or her neighbour runs an Ambia bahar orchard.

**Walkthrough with today's code**
- **Season end.** The season is 245 days from 1 June 2026 (`calendar.ts:3`). `realToday()` is clamped to day 244, 31 Jan 2027 (`calendar.ts:33`, `36-39`). From 1 Feb every entry is stamped 31 Jan. Because the key is plot|day|kind (`events.ts:117`), **each new picking replaces the previous one**.
- **Wrong clock.** A phone clock in the past clamps to day 0 (1 June). Its clock stamps sort before her earlier entries (`channel.ts:269-273`), so a correction can **lose** to the entry it was meant to correct.
- **Other bahars.** Ambia or Hasta bahar is not modelled (CONTEXT §2). The stage gates (scenario 8) and the Today slip would be wrong all season.

**Advocate.** Deterministic, clamped days keep the engine from crashing on bad input. Clock stamps are monotonic per device.

**Skeptic.** A record that silently overwrites in February, the core of the Mrig harvest, is data loss. Ambia farmers are a large share of Phaltan's pomegranate growers *(domain knowledge; confirm with the FPO)*.

**Verdict:** FAILS at season end; PARTLY otherwise.

**Fix.**
1. **Season per plot (M):** bahar date and length from enrolment (G-P2), with a rolling calendar, not a fixed 245 days.
2. **Reject impossible dates (S):** refuse to log when the device date is outside the plot's season. Use the server's time when online and warn "फोनची तारीख चुकीची आहे" (the phone's date is wrong).
3. **Keying (S):** key entries by event id (see F-10).

**Gaps.**
- **NEW F-20** (S3; S1 for February pickings): device clock trusted, season clamped at day 244, so entries overwrite.
- Enrolment with the bahar date is known: G-P2.

---

## 12. Extra: a child plays with the season wheel

**Situation.** Her son drags the "violet dot" round the wheel, as the hint invites (`phone.tsx:104-105`). Then she logs a spray.

**Walkthrough with today's code**
- **Dragging the wheel changes `t`.** `SyncBridge` posts a `time` message (`sync.tsx:130-137`). Farmers are allowed to send it (`authz.ts:122-124`). The relay broadcasts it to everyone (`relay.ts:186-191`, `visible` default `relay.ts:53`). Every phone and the desk jump to that date (`sync.tsx:34-38`).
- **Her log lands on the scrubbed day** (`log-work.tsx:79`, `112`). The Today slip and the spray ribbon show that day too: the ribbon is live only if `day === today` (`today-slip.tsx:23`).

**Advocate.** The wheel is a lovely way to explain the season, and the date stamp shows the day being viewed.

**Skeptic.** In a real product, one child in Taradgaon can move every farmer's "today". It also silently back-dates her own entries.

**Verdict:** FAILS for a multi-farmer deployment.

**Fix (S):**
- Farmers never send or receive `time`.
- Scrubbing is a local "view" mode, with a large "आजवर परत" (back to today) button.
- Logging always uses the real date, or the explicit "yesterday" chip.

**Gap.** Known: G-B15 (S2). The consequence for farmers is new, so G-B15 should be raised to S1 for the phone.

---

## Five cross-cutting findings for farmers

1. **Her record does not live on her phone.** Only the outbox and her name are stored. A restart, a killed tab or a reload offline erases her own entries, messages and replies from view. Clearing data or automatic eviction erases unsent work. Offline-first has to cover the record she reads, not only the queue (F-1, F-16).

2. **The shared phone is the normal case, and today it loses data.** There is no sign-out on phone screens. Queued work is sent under whoever signs in next and is deleted when refused. There is no "who did it" field, and store data stays in memory between people (F-2, F-3, F-22, F-23; G-P1).

3. **The record states things nobody confirmed.** Simulated sprays carry human provenance and protect the canopy in the model. Unknown products have to be mislabelled as the two table products. Wash-off is judged by day. The "hours later" explanation is invented. The public lot passport's export claim is built on all of this. A record you can trust needs "confirmed by her", "assumed" and "unknown product" as distinct states (F-4, F-5, F-19).

4. **Her guidance can be stale or wrong without saying so.** A cached forecast is shown as live. A fruit model sits behind a "Scan a leaf" button, with no rejection of non-fruit photos, and a scripted 87% blight result is still in the code path. Marathi grammar ("…करू का") misroutes questions. Advisories show no date. Every one of these needs a visible, spoken caveat in Marathi (F-6, F-7, F-12, F-14).

5. **The cost of getting started is too high for 2G and ₹19 packs.** The OTP flow has silent dead ends, the certificate warning blocks a first visit, 46 MB is precached all-or-nothing, and per-IP limits trip at FPO meetings. Onboarding must be assisted at the FPO desk, with a small first download (F-8, F-16, F-17; REMAINING 2.4, 2.5).

---

## Ranked list of new gaps

| Rank | Id | Gap | Sev | Where | Size |
| --- | --- | --- | --- | --- | --- |
| 1 | **F-1** | Season events, messages and inbox are not kept on the device. An offline reload shows the simulated plan, not her entries, and queued entries are not folded into the view | S1 | `store.ts:138`, `sync.tsx` | M |
| 2 | **F-2** | Outbox items are not bound to their author. After another person signs in they are rejected (200 per-event or 403) and **deleted** | S1 | `sync.tsx:93-98`, `relay.ts:155-171`, `179` | S |
| 3 | **F-3** | No sign-out below 640 px. Shared or resold phones cannot switch person except by clearing data, which erases the outbox | S1 | `phone.tsx:77` | S |
| 4 | **F-4** | Unlogged booked sprays are assumed done, recorded with "human" ink, and feed the public lot passport's export check | S1 | `season.ts:236`, `241-242`; `lot.ts:48-53` | M |
| 5 | **F-5** | Spray logging allows only two products. A wrong product gives false 10-day protection and suppresses advice. Unregistered or banned products cannot be recorded | S1 | `log-work.tsx:171-179`, `events.ts:31`, `season.ts:229`, `233` | S–M |
| 6 | **F-6** | A stale service-worker-cached `/api/weather` is shown as a LIVE spray window. "now" falls back to the first cached hour | S1 | `sw.js:59-68`, `farmer.ts:213-223`, `today-slip.tsx:33` | S |
| 7 | **F-7** | Fruit-only model behind "Scan a leaf". No out-of-distribution rejection. Scripted "blight 87%" when the model is missing | S1 | `phone.tsx:151`, `scan-lens.tsx:135-143`, `229`, `240`; `scan.ts:69-71` | S (labels), M (rejection) |
| 8 | **F-9** | No remote "sign out everywhere", no number change, no recycled-number guard, fixed 30-day session, API GETs cached by the service worker | S1 when real | `identity.ts:263`, `411-414`; `sw.js:59-68` | M |
| 9 | **F-20** | After 31 Jan 2027 every entry clamps to day 244 and overwrites the previous one. A wrong device clock misdates entries and misorders corrections | S1 for Feb pickings, else S3 | `calendar.ts:33-39`, `events.ts:117`, `channel.ts:269-273` | S |
| 10 | **F-16** | Data and storage: 46 MB all-or-nothing precache; both models loaded per scan; no persistent storage; full season snapshot on every reconnect; full regenerate per remote event | S2 | `sw.js:3-29`, `scan-lens.tsx:86`, `99`, `relay.ts:239-243`, `store.ts:120-126` | M |
| 11 | **F-8** | OTP dead ends: an unknown or mistyped number looks "sent"; no resend or countdown; only the newest code is valid; 5-minute TTL; per-IP limits at meetings and behind carrier NAT | S2 | `identity.ts:354-358`, `371-373`; `otp/route.ts:11`; `verify/route.ts:23`; `sign-in.tsx:37-40`, `81` | S |
| 12 | **F-12** | Advisories: no date, no banner for older ones, "read" receipts on list open, Marathi cut at 160 units, no fallback to SMS when an app message is undelivered | S2 | `messages.tsx:11`, `49`, `64`; `relay.ts:116` | S (+M fallback) |
| 13 | **F-13** | Escalations: no acknowledgement, deadline, backup officer or reminder. Farmers are promised "usually the same day" | S2 | `voice.ts:123`, `ask-sheet.tsx:94` | M |
| 14 | **F-14** | Voice fails silently offline. The keyword router misroutes ("करू का" → spray-failed; misses "फवारा" and "दवा"). Hard-coded "Gat 214". Invented "hours later" | S2 | `ask-sheet.tsx:150`; `voice.ts:13-14`, `38`, `59` | S |
| 15 | **F-19** | The spray ribbon ignores rain in the drying hours after spraying. Wash-off is judged by daily total, not hour | S2 | `farmer.ts:206-212`, `season.ts:219` | S–M |
| 16 | **F-11** | Picking logging is gated by the simulated stage; crate stepper ±5 only; one grade per picking | S2 | `log-work.tsx:89-90`, `133`, `206-212` | S |
| 17 | **F-10** | Logging only "today" (or a scrubbed day); no "yesterday"; one entry per kind per day | S2 | `log-work.tsx:79`, `112`; `events.ts:117` | S |
| 18 | **F-15** | English-first type hierarchy; no listen on the Today slip or log; `lang="en"`; 44 uses of text ≤11.5 px; no Hindi | S2 | `layout.tsx:24`, `log-work.tsx:148-149`, `today-slip.tsx` | M |
| 19 | **F-18** | Patti check shows a red accusation at the shop; the photo is not kept as evidence; one slip per plot per day | S2 | `slip-check.tsx` (~344-355), `events.ts:36-52`, `119` | S–M |
| 20 | **F-17** | Distribution: no manifest/installable app; self-signed certificate warning; service worker only in production on a secure origin | S2 | `phone.tsx:56-61`, CONTEXT §9–10 | S (+hosting G-T6) |
| 21 | **F-21** | Old Chrome: SIMD-only ONNX Runtime; Tailwind v4 browser baseline; no feature detection or fallback | S3 | `public/ort`, `package.json:77` | S |
| 22 | **F-22** | The store (inbox, messages, events) is not reset on a person change. The Ask sheet lists the inbox unfiltered by plot | S3 | `store.ts:274-278`, `ask-sheet.tsx:227-231` | S |
| 23 | **F-23** | No "who did this work" on entries: the husband's or son's work is attributed to the signed-in person | S3 | `events.ts:30-34`, `relay.ts:158` | S |

**Existing gaps these scenarios touch:**
- G-P1 / 1.3.7 (shared phone)
- G-P2 / 2.5 (enrolment)
- G-B2 / 1.3.2 (projections; also a data-cost issue)
- G-B4 / 2.4 (SMS OTP)
- G-B15 (global clock: raise to S1 for farmer phones)
- G-C1, G-C2, G-C3, G-C4, G-C5 (channels, voice, push)
- G-D3, G-D4, G-D5, G-D10 (models, OCR)
- G-P6 / 2.7 (rate card)
- G-O5 (support)
- G-T5 / 3.6 (failure tests: add "week offline plus restart" and "second person signs in with a full outbox")
- G-T6 (hosting)
