---
name: KhetKundli
description: Every pomegranate plot in Phaltan taluka keeps a living season record, kept on ruled register paper in three provenance inks.
colors:
  board: "#cda868"
  board-deep: "#b89252"
  board-edge: "#8e6b33"
  board-ink: "#2f2512"
  board-ink-2: "#4f3f20"
  paper: "#f4f5f0"
  paper-2: "#e8eae2"
  paper-3: "#dcdfd4"
  rule: "#a9c1d8"
  rule-faint: "#d2dee9"
  margin: "#d9706b"
  border: "#c9cdc0"
  ink: "#1c1a17"
  ink-2: "#45413a"
  ink-3: "#5f5a50"
  ballpoint: "#1e40c8"
  stamp: "#4a3aa8"
  alert: "#c8102e"
  slip: "#f6edc9"
  water: "#2c68a8"
  canal: "#4d86bd"
  f-turmeric: "#ead38c"
  f-leaf: "#c6dbab"
  f-canal: "#bcd4e2"
  f-aril: "#eac4bb"
  f-lilac: "#d4cae6"
  f-straw: "#e2dac0"
  wave-0: "#f4f5f0"
  wave-1: "#ecd3c8"
  wave-2: "#dc9a98"
  wave-3: "#b84a5e"
  wave-4: "#8a1a32"
  leaf-good: "#5a9752"
  turmeric-fair: "#e2c46a"
typography:
  display:
    fontFamily: "Anek Latin, Anek Devanagari, ui-sans-serif, system-ui, sans-serif"
    fontSize: "92px"
    fontWeight: 700
    lineHeight: 0.82
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 75"
  headline:
    fontFamily: "Anek Latin, Anek Devanagari, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.25
    fontVariation: "'wdth' 88"
  title:
    fontFamily: "Anek Latin, Anek Devanagari, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.25
    fontVariation: "'wdth' 92"
  body:
    fontFamily: "Anek Latin, Anek Devanagari, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.375
  label:
    fontFamily: "Anek Latin, Anek Devanagari, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.02em"
    fontVariation: "'wdth' 82"
  typed:
    fontFamily: "Courier Prime, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    letterSpacing: "0"
    fontFeature: "'tnum'"
  ballpoint:
    fontFamily: "Kalam, Anek Devanagari, cursive"
    fontSize: "15px"
    fontWeight: 400
    letterSpacing: "0.005em"
  marathi-title:
    fontFamily: "Tiro Devanagari Marathi, Anek Devanagari, serif"
    fontSize: "15px"
    fontWeight: 400
  marathi-body:
    fontFamily: "Anek Devanagari, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.375
  stamp:
    fontFamily: "Anek Latin, Anek Devanagari, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 88"
rounded:
  sm: "2px"
  md: "3px"
  tab: "5px"
  pill: "9999px"
spacing:
  field-y: "5px"
  head-y: "10px"
  gutter-phone: "12px"
  sheet-x: "16px"
  stack: "16px"
  gutter-desk: "20px"
  rule-dense: "26px"
  rule: "28px"
  ledger-row: "30px"
  margin-x: "44px"
  touch-min: "48px"
components:
  sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0"
  sheet-head:
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    padding: "10px 16px"
  field-computed:
    textColor: "{colors.ink}"
    typography: "{typography.typed}"
    padding: "5px 0"
  field-human:
    textColor: "{colors.ballpoint}"
    typography: "{typography.ballpoint}"
    padding: "5px 0"
  stamp-verified:
    textColor: "{colors.stamp}"
    typography: "{typography.stamp}"
    rounded: "{rounded.md}"
    padding: "2px 6px"
  stamp-simulated:
    textColor: "{colors.ink}"
    typography: "{typography.stamp}"
    rounded: "{rounded.md}"
    padding: "2px 6px"
  stamp-alert:
    textColor: "{colors.alert}"
    typography: "{typography.stamp}"
    rounded: "{rounded.md}"
    padding: "2px 6px"
  stamp-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "64px"
  stamp-button-violet:
    backgroundColor: "{colors.stamp}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "64px"
  outline-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "4px 10px"
  outline-button-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  file-tab:
    backgroundColor: "{colors.board-deep}"
    textColor: "{colors.board-ink}"
    rounded: "{rounded.tab}"
    padding: "8px 16px"
  file-tab-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tab}"
    padding: "8px 16px"
  date-band:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.typed}"
    rounded: "{rounded.sm}"
    height: "36px"
  slip:
    backgroundColor: "{colors.slip}"
    textColor: "{colors.ink}"
    padding: "20px 16px 16px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "48px"
  chip-plot:
    textColor: "{colors.ink}"
    typography: "{typography.typed}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  chip-plot-selected:
    backgroundColor: "{colors.stamp}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
---

# Design System: KhetKundli

## Overview

**Creative North Star: "The Living Record"**

KhetKundli is drawn as the paperwork of a Maharashtra plot: the 7/12 extract, the Soil Health Card, the village survey map. Every surface is a stack of cool ruled register sheets lying on a manila file board. Modules are entries in a record and the collective layers are the survey map, so the interface vocabulary is the vocabulary of a government file: numbered form fields, typed values, ballpoint notes, rubber stamps, perforated carbon slips, file tabs and a dated stamp.

Provenance is carried by ink, not by badges. Carbon-black typewriter marks anything computed, ballpoint blue in a human hand marks anything a person entered, and violet rubber stamps mark verified state and "now". Red ink appears only when something needs attention. One axis, the season's day, drives everything: rolling the date stamp on the desk or turning the kundli wheel on the phone re-inks every sheet, the map and the runs together.

The two built surfaces share the world but not the density. The Taluka Desk is a dense, projector-scale operations board; the farmer phone is a single column of large, bilingual, high-contrast sheets for one-handed outdoor use. The world refuses the agritech default of KPI tiles over a satellite basemap with coloured pins, and the farmer-app default of a feed of tips, weather tiles and a chatbot bubble.

**Key Characteristics:**
- Manila board ground, cool register paper, warm brown shadows.
- Three provenance inks (typed carbon, Kalam ballpoint, violet stamp) plus red ink for alerts only.
- Anek Latin and Anek Devanagari on the width axis for all UI; Courier Prime only for record values; Tiro Devanagari Marathi for Marathi titles.
- Survey-map linework with H3 hexes hatched in red ink for blight risk; no individual farm on a shared view.
- Motion is physical and driven by simulated time: stamps press, digits roll, ink re-fades, paper slides.

**Open gaps:** there is no dark theme (the `dark` variant is declared but no dark tokens exist; the browser theme colour is fixed to Manila File Board). The third surface, the pitch file for judges, is listed on the home page but not built.

## Colors

A warm manila ground holding cool grey-green paper, written on in three inks, with red held back for alerts.

### Primary
- **Carbon Typed Black** (#1c1a17): the typewriter ink. Every computed value, sheet-head rules (2px), map roads and labels, date-stamp bands, stamp buttons for doing, the play button, tooltips. Also the shadcn `primary` and `foreground`.
- **Second Carbon** (#45413a): labels, Marathi partner lines, captions and legend text.
- **Faded Carbon** (#5f5a50): form codes, times in the margin, axis ticks, helper text, empty states.

### Secondary
- **Ballpoint Blue** (#1e40c8): written by a person, in the Kalam hand: farmer and agent entries in the register and passbook, voice transcripts, the "Ballpoint" sample in the ink key. Never used for UI chrome, links or selection.

### Tertiary
- **Rubber Stamp Violet** (#4a3aa8): verified and current state. LIVE stamps, dated impressions, Verified / Read / Queued / Confirmed stamps, the season-track scrub head and the kundli wheel's today pointer, selected hex outlines and selected plot chips, the best spray window frame, pooled-run routes and vehicles, "Net to you" on a sale slip, the Ask and Confirm stamp buttons. It is also the focus ring and, at 22%, the text selection.

### Alert
- **Red Ink** (#c8102e): blight risk hatching, diseased scans, washed-off sprays, gluts, low scan confidence, offline state, re-planned ripples, the glut band on the Harvest Wave chart, deductions on a sale slip. The shadcn `destructive` token.

### Neutral
- **Manila File Board** (#cda868): the page ground under every surface, with a horizontal fibre texture. Also the browser theme colour.
- **Pressed Manila** (#b89252): inactive file tabs and the phone's fixed action dock.
- **Manila Fold Edge** (#8e6b33): the dock's top rule; the fold of the file.
- **Board Brown-Black** (#2f2512) and **Faded Board Ink** (#4f3f20): text, ticks and frames printed directly on the board (wordmark, taluka line, season track, date-stamp frame).
- **Cool Register Paper** (#f4f5f0): every sheet, slip interior, hover card and dialog. The shadcn `background` and `card`.
- **Register Grey-Green** (#e8eae2): hover and selected rows, the selected market row, info strips inside sheets.
- **Worn Register Tint** (#dcdfd4): empty tracks, rest stages on the wheel, disabled save state.
- **Register Ruling Blue** (#a9c1d8) and **Faint Ruling Blue** (#d2dee9): the ruled lines on register paper (faint) and the rings of the kundli wheel.
- **Margin Red Rule** (#d9706b): the single vertical margin line on ruled paper. It is printing on the paper, not a status colour.
- **Sheet Edge Grey** (#c9cdc0): the default border and input colour from the shadcn mapping; component borders are normally carbon at an opacity instead.
- **Yellow Carbon Slip** (#f6edc9): perforated tear-off slips: today's action, re-planned ripples, demo inputs, escalations, scan advice.

### Survey Map and Data
- **Survey River Blue** (#2c68a8) and **Canal Blue** (#4d86bd): the Nira and Karha rivers (2.4px and 1.5px) and the dashed Nira canals; rain ticks and rain icons. The Pune price series reuses the river blue value.
- **Field tints**: **Turmeric Field** (#ead38c), **Leaf Field** (#c6dbab), **Canal Field** (#bcd4e2), **Aril Field** (#eac4bb), **Lilac Field** (#d4cae6), **Straw Field** (#e2dac0). Village areas are greedily coloured so neighbours never share a tint. On Pest Radar they are mixed 40% into paper (aril swapped for straw) so red hatching reads on top.
- **Harvest Wave ramp**, paper to pomegranate: **Bare Paper** (#f4f5f0), **Blush** (#ecd3c8), **Rose** (#dc9a98), **Pomegranate** (#b84a5e), **Deep Aril** (#8a1a32). Sequential only: village crates per week on the map (steps at 1, 60, 220, 520, 900 crates), the picking-date strip, Harvest Wave bars (Pomegranate at 72%, focused week in Deep Aril), crate tallies on the wheel, the harvest band on the season track. The Phaltan price series reuses the Pomegranate value; Phaltan and Pune were checked for colour-blind separation on the paper surface.
- **Leaf Green** (#5a9752): good spray hours, water saved, the top of the Water Commons ramp (paper, #d7e8c8, #b4d39c, #87b874, Leaf Green).
- **Fair Turmeric** (#e2c46a): fair spray hours. Bad hours are not a colour; they are red-ink hatching.

Leaf Green, Fair Turmeric, the water ramp steps, the two price-series constants, the wheel's stage fills and the ten collection-point tints on the Runs layer are currently literals in component code, not `:root` custom properties.

### Named Rules
**The Three Inks Rule.** Every value is written in exactly one ink, and the ink says who wrote it: typed carbon for computed, Kalam ballpoint blue for a person, violet stamp for verified or current state. A value never carries two inks and is never coloured for decoration.

**The Red Ink Rule.** Red means attention: risk, failure, glut, low confidence, offline, re-planned. When an entry is an alert, red replaces its ink colour but its typeface keeps its provenance. The one ledger-native exception is a deduction on a sale slip, written in red as a debit.

**The Cool Paper Rule.** Paper is cool grey-green register stock, never cream. Warmth belongs to the manila board around it.

## Typography

**Display Font:** Anek Latin (with Anek Devanagari, ui-sans-serif, system-ui)
**Body Font:** Anek Latin and Anek Devanagari, on the width axis
**Label/Mono Font:** Courier Prime for typed record values
**Hand:** Kalam (Latin and Devanagari) for ballpoint entries
**Marathi titles:** Tiro Devanagari Marathi

**Character:** Anek's width axis lets one family run from condensed poster numerals to near-normal headings across Latin and Devanagari, like the printed parts of a form. Courier Prime is the typewriter that fills the form in, and Kalam is the hand that annotates it.

### Hierarchy
- **Display** (700, 92px, line-height 0.82, width 75%, -0.03em): the poster figure on the desk's figure sheet (hexes on warning, crates expected, ML saved, runs today); digits roll as an odometer. The wordmark speaks in the same voice at 26px on the desk and 56px on the home page, width 78–80%, in board ink.
- **Headline** (700, 22px, line-height 1.25, width 88%): the one action on the today slip. Siblings: the farmer's name in the phone head (22px, width 82%) and the chosen picking date (26px, width 85%).
- **Title** (600, 17px, line-height 1.25, width 92%): sheet-head titles. Full-screen phone sheets (Scan a leaf, Ask) use 19px at width 90%.
- **Body** (400, 13px on the desk, 14–15px on the phone, line-height 1.375): captions, ledger rows and explanatory lines. On ruled paper the line-height locks to the rule pitch instead.
- **Label** (600, 11px, line-height 16px, 0.02em, uppercase, width 82%): printed form labels only: field labels, column heads, "Phaltan weather", "Demo inputs, simulated", "Recent entries".
- **Typed** (Courier Prime 400, 13px, tabular figures): every computed record value, dates, times, IDs and prices. Form codes are typed at 10.5px in Faded Carbon; chart ticks at 9–9.5px.
- **Ballpoint** (Kalam 400, 15px, 0.005em, Ballpoint Blue): entries a person made; voice transcripts at 18px.
- **Marathi title** (Tiro Devanagari Marathi 400, 15px beside a 17px title; 19px on the today slip; 17px on spoken answers).
- **Marathi body** (Anek Devanagari 400, 12–15px): the Marathi partner of every farmer-facing line, map labels, tab subtitles, wheel month names.
- **Stamp** (Anek 700, uppercase, width 88%, line-height 1): 9px / 10.5px / 13px / 18px impressions with 0.08–0.12em tracking.

### Named Rules
**The Typewriter Is for Values Rule.** Courier Prime sets only record values, codes, dates, times and numbers. Labels, headings and prose are Anek. If it was computed, it is typed.

**The Marathi Alongside Rule.** Every farmer-facing line carries its Marathi partner in the same block, at equal or near-equal size, never behind a toggle. Titles pair with Tiro Devanagari Marathi; body lines with Anek Devanagari.

**The Form Code Rule.** Nothing sits above a heading. A sheet is identified by a typed form code (KK-1 to KK-7, or the plot ID) in the right cluster of its head, beside its stamps. No kicker, no eyebrow.

## Layout

**Taluka Desk.** A file-cover strip runs across the board: wordmark with its Marathi name and the taluka line on the left; the 420px season track, the date stamp and the weather slip on the right. Below it, at 1280px and wider, a two-column grid: the survey-map sheet (`minmax(0, 1.42fr)`) and a stack of record sheets (`minmax(400px, 1fr)`), 20px apart with a 20px page gutter (12px below 640px). At that width the desk locks to the viewport height and each sheet scrolls inside itself; the register and the plot extract share the remaining height 1.05 : 1. Below 1280px everything stacks in one column, the village ledger is fixed at 288px and the demo slip moves under the map.

The map sheet reads top to bottom: file tabs on its top edge, the map at its native aspect, a 2px carbon rule, the legend strip, another 2px rule, the village ledger (rows at least 30px, sized so no row is ever cut in half), and a typed attribution line.

**Farmer phone.** One column, at most 480px wide, 12px gutter, sheets stacked 14–16px apart. The head carries the farmer's name and Marathi name, the dated impression and the source stamps. The wheel sheet sizes the wheel to `min(328px, max(260px, 100dvh − 516px))` so the today slip stays in the first viewport on short phones. Then the today slip, the picking-date sheet and the passbook. A fixed action dock holds the two primary stamp buttons at the bottom edge, and the page keeps 144px of bottom padding so nothing hides under it. Scan and Ask open as full-height paper sheets inside the same 480px column.

**Forms and ruling.** A form field is a three-column grid: number (1.5rem), printed label (6.5rem), value; 5px vertical padding with a dotted 25% carbon divider. Ruled paper uses a 26px pitch on the desk register and 28px on the passbook and spoken answers, with the red margin rule at 44px by default and at 62–64px where a time or date column sits in the margin.

Breakpoints are Tailwind's defaults: 640px (gutters widen, tabs gain full labels and Marathi), 1024px (season track appears in the file cover), 1280px (two-column desk).

### Named Rules
**The Ruled Pitch Rule.** On ruled paper, line-height equals the rule gap and the date or time column sits in the margin. Text never floats between rules.

## Elevation & Depth

Depth is physical: sheets of paper lying on a manila board. There are only two shadows, both warm brown because they fall on manila. Inside a sheet everything is flat; hierarchy comes from ink rules: a 2px carbon rule under each head and between sheet zones, a 1px dotted rule at 25% carbon between fields and rows, and 15–20% carbon hairlines for minor breaks. Texture does the rest: a horizontal fibre noise on the board, a 5% paper grain over the survey map, and a worn-rubber speckle mask on every stamp.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 1px 0 rgb(80 60 20 / 0.18), 0 6px 14px -6px rgb(60 40 10 / 0.38), 0 18px 32px -18px rgb(60 40 10 / 0.35)`): every sheet lying on the board, the weather slip, the today slip, and a stamp button while pressed.
- **Lift** (`box-shadow: 0 2px 0 rgb(80 60 20 / 0.16), 0 12px 24px -10px rgb(60 40 10 / 0.42)`): things held above the paper: the floating demo slip, the ripple slip, hover cards on the map and chart, stamp buttons at rest.
- **Tab lip** (`box-shadow: 0 -1px 0 rgb(80 60 20 / 0.12)`): the top edge of the active file tab.

Perforated slips declare Sheet or Lift too, but the perforation mask clips everything outside the slip's border box, so in practice slips read flat against what they lie on.

### Named Rules
**The Paper on Board Rule.** A thing either lies on the board (sheet), is held above it (lift), or is pressed into it: a stamp button drops 2px and collapses from lift to sheet. Nothing inside a sheet casts a shadow.

## Shapes

Corners are near-square, like cut stock: 2px for sheets, stamp buttons, date bands, hover cards and plot chips; 3px for stamps, inputs, outline buttons and choice tiles; 5px on the top corners of file tabs only. Full circles are reserved for round instruments: the play and back-to-today buttons, 48px close buttons, the microphone orb, the "understood" chips, and the kundli wheel with its knob.

Tear-off slips have a perforated top edge: 3px holes on a 12px pitch. Stamps sit slightly askew (−6° to +4°), framed by a border with a 1px outline 2px outside it at 40%, and speckled by the worn-rubber mask. Map geometry is survey linework: H3 hexagons (resolution 7, about 5 km²), Voronoi village areas, a dash-dot taluka boundary (14 4 2 4), a tick-line railway, dashed canals (5 2), a north arrow and an alternating carbon/paper scale bar. Risk is hatching at 45°: Watch is a single 7px hatch, Warning a 5.5px cross-hatch, Outbreak a 4px cross-hatch over a 45% red wash.

## Components

### Buttons
Rubber stamps you press.
- **Stamp Button:** a square ink block inside a speckled double rule (3px outer rim 6px outside the block, 2px inner rule at 45% paper), corners 2px, paper text, 12px horizontal padding. Carbon for doing (Scan a leaf); violet for state-changing or verified outcomes (Ask, Confirm picking). 64px tall in the phone dock, 56px for Confirm.
- **Press:** drops 2px and collapses from lift to sheet shadow in 100ms ease-out, and a flash of ink spreads (scale 1 to 1.06, opacity 0.55 to 0, 120ms). Disabled at 45% opacity with no shadow.
- **Outline button** (demo inputs): 2px carbon border, 3px corners, 4px 10px padding, 12.5px semibold with a 14px icon. Hover fills carbon with paper text; active drops 1px; disabled fades the border to 30% carbon and the text to Faded Carbon.
- **Scan Lens buttons:** 56px tall, 3px corners, carbon fill (Camera, Take photo) or 2px carbon outline (Photo); Save to my record in violet.
- **Round instruments:** a 32px carbon play/pause button and a 32px back-to-today ring (2px board ink, 35% when disabled) beside the date stamp; 48px round close buttons with a 10% carbon hover.

### Rubber Stamps
The system's state marker. Tones: violet, carbon, red, ballpoint. Sizes 9px / 10.5px / 13px / 18px with borders of 1.5px / 2px / 2.5px / 3px. Each stamp presses in on a spring (stiffness 700, damping 26, mass 0.6) from 1.3× scale, 45% opacity and 4° extra rotation, settling at 92% opacity.
- **Source stamp:** LIVE in violet at −4°, SIMULATED in carbon at +2°, with a tooltip naming the source.
- **Dated impression:** a violet date stamp re-pressed on the register, plot extract, passbook and phone head whenever the day changes (not while the season plays).
- **State stamps:** Verified, Read, Slip read, Queued, Saved to record and Confirmed in violet; Re-planned in red.

### Cards / Containers
- **Sheet:** Cool Register Paper, 2px corners, sheet shadow, no border. Optional ruling (faint blue lines plus the red margin rule).
- **Sheet head:** 10px 16px padding over a 2px carbon rule; the title in Anek 17px with its Marathi title in Tiro beside it; a right cluster of stamps ending in the typed form code.
- **Perforated slip:** Yellow Carbon Slip with a perforated top edge, 20px top and 16px side and bottom padding. It carries today's action, re-planned ripples (lift shadow, sliding in at a slight tilt), demo inputs, escalation notices and scan advice.
- **Hover card:** paper, 2px corners, lift shadow, 12px text with a typed code line; fades in over 140ms.

### Inputs / Fields
- **Record field:** a numbered row: typed number, printed label, value in its provenance ink (typed carbon 13px or Kalam ballpoint 15px).
- **Text input:** at least 48px tall, 2px border in carbon at 40%, 3px corners, paper ground, 15px text; the border turns violet on focus. It pairs with a 48px carbon submit square.
- **Focus and selection:** every focusable element gets a 2px violet outline 2px out; selected text is violet at 22%.
- **Drawn controls** keep keyboard equivalents: the date-stamp bands are spinbuttons (arrow keys, mouse wheel), the season track and kundli wheel are sliders (arrows; PageUp/PageDown move a week on the wheel), and the picking-date strip carries a visually hidden native range input.

### Chips
- **Plot chips** (plots in a selected hex): typed 11px, 2px corners, 1px border at 30% carbon; hover darkens the border to full carbon; selected fills violet with paper text.
- **Understood chips** (Ask): pills with a 2px border; heard in the question is solid carbon, assumed from the record is dashed at 40% carbon with Second Carbon text.
- **Choice tiles and rows:** crop tiles are 48px tall with 3px corners and a 2px border at 30% carbon, filled carbon when chosen. Market rows are 64px radio rows; the chosen row takes Register Grey-Green and a violet checked square, and a glut day is hatched in red at 22%.

### Navigation
- **File tabs** (desk): manila tabs on the top edge of the map sheet. Inactive tabs are Pressed Manila with board ink; the active tab is paper continuous with the sheet and slides between tabs on a shared spring (stiffness 500, damping 40). Labels are Anek 14px semibold at width 90% with a 12px Marathi subtitle; below 640px they shorten and drop the Marathi. Arrow keys move between tabs.
- **Action dock** (phone): fixed to the bottom edge, Pressed Manila with a Manila Fold Edge top rule, 16px padding, two bilingual stamp buttons 16px apart.

### Date Stamp (signature, desk)
Three carbon bands (day 44px, month 54px, year 59px; 36px tall) in a 1.5px board-ink frame, with chevrons above and below each band. Day and year digits roll as an odometer (React Bits Counter, 0.45–0.5s, light bounce); the month rolls vertically with a 2px blur on a spring (520 / 34). Beside it, the season track is a 420 × 36 linework axis with week ticks, month ticks, a harvest band in Pomegranate at 28% and a violet scrub head. Playing advances simulated time at 0.65 days a second, slowing to 0.035 during the morning run on the Runs layer so vehicles can be watched.

"Today" is a store value, not a constant: on load it rolls to the device's real date, clamped into the season (19 October 2026 is only the default before that sync), and the date stamp follows it only if nobody has rolled the stamp yet. The back-to-today button, its tooltip date, the season track's today mark and the phone spray ribbon's live-forecast check all read that value.

### Survey Map (signature, desk)
Linework drawn once: carbon roads (1.5px major, 0.8px minor), blue rivers, dashed canals, tick-line rail, the dash-dot taluka boundary. Village labels in carbon with a 3px paper halo; towns uppercase and tracked. A cartouche (2px carbon frame on 90% paper) names the sheet in English, Marathi and a typed grid line. Fill transitions take 220ms. Layers: Pest Radar hatches H3 hexes in red ink with typed detection counts; Harvest Wave and Water Commons shade village areas on their ramps; Runs tints each collection point's villages and draws violet routes (solid 3px when running today, dashed 1.4px at 55% otherwise) with violet vehicle blocks that move only with the simulated clock.

### Season Wheel (signature, phone)
The plot's kundli drawn as a horoscope chart on paper: rings in Register Ruling Blue; a stage band (rest and done in Worn Register Tint, bahar #e2d3a6, flowering #e9c9a2, fruit set in Leaf Field, development #9cc283, maturity in Rose, harvest in Pomegranate); rain as blue ticks; irrigation as carbon dots, skipped irrigation as open blue rings; sprays as violet diamonds, red and struck through when washed off; scans as crosses, red when diseased; pickings as crate tallies in Deep Aril. The future is drawn in pencil: desaturated at 45%, with marks fading over 200ms as the pointer passes. Today is a violet pointer with a 10px knob on the stage band; the centre holds the typed date (30px), the day count and the stage, each in English and Marathi. The month rim sets English over Marathi.

### Charts
- **Harvest Wave chart:** weekly crate bars over two price lines (Phaltan in the Pomegranate value, Pune in the river-blue value, both 2px, labelled directly at the line ends). A 7% red band marks the Pune glut week. Gridlines at 12% carbon, typed ticks, one hover column per week.
- **Spray ribbon:** 72 hourly cells, 28px tall in a 1px frame at 40% carbon: good hours Leaf Green, fair hours Fair Turmeric, bad hours red hatching (135°); carbon ticks at midnight; the best window framed in 2.5px violet.
- **Sale waterfall:** gross in carbon, each deduction in red at 75%, net in violet, with a typed ledger underneath.
- **Water goal bar:** a 12px Worn Register Tint track filled Leaf Green, with a carbon goal tick at 80%.

### Register and Passbook
Ruled sheets of dated entries: the time or date typed in the margin, the entry in its provenance ink, a small violet stamp beside verified entries, alert entries in red. The desk register drops a ripple slip on top when an event re-plans the season, and ends with the ink key (Typed computed, Ballpoint entered by a person, Stamped verified). Entries fade in over 180ms.

### Named Rules
**The Stamp Every Source Rule.** Every block of data carries a LIVE or SIMULATED stamp in its head or beside its figure. A source that is not live is never presented as live; the pomegranate scan result stays SIMULATED until a pomegranate model exists.

**The Simulated Clock Rule.** Nothing moves on its own. Vehicles, hours and marks move only when simulated time moves (play, roll, drag). Under reduced motion every animation and transition collapses to 1ms, and stamp presses, ink spreads, month blur and listening rings are skipped.

## Do's and Don'ts

### Do:
- **Do** write every value in the ink of whoever produced it: typed carbon (Courier Prime) for computed, Kalam ballpoint blue for a person, a violet stamp for verified or current state.
- **Do** stamp every data source LIVE (violet) or SIMULATED (carbon), on the sheet head or beside the figure it qualifies.
- **Do** set Marathi alongside every farmer-facing line: Tiro Devanagari Marathi for titles, Anek Devanagari for body lines.
- **Do** give every phone control at least 48px in its smaller dimension, and the dock's primary stamp buttons 64px.
- **Do** identify a sheet by its typed form code (KK-1 to KK-7, or the plot ID) at the right end of its head.
- **Do** re-ink with a 200ms fade when the day changes, press stamps on the spring, and honour prefers-reduced-motion.
- **Do** put tear-off notices (today's action, re-planned ripples, demo inputs, escalations, scan advice) on the perforated yellow slip.
- **Do** aggregate shared maps to H3 hexes and village areas, drawing risk as red-ink hatching density.

### Don't:
- **Don't** place a kicker or eyebrow above any heading; the form code and stamps in the head's right cluster are the only marks a sheet head carries.
- **Don't** use red for anything but alerts and ledger debits: never for decoration, brand or "today".
- **Don't** put two inks on one value, or colour a value outside its provenance ink or the alert.
- **Don't** add coloured side-stripe borders to cards, rows or alerts; the register's red margin rule is ruling printed on the paper, not a status stripe.
- **Don't** use progress rings or radial gauges for a metric; the kundli wheel is a season chart (time round the circle), not a percentage.
- **Don't** use cream or warm paper; warmth belongs to the manila board.
- **Don't** build KPI tiles over a satellite basemap with coloured pins, or a feed of tips, weather tiles and a chatbot bubble.
- **Don't** show an individual farm on a shared map.
- **Don't** animate vehicles or the season unless simulated time is moving.
