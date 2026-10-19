---
version: 1
slug: "web-src-app-farmer-page-tsx"
primary_target: "web/src/app/farmer/page.tsx"
related_targets: []
---

# Farmer phone

Scope: `/farmer`, Sunita's phone (and every app-using farmer's). Mode: Operate, mobile-first, used outdoors in sun with one hand; on a laptop it renders as a phone-width column on the board. Inherits the Living Record world from the Taluka Desk (DESIGN contract in the desk brief): manila board, ruled paper, typed / ballpoint / violet-stamp provenance, Anek + Courier Prime + Kalam + Tiro Devanagari Marathi.
Audience and job: a pomegranate farmer with low literacy and a shared phone. Jobs: know the one thing to do today, scan a leaf offline, ask a question by voice, choose a picking date and market, read what happened to the money.
Constraints: English-first with Marathi alongside every farmer-facing line; touch targets at least 48 px; high contrast for sunlight; works offline for the scan; doses only from the fixed rules table; LIVE / SIMULATED stamped on every data source; pomegranate disease result is SIMULATED until the team trains a pomegranate model (the on-device model covers tomato and capsicum).
Memorable moment: scrubbing the kundli wheel round the season, then scanning a leaf in airplane mode and watching the desk ripple in the other window.

## Direction contract

THESIS: The plot's kundli is the home screen: a living season chart Sunita can turn with a finger, with today's single action written underneath. It refuses the farmer-app default of a feed of tips, weather tiles and a chatbot bubble.

OWN-WORLD: Inherited Living Record world. The wheel is drawn like a horoscope chart on ruled paper: ink rings, stage arcs in the harvest-wave reds and leaf greens, rain as blue-ink ticks, sprays as violet marks (red when washed off), scans as red-ink crosses, pickings as crate tallies. Today is a violet pointer; the future arc is drawn in pencil grey. Actions are rubber-stamp buttons; the today slip is a perforated yellow carbon slip.

STORY: Sunita sees where her season stands and what to do today; she scans a suspicious leaf without signal and gets an action with a time window; she asks why her last spray failed and hears the answer from her own record; she drags her picking date and sees what each market will pay her.

FIRST VIEWPORT: At 390x844: a 56 px head with plot name (English and Marathi), the dated impression and source stamps; the kundli wheel at full width (about 340 px square) with today's date and stage in its centre; below it the perforated today slip with the one action, its window and the 72-hour spray ribbon; at the foot two large stamp buttons, Scan a leaf and Ask, pinned to the bottom edge.

FORM: Kundli wheel home, position 5 on the ordered list of seven phone structures, surface seed key 11b32174, chosen by the user. Signature interaction: dragging round the wheel scrubs the season (the same clock as the desk). Motion grammar: wheel pointer follows the finger with no easing lag; marks re-ink with a 200 ms fade; the today slip and sheets slide up like paper; the stamp buttons press.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
