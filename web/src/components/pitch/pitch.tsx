"use client";

import Link from "next/link";
import { ArrowDown, Map, Smartphone } from "lucide-react";
import { LiveWeatherLoader } from "@/components/desk/weather-slip";
import { Sheet } from "@/components/record/sheet";
import { SourceStamp, Stamp } from "@/components/record/stamp";
import { StampButton } from "@/components/record/stamp-button";
import { useDesk } from "@/lib/store";
import { PosterStamp } from "./poster-stamp";
import { SeasonStory } from "./season-story";

const MR = { fontFamily: "var(--font-tiro-marathi), var(--font-anek-deva)" } as const;

const SOURCES: { sponsor: string; title: string; module: string; mr: string; where: string }[] = [
  { sponsor: "Govt. of Punjab", title: "Smart crop advisory for small and marginal farmers", module: "Advice from the plot's own record and the live forecast", mr: "शेताच्या नोंदीवर आधारित सल्ला", where: "Phone: today slip, spray window" },
  { sponsor: "Govt. of Kerala", title: "AI-powered personal farming assistant", module: "The kundli wheel: one plot, one season, remembered", mr: "शेताची कुंडली", where: "Phone: season wheel, passbook" },
  { sponsor: "Govt. of Kerala", title: "Gamified platform for sustainable practices", module: "Water Commons: a shared village goal, not a leaderboard", mr: "पाण्याचा सामायिक साठा", where: "Desk: Water Commons layer" },
  { sponsor: "Govt. of Kerala", title: "AI-based farmer query support", module: "Marathi voice questions answered from the record", mr: "मराठीत प्रश्न, नोंदीतून उत्तर", where: "Phone: Ask" },
  { sponsor: "Qualcomm, ID 26257", title: "On-device detection of disease, pests and deficiencies", module: "Scan Lens: a leaf model that runs with no signal", mr: "इंटरनेटशिवाय पानाचा स्कॅन", where: "Phone: Scan a leaf" },
  { sponsor: "Team Outliers", title: "Uber for Harvest: shared transport for small lots", module: "Harvest Wave and pooled runs planned days ahead", mr: "तोडणी लाट आणि सामायिक वाहतूक", where: "Desk: Harvest Wave, Pooled Runs" },
];

function openPhone() {
  window.open("/farmer", "sunita-phone", "popup,width=430,height=900");
}

function Hero() {
  return (
    <header className="relative flex min-h-dvh flex-col px-4 pb-8 pt-4 sm:px-8 lg:px-12">
      <nav className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-baseline gap-2 leading-none">
          <span className="text-[24px] font-bold text-board-ink [font-stretch:80%]">KhetKundli</span>
          <span className="font-marathi text-[18px] text-board-ink-2">खेतकुंडली</span>
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/desk" className="inline-flex min-h-11 items-center gap-2 rounded-[2px] border-2 border-board-ink px-3 text-[14px] font-semibold text-board-ink transition-colors hover:bg-board-ink hover:text-board">
            <Map className="size-4" /> Taluka Desk
          </Link>
          <button type="button" onClick={openPhone} className="inline-flex min-h-11 items-center gap-2 rounded-[2px] border-2 border-board-ink px-3 text-[14px] font-semibold text-board-ink transition-colors hover:bg-board-ink hover:text-board">
            <Smartphone className="size-4" /> Sunita&apos;s phone
          </button>
        </div>
      </nav>

      <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
        <div>
          <h1 className="max-w-[16ch] text-[clamp(2.6rem,6.2vw,5.6rem)] font-bold leading-[0.95] tracking-[-0.02em] text-board-ink [font-stretch:78%]">
            Every plot remembers. Every village sees together.
          </h1>
          <p className="mt-4 text-[clamp(1.3rem,2.4vw,2rem)] leading-snug text-board-ink" style={MR}>
            प्रत्येक शेत लक्षात ठेवते. संपूर्ण गाव एकत्र पाहते.
          </p>
          <p className="mt-6 max-w-[54ch] text-[17px] leading-relaxed text-board-ink-2">
            KhetKundli gives every pomegranate plot in Phaltan taluka a living season record that advice, leaf scans, voice questions, water and transport all read and write. Put together, the records show what no single farmer can see: where blight is spreading, when each village will harvest, and how much water the village is keeping.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/desk" className="contents">
              <StampButton className="min-h-14 px-5">
                <Map className="size-5" />
                <span className="text-left leading-tight">
                  <span className="block text-[16px] font-bold">Open the Taluka Desk</span>
                  <span className="block text-[13px] opacity-90" style={{ fontFamily: "var(--font-anek-deva)" }}>तालुका डेस्क</span>
                </span>
              </StampButton>
            </Link>
            <StampButton tone="stamp" onClick={openPhone} className="min-h-14 px-5">
              <Smartphone className="size-5" />
              <span className="text-left leading-tight">
                <span className="block text-[16px] font-bold">Open Sunita&apos;s phone</span>
                <span className="block text-[13px] opacity-90" style={{ fontFamily: "var(--font-anek-deva)" }}>सुनीताचा फोन</span>
              </span>
            </StampButton>
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-center">
          <PosterStamp size={64} className="hidden sm:inline-flex" />
          <PosterStamp size={36} className="sm:hidden" />
          <p className="typed flex items-center gap-2 text-[13px] text-board-ink-2">
            <ArrowDown className="size-4" /> scroll to play one season, 1 Jun 2026 to 31 Jan 2027
          </p>
        </div>
      </div>
    </header>
  );
}

function ProblemMap() {
  return (
    <section className="px-4 py-16 sm:px-8 lg:px-12" aria-labelledby="sources-title">
      <h2 id="sources-title" className="text-[clamp(1.8rem,3.4vw,3rem)] font-bold leading-tight text-board-ink [font-stretch:80%]">
        Six problem statements, one record
      </h2>
      <p className="mt-1 text-[18px] text-board-ink-2" style={MR}>सहा प्रश्न, एकच नोंद</p>
      <Sheet className="mt-6">
        <ol>
          {SOURCES.map((s, i) => (
            <li key={s.title} className="grid gap-x-4 gap-y-1 border-b border-ink/20 px-4 py-3.5 last:border-b-0 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.1fr)] sm:px-6">
              <span className="typed text-[13px] text-ink-3">{String(i + 1).padStart(2, "0")}.</span>
              <span>
                <span className="typed block text-[11.5px] uppercase text-ink-3">{s.sponsor}</span>
                <span className="block text-[15px] font-semibold leading-snug">{s.title}</span>
              </span>
              <span>
                <span className="block text-[15px] leading-snug">{s.module}</span>
                <span className="block text-[15px] leading-snug text-ink-2" style={MR}>{s.mr}</span>
                <span className="typed mt-0.5 block text-[12px] text-stamp">{s.where}</span>
              </span>
            </li>
          ))}
        </ol>
      </Sheet>
    </section>
  );
}

function HonestLedger() {
  const liveStatus = useDesk((s) => s.liveStatus);
  const rows: { item: string; detail: string; live: boolean }[] = [
    { item: "Weather, evaporation and the 72-hour spray window", detail: "Open-Meteo forecast for Phaltan, refreshed hourly", live: liveStatus === "live" },
    { item: "Taluka geography and pooled-run routes", detail: "OpenStreetMap boundary, villages, roads, Nira river and canals; routes on the real road graph", live: true },
    { item: "Tomato and capsicum leaf scans", detail: "MobileNetV2 (PlantVillage) running in the browser, about 80 ms; often wrong on field photos until retrained", live: true },
    { item: "Season weather and wind", detail: "Recorded hourly weather for Phaltan since 1 June (Open-Meteo archive) drives the blight model; 7-day forecast and a live 9-point wind grid drive the 72-hour spread forecast", live: true },
    { item: "Sale slip reading and checks", detail: "Tesseract OCR on the phone in about a second, then arithmetic and the agreed rate card; works on printed slips, not handwriting yet", live: true },
    { item: "Pomegranate scan result", detail: "Scripted until a model is trained on Phaltan photos (pipeline in ml/train.py)", live: false },
    { item: "192 farmers, their plots, sprays, harvests and sales", detail: "Synthetic season from a deterministic engine; every screen says so", live: false },
    { item: "Mandi prices", detail: "Simulated until a data.gov.in Agmarknet key is configured, then today's modal price is live", live: false },
  ];
  return (
    <section className="px-4 pb-16 sm:px-8 lg:px-12" aria-labelledby="honest-title">
      <h2 id="honest-title" className="text-[clamp(1.8rem,3.4vw,3rem)] font-bold leading-tight text-board-ink [font-stretch:80%]">
        What is live, what is simulated
      </h2>
      <p className="mt-1 text-[18px] text-board-ink-2" style={MR}>काय प्रत्यक्ष, काय नमुना</p>
      <Sheet className="ruled mt-6" style={{ ["--rule-gap" as string]: "44px", ["--margin-x" as string]: "52px" } as React.CSSProperties}>
        <ol>
          {rows.map((r, i) => (
            <li key={r.item} className="grid min-h-[44px] grid-cols-[52px_minmax(0,1fr)_auto] items-start gap-3 pr-4 sm:pr-6">
              <span className="typed pl-3 pt-3 text-[12px] text-ink-3">{i + 1}.</span>
              <span className="py-2.5">
                <span className="block text-[15px] font-semibold leading-snug">{r.item}</span>
                <span className="block text-[13.5px] leading-snug text-ink-2">{r.detail}</span>
              </span>
              <span className="pt-3"><SourceStamp live={r.live} /></span>
            </li>
          ))}
        </ol>
      </Sheet>
    </section>
  );
}

function Close() {
  return (
    <footer className="px-4 pb-20 pt-6 sm:px-8 lg:px-12">
      <div className="slip-shadow">
      <div className="perforated flex flex-wrap items-center justify-between gap-6 bg-slip px-6 pb-7 pt-9 sm:px-10">
        <div>
          <p className="text-[clamp(1.5rem,2.8vw,2.4rem)] font-bold leading-tight [font-stretch:82%]">See one leaf ripple through a whole taluka.</p>
          <p className="mt-1 text-[18px] text-ink-2" style={MR}>एका पानापासून संपूर्ण तालुक्यापर्यंत.</p>
          <p className="mt-3 max-w-[60ch] text-[14.5px] text-ink-2">
            Open the desk, then Sunita&apos;s phone beside it. Scan a leaf on the phone and watch the desk re-plan. Team Outliers, Phaltan Hackathon 2026.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/desk" className="contents">
            <StampButton className="min-h-14 px-5"><Map className="size-5" /><span className="text-[16px] font-bold">Taluka Desk</span></StampButton>
          </Link>
          <StampButton tone="stamp" onClick={openPhone} className="min-h-14 px-5"><Smartphone className="size-5" /><span className="text-[16px] font-bold">Sunita&apos;s phone</span></StampButton>
          <Stamp tone="stamp" size="md" rotate={-6} press={false}>Phaltan 2026</Stamp>
        </div>
      </div>
      </div>
      <p className="typed mt-4 text-center text-[11px] text-board-ink-2">
        Map data © OpenStreetMap contributors (ODbL). Weather by Open-Meteo. Synthetic farmers and plots for demonstration.
      </p>
    </footer>
  );
}

export function Pitch() {
  return (
    <main>
      <LiveWeatherLoader />
      <Hero />
      <SeasonStory />
      <ProblemMap />
      <HonestLedger />
      <Close />
    </main>
  );
}
