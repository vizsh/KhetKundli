---
version: 1
slug: "web-src-app-desk-page-tsx"
primary_target: "web/src/app/desk/page.tsx"
related_targets: []
---

# Taluka Desk (Mission Control)

Scope: `/desk`, the FPO coordinator / extension officer surface, also the judges' main demo screen. Mode: Operate.
Audience and job: see the whole taluka's pomegranate season at once, find where blight is spreading, when villages will harvest, which pooled runs go when, and open any plot's record. Task frequency: daily for the officer; one five-minute demo for judges.
Constraints: projector and daylight office use (light surfaces, high contrast); individual farms never shown on the shared map (H3 hexes and village areas only); every data source labelled LIVE or SIMULATED.
Memorable moment: rolling the date stamp and watching every sheet, the map and the runs re-ink to that day.
Unresolved: final Marathi village names need local verification; Agmarknet key not yet supplied (seeded prices until then).

## Direction contract

THESIS: The desk is a stack of living plot records on a manila file board beside the taluka's survey map: modules are entries in a record, collective layers are the map. It refuses the agritech default of KPI tiles over a satellite basemap with coloured pins.

OWN-WORLD: Manila file board ground, cool ruled register paper with blue ruling and a red margin rule, carbon-black typed entries for computed data, ballpoint-blue for human input, violet rubber stamps for state (VERIFIED, SYNCED, LIVE, SIMULATED), red ink only for alerts. Survey-map linework: black roads, blue-ink Nira river and canals, tick-line rail, village areas as flat tinted fields, blight risk as red-ink hatching on H3 hexes. Anek Latin and Anek Devanagari for all UI, Courier Prime only for typed record values, Tiro Devanagari Marathi for Marathi record titles. Numbered form fields, perforated slips, file tabs.

STORY: The officer or judge reads the taluka's season at a glance, rolls the date stamp to any day and sees every sheet re-ink, opens a village or hex into plot records, and watches one event (a blight scan, a rain forecast) ripple through map, records, harvest wave and runs.

FIRST VIEWPORT: At 1440x900, a 64px file-cover strip: name and "Phaltan taluka, pomegranate, Mrig bahar 2026" left; the rolling-band date stamp (day, month, year bands, play) right of centre with a live weather slip beside it. Left 60%: the survey-map sheet, file tabs on its top edge (Pest Radar, Harvest Wave, Water, Runs), the map at full width fitted to the taluka (it is twice as wide as it is tall), demo inputs on a perforated slip in the map's top band, scale bar; under the map a legend strip and a village ledger whose measure follows the active layer (STORY: open a village into its records). Right 40%: stacked sheets: one poster-size figure for the active layer, the day's register with ink provenance, and the selected plot record extract. Primary action: roll the date stamp, then open a record.

FORM: The Living Record (Maharashtra plot records: 7/12 extract, Soil Health Card, village survey map), position 5 on the ordered list, seed key 6a48e711. Raises: scale courage from Bitmap Specimen; region-scale colour from Guide Map; provenance by ink from Mixtape J-Card; one axis drives everything from Variable Specimen. Signature interaction: the rolling-band date stamp, drawn flat in linework; every roll presses a violet dated impression onto the register and the plot record. Motion grammar: stamp press with ink spread, odometer-rolling bands, 200ms ink-fade re-inking, vehicles move only when simulated time moves.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
