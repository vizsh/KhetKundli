"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, ChevronUp, Pause, Play, RotateCcw } from "lucide-react";
import Counter from "@/components/Counter";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { dateOf, dayOf, fmtDay, MONTHS, SEASON_DAYS } from "@/lib/sim/calendar";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

const DAYS_PER_SECOND = 0.65;
const RUN_DAYS_PER_SECOND = 0.035;

/** Advances simulated time while playing. Vehicles and hours move only through this. */
export function SeasonPlayer() {
  const playing = useDesk((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const { t, setTime, setPlaying, layer } = useDesk.getState();
      const hour = (t % 1) * 24;
      // On the Runs layer the clock slows through the morning run so vehicles can be watched.
      const speed = layer === "runs" && hour >= 5 && hour < 7 ? RUN_DAYS_PER_SECOND : DAYS_PER_SECOND;
      const next = t + ((now - last) / 1000) * speed;
      last = now;
      if (next >= SEASON_DAYS - 0.02) { setTime(SEASON_DAYS - 0.02); setPlaying(false); return; }
      setTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  return null;
}

function Band({
  label,
  onStep,
  children,
  valueText,
  width,
}: {
  label: string;
  onStep: (delta: number) => void;
  children: React.ReactNode;
  valueText: string;
  width: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      onStep(e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onStep]);
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        aria-label={`Previous ${label}`}
        onClick={() => onStep(-1)}
        className="grid h-4 w-full place-items-center text-board-ink-2 transition-colors hover:text-ink"
      >
        <ChevronUp className="size-3.5" strokeWidth={2.5} />
      </button>
      <div
        ref={ref}
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuetext={valueText}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); onStep(-1); }
          if (e.key === "ArrowDown") { e.preventDefault(); onStep(1); }
        }}
        className={cn(
          "relative grid h-9 place-items-center overflow-hidden rounded-[2px] bg-ink text-paper",
          width,
        )}
      >
        {children}
      </div>
      <button
        type="button"
        aria-label={`Next ${label}`}
        onClick={() => onStep(1)}
        className="grid h-4 w-full place-items-center text-board-ink-2 transition-colors hover:text-ink"
      >
        <ChevronDown className="size-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

function MonthRoll({ m, dir }: { m: number; dir: number }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false} custom={dir} mode="popLayout">
      <motion.span
        key={m}
        custom={dir}
        initial={reduce ? false : { y: dir >= 0 ? "100%" : "-100%", filter: "blur(2px)" }}
        animate={{ y: "0%", filter: "blur(0px)" }}
        exit={reduce ? undefined : { y: dir >= 0 ? "-100%" : "100%", filter: "blur(2px)" }}
        transition={{ type: "spring", stiffness: 520, damping: 34 }}
        className="text-[19px] font-bold tracking-[0.08em] [font-stretch:86%]"
      >
        {MONTHS[m]}
      </motion.span>
    </AnimatePresence>
  );
}

export function DateStamp() {
  const t = useDesk((s) => s.t);
  const playing = useDesk((s) => s.playing);
  const today = useDesk((s) => s.today);
  const setDay = useDesk((s) => s.setDay);
  const setPlaying = useDesk((s) => s.setPlaying);
  const day = Math.floor(t);
  const { d, m, y } = dateOf(day);
  const [prevMonth, setPrevMonth] = useState(m);
  const [dir, setDir] = useState(1);
  if (prevMonth !== m) {
    setDir(Math.sign(((m - prevMonth + 18) % 12) - 6) || 1);
    setPrevMonth(m);
  }

  const stepDay = (delta: number) => setDay(day + delta);
  const stepMonth = (delta: number) => {
    const target = dayOf(y, m + delta, Math.min(d, 28));
    setDay(target);
  };
  const stepYear = (delta: number) => setDay(dayOf(y + delta, m, d));

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-end gap-1.5 rounded-[3px] border-[1.5px] border-board-ink px-1.5 pb-0.5 pt-0.5">
        <Band label="Day" onStep={stepDay} valueText={String(d)} width="w-11">
          <Counter value={d} minDigits={2} fontSize={20} fontWeight={700} intro={false} duration={0.45} bounce={0.15} className="typed" />
        </Band>
        <Band label="Month" onStep={stepMonth} valueText={MONTHS[m]} width="w-[3.4rem]">
          <MonthRoll m={m} dir={dir} />
        </Band>
        <Band label="Year" onStep={stepYear} valueText={String(y)} width="w-[3.7rem]">
          <Counter value={y} fontSize={20} fontWeight={700} intro={false} duration={0.5} className="typed" format={{ useGrouping: false }} />
        </Band>
      </div>
      <div className="flex flex-col gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setPlaying(!playing)}
              aria-label={playing ? "Pause the season" : "Play the season"}
              className="grid size-8 place-items-center rounded-full bg-ink text-paper transition-transform active:scale-95"
            >
              {playing ? <Pause className="size-3.5" fill="currentColor" /> : <Play className="size-3.5 translate-x-px" fill="currentColor" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{playing ? "Pause" : "Play the season forward"}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => { setPlaying(false); setDay(today); }}
              aria-label="Back to today"
              disabled={day === today}
              className="grid size-8 place-items-center rounded-full border-2 border-board-ink/70 text-board-ink transition-opacity disabled:opacity-35"
            >
              <RotateCcw className="size-3.5" strokeWidth={2.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Back to today, {fmtDay(today)}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

const TRACK_MONTHS = [
  { label: "JUN", day: 0 }, { label: "JUL", day: 30 }, { label: "AUG", day: 61 }, { label: "SEP", day: 92 },
  { label: "OCT", day: 122 }, { label: "NOV", day: 153 }, { label: "DEC", day: 183 }, { label: "JAN", day: 214 },
];

/** The season track: one axis, scrubbed by dragging; every sheet re-inks as it moves. */
export function SeasonTrack({ className }: { className?: string }) {
  const t = useDesk((s) => s.t);
  const today = useDesk((s) => s.today);
  const setTime = useDesk((s) => s.setTime);
  const setPlaying = useDesk((s) => s.setPlaying);
  const ref = useRef<SVGSVGElement>(null);
  const W = 420, H = 36, PAD = 6;
  const x = (day: number) => PAD + (day / SEASON_DAYS) * (W - PAD * 2);
  const fromPointer = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    const frac = (clientX - r.left) / r.width;
    const day = ((frac * W - PAD) / (W - PAD * 2)) * SEASON_DAYS;
    setTime(Math.floor(Math.max(0, Math.min(SEASON_DAYS - 1, day))) + 0.23);
  };
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      className={cn("h-[36px] w-full cursor-ew-resize touch-none select-none", className)}
      role="slider"
      aria-label="Season day"
      aria-valuemin={0}
      aria-valuemax={SEASON_DAYS - 1}
      aria-valuenow={Math.floor(t)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") setTime(Math.floor(t) + 1.23);
        if (e.key === "ArrowLeft") setTime(Math.floor(t) - 0.77);
      }}
      onPointerDown={(e) => {
        setPlaying(false);
        (e.target as Element).setPointerCapture?.(e.pointerId);
        fromPointer(e.clientX);
      }}
      onPointerMove={(e) => { if (e.buttons === 1) fromPointer(e.clientX); }}
    >
      <rect x={x(150)} y={9} width={x(215) - x(150)} height={10} fill="var(--wave-3)" opacity={0.28} />
      <line x1={PAD} x2={W - PAD} y1={19} y2={19} stroke="var(--board-ink)" strokeWidth={1.25} />
      {Array.from({ length: SEASON_DAYS }, (_, i) => i).filter((i) => i % 7 === 0).map((i) => (
        <line key={i} x1={x(i)} x2={x(i)} y1={16} y2={19} stroke="var(--board-ink)" strokeWidth={0.75} opacity={0.6} />
      ))}
      {TRACK_MONTHS.map((mo) => (
        <g key={mo.label}>
          <line x1={x(mo.day)} x2={x(mo.day)} y1={12} y2={19} stroke="var(--board-ink)" strokeWidth={1.25} />
          <text x={x(mo.day) + 3} y={34} fontSize={10.5} fontWeight={700} fill="var(--board-ink-2)" style={{ fontStretch: "85%" }}>{mo.label}</text>
        </g>
      ))}
      <line x1={x(today)} x2={x(today)} y1={6} y2={22} stroke="var(--ink)" strokeWidth={1.5} />
      <text x={x(today) + 3} y={9} fontSize={10} fontWeight={700} fill="var(--ink)">TODAY</text>
      <text x={x(215) - 3} y={9} textAnchor="end" fontSize={10} fontWeight={600} fill="var(--board-ink-2)">HARVEST</text>
      <g transform={`translate(${x(t)},0)`}>
        <line y1={4} y2={24} stroke="var(--stamp)" strokeWidth={2} />
        <path d="M-5 2 L5 2 L0 8 Z" fill="var(--stamp)" />
      </g>
    </svg>
  );
}
