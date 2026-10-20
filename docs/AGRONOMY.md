# Agronomy: the spray table and where it comes from

Status: researched on 20 October 2026 by the build team from published sources. **Not yet reviewed by an agronomist.** A named plant pathologist (ICAR-NRCP Solapur, MPKV Rahuri or the KVK) must review this table before any field use or public advice. The app never generates a product or a dose; it only shows what is in `web/src/lib/sim/rules.ts`, and that file follows this document.

## The table

| Use in the app | Product | Dose | Interval | Source |
| --- | --- | --- | --- | --- |
| **Curative**: after a scan confirms blight on the plot | Copper hydroxide 77% WP | 2 g per litre of water | Repeat after 15 days; the first spray on the first dry, calm morning | NRCP advisory 89 (copper hydroxide 2 g/l, sprays at 15-day intervals) [6]; APEDA / NRCP list (copper compounds 2–2.5 g/l) [9] |
| **Preventive**: neighbour warnings, the officer's advisories, routine sprays | Bordeaux mixture 1%, freshly prepared | 10 g copper sulphate + 10 g lime per litre | 15 days | NRCP advisory 89 (1% Bordeaux, freshly prepared) [6]; advisory 114 (1% Bordeaux on the evening after pruning) [8] |
| Alternative to copper hydroxide (not in the app yet) | Copper oxychloride 50% WP | 3 g per litre [6], or 2–2.5 g per litre [9] | 15 days | As above |

**Removed: Streptocycline** (streptomycin sulphate 90% + tetracycline hydrochloride 10%), which the table used to combine with copper oxychloride for curative sprays.

## Why the antibiotic is gone

1. **Regulation.** The Union Ministry of Agriculture and Farmers Welfare issued the draft *Prohibition of Streptomycin + Tetracycline in agriculture Order, 2021* on 17 December 2021 (listed as S.O. 5295(E)) [1, 2]. It would end the manufacture, import and formulation of the two antibiotics for agriculture from 1 February 2022 and ban their use in agriculture completely from 1 January 2024, coming into force on final publication in the Gazette [1]. It followed the Registration Committee's 2020 recommendation to phase them out [4]. A September 2022 report says the Central Insecticides Board discussed the ban and asked ICAR for more data [3]. **We did not find the final gazetted order**, so the legal status today is not confirmed. ICAR-NRCP's own researchers, writing in December 2024, cite the draft and describe the ban on use as taking effect from 1 January 2024 [5], while a 2025 field study still tested copper with Streptocycline [10].
2. **Resistance.** The same NRCP paper reports antibiotic resistance, and reduced sensitivity to antibiotics and copper, in field populations of the blight bacterium in India [5].
3. **Public health.** Streptomycin is a tuberculosis drug; antimicrobial resistance is the stated reason for the ban [1, 4].

Whatever the final legal position, the policy direction and the national pomegranate centre both point away from antibiotics, so the app should not recommend one. **To close this out**, check the Gazette of India (egazette.gov.in) and the Directorate of Plant Protection, Quarantine and Storage for the final order, and record its number and date here.

## What is not handled yet

- **Pre-harvest interval.** The APEDA list gives copper compounds a 60-day pre-harvest interval for pomegranate grown for export [9]. A curative copper spray in October conflicts with a November export harvest. The app does not check pre-harvest intervals yet; that is roadmap item 2.5 (export-ready record). Until then, the app's advice is for the domestic market and the label governs.
- **Bronopol.** According to the search index, NRCP's 2020 advisory 63 listed bronopol (2-bromo-2-nitropropane-1,3-diol 95%) at 5 g per 10 litres, with copper oxychloride or copper hydroxide and a sticker, as the alternative to Streptocycline [7]. We could not open that PDF to confirm it, and we have not checked bronopol's registration for pomegranate. It stays out of the app until an agronomist confirms the product, dose and label claim.
- **Biological control.** NRCP field trials of native *Bacillus* endophytes reduced blight by 47–68% over two seasons [5]. That is promising, but it is not yet a product recommendation.
- **The community schedule.** NRCP advises a six-step schedule, starting with the main pruning soon after harvest and including a 10% Bordeaux paste, that works only when all the orchards in a locality with blight follow it at the same time [6]. That fits the officer's advisories and the village goals, and belongs in the roadmap.
- **Copper limits.** Copper sprays can be phytotoxic above label rates, and the bacterium is showing reduced sensitivity to copper [5]. Keep to label doses and intervals; do not add sprays beyond the schedule.

## Sources

Accessed 20 October 2026. Pages on `icar.gov.in` could not be opened from our network; where a source says *via search index*, we read the text the search engine returned, not the original PDF, and it must be checked against the original.

1. Down To Earth, *Union agriculture ministry prohibits use of TB antibiotics on crops*, 21 December 2021. <https://www.downtoearth.org.in/agriculture/union-agriculture-ministry-prohibits-use-of-tb-antibiotics-on-crops-80785> (read directly)
2. TeamLease RegTech, *Draft Prohibition of Streptomycin + Tetracycline in agriculture Order, 2021*. <https://teamleaseregtech.com/updates/article/15680/draft-prohibition-of-streptomycin-tetracycline-in-agriculture-order-2021/> (via search index)
3. Global Agriculture, *India: Banning of Streptomycin + Tetracycline*. <https://www.global-agriculture.com/crop-protection/india-banning-of-streptomycin-tetracycline/> (via search index)
4. Down To Earth, *Ban use of TB drug on crops: Central panel*, 2020. <https://www.downtoearth.org.in/news/food/ban-use-of-tb-drug-on-crops-central-panel-71031> (via search index)
5. ICAR-National Research Centre on Pomegranate, Solapur: *Possible biocontrol of bacterial blight in pomegranate using native endophytic Bacillus spp. under field conditions*, Frontiers in Microbiology 15 (2024), published 11 December 2024. <https://doi.org/10.3389/fmicb.2024.1491124> (read directly)
6. ICAR-NRCP, Advisory 89. <https://nrcpomegranate.icar.gov.in/files/Advisory/89.pdf> (via search index): "Pesticide sprays should be carried out at 15 days interval. Copper oxychloride @ 3 g/l or copper hydroxide @ 2 g/l or 1% Bordeaux mixture (freshly prepared) will check both bacterial and fungal diseases."
7. ICAR-NRCP, Advisory 63, 2020. <https://nrcpomegranate.icar.gov.in/files/Advisory/63.pdf> (via search index)
8. ICAR-NRCP, Advisory 114, 2022. <https://nrcpomegranate.icar.gov.in/files/Advisory/114.pdf> (via search index)
9. APEDA, pesticide annexure to the residue monitoring plan for pomegranate, corrected by NRC Pomegranate, 2016. <https://apeda.gov.in/apedahindi/Grapenet/annexure5rmpcorrected06012016bynrcpom.pdf> (via search index; the link returned 404 when opened): "Copper compounds (including Copper oxychloride 50% WP, Copper hydroxide 77% WP etc.) … 2–2.5 g/l, PHI 60".
10. *Copper-streptocycline application modulates pomegranate (Punica granatum L.) secondary metabolism and antioxidant pathways against Xanthomonas axonopodis pv. punicae-induced bacterial blight*, 2025. <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12477149/> (via search index)
