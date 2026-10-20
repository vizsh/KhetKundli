"use client";

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import Counter from "@/components/Counter";
import { SurveyMap } from "@/components/desk/survey-map";
import { WaveChart } from "@/components/desk/wave-chart";
import { Waterfall } from "@/components/farmer/passbook";
import { SeasonWheel } from "@/components/farmer/season-wheel";
import { Sheet } from "@/components/record/sheet";
import { SourceStamp, Stamp } from "@/components/record/stamp";
import { fmtDay, SEASON_DAYS, weekOf } from "@/lib/sim/calendar";
import { generateSeason } from "@/lib/sim/season";
import { diffSeasons, recentDetections, riskCounts, weekTotals } from "@/lib/sim/selectors";
import type { PlotEvent } from "@/lib/sim/types";
import { useDesk, type Layer } from "@/lib/store";
import { answer } from "@/lib/voice";
import { cn } from "@/lib/utils";
import { PosterStamp } from "./poster-stamp";

type Visual = "wheel" | "pest" | "voice" | "ripple" | "wave" | "runs" | "kept";
type Chapter = { from: number; to: number; title: string; mr: string; body: string; visual: Visual; layer?: Layer };

const CHAPTERS: Chapter[] = [
  { from: 0, to: 40, visual: "wheel", title: "Each plot's chart is drawn", mr: "प्रत्येक शेताची कुंडली मांडली जाते", body: "Mrig bahar is regulated across 192 plots. From now on every irrigation, spray, scan and picking is written into the plot's own record, in the ink of whoever wrote it." },
  { from: 41, to: 110, visual: "pest", layer: "pest", title: "Blight moves through the taluka", mr: "तेल्या रोग तालुक्यात पसरतो", body: "Wet canopies and wind-driven rain carry bacterial blight between orchards; the season runs on Phaltan's recorded 2026 weather, hour by hour. No farmer sees it from one phone; the records together draw the front, and the wind shows where it goes next." },
  { from: 111, to: 128, visual: "voice", title: "The record remembers a washed-off spray", mr: "पावसाने धुतलेली फवारणी नोंदीत राहते", body: "Sunita sprayed at three in the afternoon; that evening the real monsoon of 2026 dropped heavy rain on Phaltan. When she asks why it failed, the answer comes from her own record, in Marathi." },
  { from: 129, to: 152, visual: "ripple", title: "One leaf, scanned offline, ripples outward", mr: "एका पानाचा स्कॅन, सगळीकडे परिणाम", body: "She scans a spotted leaf with no signal. When it syncs, her spray is set for the first dry morning, her neighbours are warned, the radar redraws, and her harvest grade improves." },
  { from: 153, to: 180, visual: "wave", layer: "wave", title: "The harvest wave, and a glut in Pune", mr: "तोडणीची लाट आणि पुण्यातील आवक", body: "Crop stage on every plot forecasts when each village will pick. The wave shows the Pune glut coming, so a farmer can move her picking and her market before prices fall." },
  { from: 181, to: 215, visual: "runs", layer: "runs", title: "Pooled runs and a sale slip she can check", mr: "सामायिक वाहतूक आणि तपासता येणारी पट्टी", body: "Pickings are known days ahead, so pooled runs leave village collection points at 05:15. She photographs the agent's slip; the phone reads it and checks every deduction against the agreed rate card." },
  { from: 216, to: SEASON_DAYS - 1, visual: "kept", title: "What the village kept", mr: "गावाने काय वाचवले", body: "At the season's close the records add up: water left in the ground, crates moved together, blight caught early. The same records start next season's chart." },
];

const MR = { fontFamily: "var(--font-tiro-marathi), var(--font-anek-deva)" } as const;

function Figure({ value, decimals = 0, unit, label, live }: { value: number; decimals?: number; unit?: string; label: string; live: boolean }) {
  return (
    <div className="mt-5 flex items-end gap-3 border-t-2 border-ink pt-3">
      <p className="flex items-baseline leading-[0.85]">
        <Counter value={value} decimals={decimals} fontSize={64} fontWeight={700} intro={false} duration={0.5} bounce={0.1} motionBlur={false} style={{ fontStretch: "75%", letterSpacing: "-0.03em" }} />
        {unit ? <span className="ml-1 text-[22px] font-semibold [font-stretch:80%]">{unit}</span> : null}
      </p>
      <p className="flex-1 pb-1 text-[13.5px] leading-snug text-ink-2">{label}</p>
      <div className="pb-1"><SourceStamp live={live} /></div>
    </div>
  );
}

function VoiceVisual({ day }: { day: number }) {
  const season = useDesk((s) => s.season);
  const a = useMemo(() => answer(season, season.heroPlot, Math.max(day, 118), "Why did my last spray fail?"), [season, day]);
  return (
    <Sheet className="px-5 py-5">
      <p className="label-form text-ink-3">Sunita asks <span className="normal-case tracking-normal" style={MR}>सुनीता विचारते</span></p>
      <p className="ballpoint mt-1 text-[22px] leading-snug">“मागच्या वेळी फवारणी का वाया गेली?”</p>
      <p className="ballpoint text-[16px] text-ballpoint/80">Why did my last spray fail?</p>
      <div className="ruled mt-4 pl-[52px] pr-2" style={{ ["--rule-gap" as string]: "30px", ["--margin-x" as string]: "40px" }}>
        <p className="text-[18px] leading-[30px]" style={MR}>{a.mr}</p>
        <p className="typed text-[13.5px] leading-[30px]">{a.en}</p>
      </div>
      <p className="mt-2 text-[12px] text-ink-3">From her record: {a.sources.join(" · ")}</p>
    </Sheet>
  );
}

function RippleVisual({ day }: { day: number }) {
  const season = useDesk((s) => s.season);
  const live = useDesk((s) => s.live);
  const ripple = useMemo(() => {
    const at = Math.max(141, Math.min(day, 150));
    const scanned = generateSeason({ live, overrides: { scans: [{ plot: season.heroPlot, day: at, confidence: 0.87, offline: true }] } });
    return diffSeasons(season, scanned, at, "Leaf scan synced from Sunita's phone");
  }, [season, live, day]);
  return (
    <div className="slip-shadow">
    <motion.div initial={{ rotate: -1.2, y: 10 }} animate={{ rotate: -0.6, y: 0 }} className="perforated bg-slip px-5 pb-5 pt-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[19px] font-semibold leading-tight">{ripple.label}</p>
        <Stamp tone="alert" size="sm" rotate={4}>Re-planned</Stamp>
      </div>
      <ol className="mt-3 space-y-2">
        {ripple.items.map((it, i) => (
          <motion.li key={it} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }} className="grid grid-cols-[1.2rem_1fr] gap-1">
            <span className="typed text-alert">→</span>
            <span className="typed text-[14px] leading-snug">{it}</span>
          </motion.li>
        ))}
      </ol>
      <p className="mt-3 text-[12px] text-ink-3">Computed live by the same engine the desk uses; the plot and scan are synthetic.</p>
    </motion.div>
    </div>
  );
}

function RunsVisual() {
  const season = useDesk((s) => s.season);
  const sale = season.eventsByPlot[season.heroPlot].find((e): e is Extract<PlotEvent, { type: "sale" }> => e.type === "sale");
  return (
    <div className="grid gap-4">
      <Sheet className="overflow-hidden"><SurveyMap /></Sheet>
      {sale && (
        <Sheet className="px-5 py-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[15px] font-semibold">Sunita&apos;s first sale slip, {fmtDay(sale.day)}</p>
            <Stamp size="xs" rotate={-5} press={false}>Slip read</Stamp>
          </div>
          <Waterfall sale={sale} />
          <p className="typed text-[13px]">Gross ₹{sale.gross.toLocaleString("en-IN")} · deductions ₹{(sale.gross - sale.net).toLocaleString("en-IN")} · <span className="font-bold text-stamp">net ₹{Math.round(sale.net).toLocaleString("en-IN")}</span></p>
        </Sheet>
      )}
    </div>
  );
}

function KeptVisual() {
  const season = useDesk((s) => s.season);
  const crates = weekTotals(season).reduce((a, b) => a + b, 0);
  const scans = season.events.filter((e) => e.type === "scan" && e.finding === "bacterial-blight").length;
  const net = season.events.reduce((a, e) => a + (e.type === "sale" ? e.net : 0), 0);
  const rows: [string, string, string][] = [
    ["Groundwater kept by forecast irrigation", "पावसाच्या अंदाजाने वाचलेले पाणी", `${(season.waterSavedByDay.at(-1)! / 1e6).toFixed(1)} ML`],
    ["Crates moved on pooled runs", "सामायिक गाड्यांतून गेलेले क्रेट", crates.toLocaleString("en-IN")],
    ["Pooled runs", "सामायिक फेऱ्या", season.runs.length.toLocaleString("en-IN")],
    ["Blight caught by scans", "स्कॅनने पकडलेला तेल्या", String(scans)],
    ["Paid to farmers, net of every deduction", "शेतकऱ्यांना निव्वळ रक्कम", `₹${(net / 1e7).toFixed(2)} cr`],
  ];
  return (
    <Sheet className="px-5 py-4">
      <div className="flex items-center justify-between border-b-2 border-ink pb-2">
        <p className="text-[17px] font-semibold">Season ledger, Mrig bahar 2026 <span className="font-normal text-ink-2" style={MR}>हंगामाचा हिशोब</span></p>
        <SourceStamp live={false} label="Totals from the simulated network" />
      </div>
      <ol>
        {rows.map(([en, mr, v], i) => (
          <li key={en} className="grid grid-cols-[1.4rem_1fr_auto] items-baseline gap-2 border-b border-dotted border-ink/25 py-2">
            <span className="typed text-[12px] text-ink-3">{i + 1}.</span>
            <span className="text-[14.5px] leading-snug">{en}<span className="block text-[14px] text-ink-2" style={MR}>{mr}</span></span>
            <span className="typed text-[18px] font-bold">{v}</span>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}

function ChapterVisual({ chapter, day }: { chapter: Chapter; day: number }) {
  const season = useDesk((s) => s.season);
  switch (chapter.visual) {
    case "wheel":
      return <Sheet className="mx-auto w-full max-w-[460px] p-3"><SeasonWheel plot={season.heroPlot} /></Sheet>;
    case "pest":
      return <Sheet className="overflow-hidden"><SurveyMap /></Sheet>;
    case "voice":
      return <VoiceVisual day={day} />;
    case "ripple":
      return <RippleVisual day={day} />;
    case "wave":
      return <Sheet className="px-4 py-4"><WaveChart /></Sheet>;
    case "runs":
      return <RunsVisual />;
    case "kept":
      return <KeptVisual />;
  }
}

function chapterFigure(chapter: Chapter, day: number, season: ReturnType<typeof useDesk.getState>["season"]) {
  switch (chapter.visual) {
    case "wheel": return { value: season.plots.length, label: "plots on record, each with its own season chart", live: false };
    case "pest": { const r = riskCounts(season, day); return { value: r[2] + r[3], label: `hexes on blight warning today; ${recentDetections(season, day)} scans reported in 14 days`, live: false }; }
    case "voice": return { value: 14, unit: "mm", label: "of evening rain washed off her 3 pm spray", live: false };
    case "ripple": return { value: season.events.filter((e) => e.type === "advisory" && e.text.startsWith("Blight confirmed") && e.day <= day).length, label: "neighbour warnings sent so far this season", live: false };
    case "wave": return { value: weekTotals(season)[weekOf(day)] ?? 0, label: "crates expected across the taluka this week", live: false };
    case "runs": { const runs = season.runsByDay[day] ?? []; return { value: runs.length, label: `pooled runs leaving at 05:15 today, ${runs.reduce((a, r) => a + r.crates, 0).toLocaleString("en-IN")} crates`, live: false }; }
    case "kept": return { value: season.waterSavedByDay[day] / 1e6, decimals: 1, unit: "ML", label: "of groundwater kept in the ground by skipping irrigation before rain", live: false };
  }
}

/** One season, one taluka: scrolling this section turns the shared season clock from June to January. */
export function SeasonStory() {
  const ref = useRef<HTMLElement>(null);
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const setTime = useDesk((s) => s.setTime);
  const setLayer = useDesk((s) => s.setLayer);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const day = Math.floor(t);
  const index = Math.max(0, CHAPTERS.findLastIndex((c) => day >= c.from));
  const chapter = CHAPTERS[index];
  const fig = chapterFigure(chapter, day, season);

  useMotionValueEvent(scrollYProgress, "change", (p) => setTime(Math.min(SEASON_DAYS - 1, p * (SEASON_DAYS - 1)) + 0.23));
  useEffect(() => { setTime(Math.min(SEASON_DAYS - 1, scrollYProgress.get() * (SEASON_DAYS - 1)) + 0.23); }, [scrollYProgress, setTime]);
  useEffect(() => { if (chapter.layer) setLayer(chapter.layer); }, [chapter.layer, setLayer]);

  return (
    <section ref={ref} aria-label="One season of Phaltan taluka" style={{ height: `${CHAPTERS.length * 95 + 100}vh` }} className="relative">
      <div className="sticky top-0 flex h-dvh flex-col px-3 pb-4 pt-3 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between gap-4 pb-3">
          <p className="typed text-[12px] text-board-ink-2">
            Chapter {index + 1} of {CHAPTERS.length} · {fmtDay(chapter.from)} to {fmtDay(chapter.to)}
          </p>
          <PosterStamp size={26} />
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`text-${index}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="order-2 self-center lg:order-1"
            >
              <Sheet className="px-5 py-5 sm:px-7 sm:py-6">
                <h2 className="text-[clamp(1.5rem,2.6vw,2.4rem)] font-bold leading-[1.05] [font-stretch:82%]">{chapter.title}</h2>
                <p className="mt-1 text-[clamp(1.05rem,1.6vw,1.35rem)] leading-snug text-ink-2" style={MR}>{chapter.mr}</p>
                <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-ink">{chapter.body}</p>
                <Figure value={fig.value} decimals={"decimals" in fig ? fig.decimals : 0} unit={"unit" in fig ? fig.unit : undefined} label={fig.label} live={fig.live} />
              </Sheet>
            </motion.div>
          </AnimatePresence>
          <div className="order-1 min-h-0 self-center lg:order-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`visual-${index}`}
                initial={{ opacity: 0, y: 18, rotate: 0.6 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ type: "spring", stiffness: 300, damping: 32 }}
                className={cn("max-h-[48dvh] overflow-hidden lg:max-h-[78dvh]")}
              >
                <ChapterVisual chapter={chapter} day={day} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-board-deep" aria-hidden>
          <motion.div className="h-full origin-left rounded-full bg-stamp" style={{ scaleX: scrollYProgress }} />
        </div>
      </div>
    </section>
  );
}
