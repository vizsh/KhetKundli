# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js full-stack (App Router, TypeScript), Tailwind CSS v4, shadcn/ui, Motion (motion.dev), React Bits components via the shadcn registry, MapLibre GL + deck.gl for maps, D3 for bespoke charts. Season simulation, routing heuristic and API routes run in TypeScript inside the one deployable app. Python is used only offline, to train and quantise the on-device disease model (ONNX, run in the browser with ONNX Runtime Web). Chosen by the user over a separate FastAPI/OR-Tools engine to keep the live demo reliable.

## Users

- **Smallholder pomegranate farmer in Phaltan taluka (Satara, Maharashtra).** Often low-literacy, Marathi-speaking, on a shared or low-end Android phone with patchy signal in the orchard. Jobs: decide bahar timing, catch bacterial blight early, know when to spray and irrigate, choose when and where to sell, move a small staggered harvest.
- **FPO coordinator / agricultural extension officer.** Watches the whole taluka: where disease is spreading, which villages will harvest which week, which pooled transport runs go when. Works at a desk or on a laptop.
- **Hackathon judges (Phaltan Hackathon, agriculture track).** Evaluate in a few minutes whether this is one integrated product or six apps behind a login, and whether it is technically real.
- Secondary operational roles in the transport flow: owner-driver, village collection-point agent, adatiya (commission agent) at Phaltan APMC.

## Product Purpose

KhetKundli gives every plot a living season record that six modules read from and write to (advisory, protection, query support, sustainable-practice engagement, market, transport). Combining many anonymised plot records produces village-level intelligence that no single-farmer app can see: Pest Radar (early outbreak warning), Harvest Wave (village harvest-timing forecast that prevents gluts and lets pooled transport be planned days ahead), and Water Commons (collective groundwater use against a village target). Success for the hackathon: a judge sees one event (a blight scan, a rain forecast) ripple across every module live, and believes the system is real.

## Positioning

Personal field memory plus collective sight. The plot record is the integration layer, not an afterthought, and the collective layers exist only because many plot records are combined. Key claim: the crop-advisory layer is the demand forecast for the logistics layer, because crop stage on every plot predicts when each village will harvest.

## Operating Context

- Geography: Phaltan taluka, Satara district; drought-prone south and south-west. Corridor: village collection points to Phaltan APMC (primary) and Pune market yard (~110 km, secondary).
- Hero crop: pomegranate (bahar timing, bacterial blight, drip irrigation, multiple pickings graded by quality). Second crop: tomato or capsicum to show generalisation.
- Farmer flow is voice-first and offline-first; the scan must work in airplane mode on stage.
- Demo script: "one leaf, one season, one sale": offline scan, voice query answered from the plot record, sync ripple to Pest Radar, rain-forecast twist re-planning everything, Harvest Wave date drag, pooled run with lot passport, auction-slip settlement waterfall, Season Time Machine replay.
- Source problem statements combined: Govt. of Punjab smart crop advisory; Govt. of Kerala personal farming assistant, gamified sustainable practices, farmer query support; Qualcomm ID 26257 on-device detection; team's own "Uber for Harvest" research.

## Capabilities and Constraints

- Event-sourced plot record; every module writes events; every view derives state at a chosen day, which is what makes the Season Time Machine possible.
- Live data where available: Open-Meteo weather/ET0 (no key), Agmarknet prices via data.gov.in (needs a user-supplied API key; seeded fallback). On-device model in the browser.
- Simulated: the village network of ~150-200 plots, WhatsApp delivery, payments. Every data source is labelled LIVE or SIMULATED on screen.
- Pesticide doses come from a fixed rules table; language models only explain, never invent doses.
- Community maps aggregate to H3 hexagons; individual farms never shown on shared views.
- Out of scope: any named lender or finance partner (Satin Finserv and SANKALP are removed), carbon-credit claims, multi-state coverage, real payments.
- Timeline: 1-2 weeks to the demo.

## Brand Commitments

- Product name: KhetKundli (the plot's "kundli", a birth chart that keeps updating through the season). Team name: Team Outliers.
- Language: English-first interface for judges, with a Marathi (Devanagari) layer on farmer-facing text and voice. Marathi must be typographically first-class wherever it appears, never an afterthought translation.

## Evidence on Hand

- Combined problem statement (Phaltan Hackathon PS v2, Claude Doc) and the Uber for Harvest research PDFs in the user's Downloads.
- No farmer interviews, field photos, pilots or partner agreements exist yet. Do not fabricate testimonials, user counts, accuracy figures, partnerships or outcomes. Demonstration data must be labelled synthetic.

## Product Principles

1. One record, many faces: every feature reads from and writes to the plot record; nothing stands alone.
2. Collective sight is the differentiator: show what only many plots together can reveal.
3. Prove, don't claim: live data and labelled simulation over unsupported numbers.
4. Act, don't label: every detection or forecast ends in a concrete action with a time window.
5. Built for the field: voice, offline, low-end phones and bright sunlight come first.

## Accessibility & Inclusion

Low-literacy users: voice and icons carry meaning alongside text; large touch targets; high contrast for outdoor sunlight on farmer screens; Devanagari rendered with proper conjuncts and line height. Shared-phone households: the flow should not assume one owner per phone.
