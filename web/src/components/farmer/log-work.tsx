"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Droplets, Minus, Plus, ShoppingBasket, SprayCan, Undo2 } from "lucide-react";
import { Ink, Sheet, SheetHead } from "@/components/record/sheet";
import { Stamp } from "@/components/record/stamp";
import { StampButton } from "@/components/record/stamp-button";
import { mrDay, mrNum } from "@/lib/farmer";
import { fmtDay } from "@/lib/sim/calendar";
import { SPRAYS } from "@/lib/sim/rules";
import { stageOf } from "@/lib/sim/selectors";
import type { FarmerEntry, PlotEvent } from "@/lib/sim/types";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

const MR = { fontFamily: "var(--font-anek-deva)" } as const;
type Kind = FarmerEntry["kind"];
type Grade = "A" | "B" | "C";

const KINDS: { kind: Kind; en: string; mr: string; Icon: typeof SprayCan }[] = [
  { kind: "spray", en: "Sprayed", mr: "फवारणी केली", Icon: SprayCan },
  { kind: "irrigate", en: "Watered", mr: "पाणी", Icon: Droplets },
  { kind: "pick", en: "Picked", mr: "तोडणी केली", Icon: ShoppingBasket },
];
const TIMES = [
  { hour: 7, en: "Morning", mr: "सकाळ" },
  { hour: 14, en: "Afternoon", mr: "दुपार" },
  { hour: 18, en: "Evening", mr: "संध्याकाळ" },
];

/** One row of large paired choices: a radio group that reads in English and Marathi. */
function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; en: string; mr: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-12 rounded-[3px] border-2 px-1.5 py-1 text-center leading-tight transition-colors",
            value === o.value ? "border-ink bg-ink text-paper" : "border-ink/30 bg-paper text-ink hover:border-ink/60",
          )}
        >
          <span className="block text-[14px] font-semibold">{o.en}</span>
          <span className="block text-[13px] opacity-85" style={MR}>{o.mr}</span>
        </button>
      ))}
    </div>
  );
}

function entryLine(e: PlotEvent): { en: string; mr: string } {
  switch (e.type) {
    case "spray": return { en: `Sprayed ${e.product}${e.washedOff ? ", washed off by rain" : ""}`, mr: e.washedOff ? "फवारणी केली, पावसाने धुतली" : "फवारणी केली" };
    case "irrigate": return { en: `Watered ${(e.litres / 1000).toFixed(1)} kL by drip`, mr: `${mrNum((e.litres / 1000).toFixed(1))} हजार लिटर पाणी दिले` };
    case "irrigate-skip": return { en: `Skipped a watering, ${(e.litresSaved / 1000).toFixed(1)} kL kept`, mr: "पाणी टाळले" };
    case "pick": return { en: `Picked ${e.crates} crates, grade ${e.grade}`, mr: `${mrNum(e.crates)} क्रेट तोडणी` };
    default: return { en: e.type, mr: "" };
  }
}

const entryType = (k: Kind, skipped: boolean): PlotEvent["type"] => (k === "spray" ? "spray" : k === "pick" ? "pick" : skipped ? "irrigate-skip" : "irrigate");

/**
 * KK-4: the farmer writes down what she did. Each entry replaces what the simulation had planned for
 * her plot, so the record, the agent and the taluka desk see her work, not a guess.
 */
export function LogWork({ plot }: { plot: number }) {
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const entries = useDesk((s) => s.overrides.entries);
  const ripple = useDesk((s) => s.ripple);
  const logEntry = useDesk((s) => s.logEntry);
  const removeEntry = useDesk((s) => s.removeEntry);
  const day = Math.floor(t);

  const [kind, setKind] = useState<Kind | null>(null);
  const [spray, setSpray] = useState<"preventive" | "curative">("preventive");
  const [hour, setHour] = useState(7);
  const [skipped, setSkipped] = useState(false);
  const [grade, setGrade] = useState<Grade>("A");
  const [crates, setCrates] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  const stage = stageOf(season, plot, day);
  const canPick = stage === "maturity" || stage === "harvest";
  const planned = useMemo(
    () => season.eventsByPlot[plot].find((e): e is Extract<PlotEvent, { type: "pick" }> => e.type === "pick" && !e.logged && e.day >= day - 3),
    [season, plot, day],
  );
  const crateCount = crates ?? planned?.crates ?? 30;
  const rain = season.weather[day]?.rainMm ?? 0;

  // Her own entries, newest first, each with the id that undoes it.
  const logged = useMemo(() => {
    const own = (entries ?? []).filter((e) => e.plot === plot);
    return season.eventsByPlot[plot]
      .filter((e) => e.logged)
      .map((e) => ({ e, id: own.find((x) => x.day === e.day && x.hour === e.hour && entryType(x.kind, x.kind === "irrigate" && x.skipped) === e.type)?.id }))
      .reverse()
      .slice(0, 5);
  }, [season, entries, plot]);

  const save = () => {
    if (!kind) return;
    // Read the time first: the ripple this entry causes is stamped while it is logged.
    const at = Date.now();
    if (kind === "spray") logEntry({ plot, day, hour, kind, spray });
    else if (kind === "irrigate") logEntry({ plot, day, hour, kind, skipped });
    else logEntry({ plot, day, hour, kind, crates: crateCount, grade });
    setSavedAt(at);
    setKind(null);
    setCrates(null);
  };

  const changed = ripple && savedAt && ripple.at >= savedAt ? ripple.items : null;

  return (
    <Sheet>
      <SheetHead form="KK-4" title="What I did" mr="मी केलेले काम" right={<span className="typed text-[11px] text-ink-3">{fmtDay(day)}</span>} />
      <div className="px-4 pb-4 pt-3">
        <p className="text-[13px] leading-snug text-ink-2">
          Write down the work you did; your record, the advice and the taluka desk follow it.{" "}
          <span style={MR}>केलेले काम नोंदवा; सल्ला त्यानुसार बदलेल.</span>
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2" role="tablist" aria-label="What did you do?">
          {KINDS.map(({ kind: k, en, mr, Icon }) => {
            const off = k === "pick" && !canPick;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                disabled={off}
                onClick={() => setKind(kind === k ? null : k)}
                className={cn(
                  "flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-[3px] border-2 px-1 leading-tight transition-colors disabled:opacity-40",
                  kind === k ? "border-stamp bg-stamp text-paper" : "border-ink/35 bg-paper-2 text-ink hover:border-ink",
                )}
              >
                <Icon className="size-6" aria-hidden />
                <span className="text-[15px] font-bold">{en}</span>
                <span className="text-[13px]" style={MR}>{mr}</span>
              </button>
            );
          })}
        </div>
        {!canPick && kind === null ? (
          <p className="mt-1.5 text-right text-[11.5px] text-ink-3">Picking opens when the fruit matures <span style={MR}>फळ पक्व झाल्यावर</span></p>
        ) : null}

        <AnimatePresence initial={false} mode="wait">
          {kind && (
            <motion.div
              key={kind}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-2.5 border-t border-dotted border-ink/30 pt-3">
                {kind === "spray" && (
                  <>
                    <Choice
                      label="Which spray"
                      value={spray}
                      onChange={setSpray}
                      options={[
                        { value: "preventive", en: "Bordeaux 1%", mr: "बोर्डो (प्रतिबंधक)" },
                        { value: "curative", en: "Copper hydroxide", mr: "कॉपर (उपचार)" },
                      ]}
                    />
                    <p className="typed text-[12px] text-ink-2">{SPRAYS[spray].product}, {SPRAYS[spray].dose}</p>
                    <Choice label="When" value={hour} onChange={setHour} options={TIMES.map((x) => ({ value: x.hour, en: x.en, mr: x.mr }))} />
                    {rain >= 5 ? (
                      <p className="text-[13px] font-semibold leading-snug text-alert">
                        {rain.toFixed(0)} mm of rain on this day: a spray will not set and a repeat will be booked.{" "}
                        <span className="font-normal" style={MR}>आज पाऊस आहे; फवारणी धुतली जाईल.</span>
                      </p>
                    ) : null}
                  </>
                )}
                {kind === "irrigate" && (
                  <Choice
                    label="Watering"
                    value={skipped ? "skip" : "water"}
                    onChange={(v) => setSkipped(v === "skip")}
                    options={[
                      { value: "water", en: "I watered", mr: "पाणी दिले" },
                      { value: "skip", en: "I skipped it", mr: "पाणी टाळले" },
                    ]}
                  />
                )}
                {kind === "pick" && (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[14px] font-semibold">Crates <span className="font-normal" style={MR}>क्रेट</span></span>
                      <div className="flex items-center gap-2">
                        <button type="button" aria-label="Five fewer crates" onClick={() => setCrates(Math.max(1, crateCount - 5))} className="grid size-11 place-items-center rounded-full border-2 border-ink/40"><Minus className="size-4" /></button>
                        <span className="ballpoint w-12 text-center text-[24px]" aria-live="polite">{crateCount}</span>
                        <button type="button" aria-label="Five more crates" onClick={() => setCrates(Math.min(400, crateCount + 5))} className="grid size-11 place-items-center rounded-full border-2 border-ink/40"><Plus className="size-4" /></button>
                      </div>
                    </div>
                    {planned ? <p className="typed text-[12px] text-ink-3">Planned: {planned.crates} crates on {fmtDay(planned.day)}</p> : null}
                    <Choice label="Grade" value={grade} onChange={setGrade} options={(["A", "B", "C"] as const).map((g) => ({ value: g, en: `Grade ${g}`, mr: `दर्जा ${g}` }))} />
                  </>
                )}
                <StampButton tone="stamp" onClick={save} className="min-h-14 w-full">
                  <span className="text-[16px] font-bold">Write in my record</span>
                  <span className="text-[15px]" style={MR}>नोंद करा</span>
                </StampButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {changed && changed.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 rounded-[3px] border-2 border-stamp/60 bg-paper px-3 py-2.5" aria-live="polite">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold">What changed <span className="font-normal" style={MR}>काय बदलले</span></p>
                <Stamp tone="stamp" size="xs" rotate={-3}>Synced</Stamp>
              </div>
              <ul className="mt-1 space-y-0.5">
                {changed.map((line) => <li key={line} className="typed text-[12.5px] leading-snug text-ink">{line}</li>)}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {logged.length > 0 && (
          <ul className="mt-3 border-t border-ink/20 pt-1.5">
            {logged.map(({ e, id }) => {
              const l = entryLine(e);
              return (
                <li key={`${e.type}-${e.day}-${e.hour}`} className="flex items-center justify-between gap-2 border-b border-dotted border-ink/25 py-1.5">
                  <span className="min-w-0">
                    <span className="typed mr-2 text-[11px] text-ink-3">{fmtDay(e.day)}</span>
                    <Ink by="human">{l.en}</Ink>
                    <span className="block text-[12.5px] text-ink-2" style={MR}>{mrDay(e.day)} · {l.mr}</span>
                  </span>
                  {id ? (
                    <button type="button" onClick={() => removeEntry(id)} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-[3px] px-2 text-[12.5px] font-semibold text-ink-2 hover:bg-ink/10">
                      <Undo2 className="size-4" /> Undo <span className="font-normal" style={MR}>रद्द</span>
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
