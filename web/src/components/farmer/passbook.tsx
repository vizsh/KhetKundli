"use client";

import { ReceiptText } from "lucide-react";
import { Ink, Sheet, SheetHead } from "@/components/record/sheet";
import { DatedImpression, SourceStamp, Stamp } from "@/components/record/stamp";
import { mrDay, mrNum } from "@/lib/farmer";
import { fmtDay } from "@/lib/sim/calendar";
import type { PlotEvent } from "@/lib/sim/types";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

function line(e: PlotEvent): string {
  switch (e.type) {
    case "bahar": return e.note;
    case "irrigate": return `Irrigated ${(e.litres / 1000).toFixed(0)} kL`;
    case "irrigate-skip": return `Skipped irrigation: ${e.reason}`;
    case "scan": return e.finding === "bacterial-blight" ? `Leaf scan: bacterial blight ${Math.round(e.confidence * 100)}%${e.offline ? ", offline" : ""}` : "Leaf scan: healthy";
    case "spray": return `Sprayed ${e.product}${e.washedOff ? ", washed off by rain" : ""}`;
    case "advisory": return e.text;
    case "voice": return `Asked: ${e.question}`;
    case "pick": return `Picking ${e.picking}: ${e.crates} crates, grade ${e.grade}`;
    case "booking": return `Booked on pooled run ${e.run}`;
    case "sale": return e.slip ? `Checked sale slip: ${e.crates} crates at ₹${e.pricePerKg}/kg${e.slip.aboveCard > 0 ? `, ₹${e.slip.aboveCard.toLocaleString("en-IN")} to ask about` : ""}` : `Sale slip read: ${e.crates} crates at ₹${e.pricePerKg}/kg`;
  }
}

type Row = { label: string; from: number; to: number; kind: "gross" | "less" | "net" };

function waterfallRows(sale: Extract<PlotEvent, { type: "sale" }>): Row[] {
  const rows: Row[] = [{ label: "Gross", from: 0, to: sale.gross, kind: "gross" }];
  let running = sale.gross;
  for (const d of sale.deductions) {
    rows.push({ label: d.label, from: running - d.amount, to: running, kind: "less" });
    running -= d.amount;
  }
  rows.push({ label: "Net to you", from: 0, to: sale.net, kind: "net" });
  return rows;
}

function lineMr(e: PlotEvent): string {
  switch (e.type) {
    case "bahar": return "मृग बहार धरला";
    case "irrigate": return `${mrNum((e.litres / 1000).toFixed(0))} हजार लिटर पाणी दिले`;
    case "irrigate-skip": return "पावसाच्या अंदाजामुळे पाणी टाळले";
    case "scan": return e.finding === "bacterial-blight" ? `पानाचा स्कॅन: तेल्या रोग ${mrNum(Math.round(e.confidence * 100))}%` : "पानाचा स्कॅन: निरोगी";
    case "spray": return e.washedOff ? "फवारणी केली, पण पावसाने धुतली" : "फवारणी केली";
    case "advisory": return "सल्ला मिळाला";
    case "voice": return "प्रश्न विचारला";
    case "pick": return `${mrNum(e.picking)} तोडणी: ${mrNum(e.crates)} क्रेट`;
    case "booking": return "सामायिक गाडीत नोंद";
    case "sale": return `${e.slip ? "तपासलेली पट्टी" : "विक्री पावती"}: ${mrNum(e.crates)} क्रेट, ₹${mrNum(e.pricePerKg)}/किलो`;
  }
}

/** Gross to net, one bar per deduction: the sale slip a farmer can actually read. */
export function Waterfall({ sale }: { sale: Extract<PlotEvent, { type: "sale" }> }) {
  const W = 320, H = 150, L = 4, top = 10, bar = 26;
  const scale = (v: number) => (v / sale.gross) * (W - L * 2);
  const rows = waterfallRows(sale);
  const rowH = (H - top) / rows.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 4}`} className="w-full" role="img" aria-label={`Sale: gross ₹${sale.gross}, net ₹${Math.round(sale.net)}`}>
      {rows.map((r, i) => {
        const y = top + i * rowH;
        const x = L + scale(r.from);
        const w = Math.max(2, scale(r.to - r.from));
        return (
          <g key={r.label}>
            <rect x={x} y={y + (rowH - bar) / 2 + 4} width={w} height={bar - 10} rx={1.5} fill={r.kind === "less" ? "var(--alert)" : r.kind === "net" ? "var(--stamp)" : "var(--ink)"} opacity={r.kind === "less" ? 0.75 : 0.9} />
          </g>
        );
      })}
    </svg>
  );
}

export function Passbook({ plot, onCheckSlip }: { plot: number; onCheckSlip?: () => void }) {
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const playing = useDesk((s) => s.playing);
  const day = Math.floor(t);
  // Routine water entries are summarised on the wheel; the record keeps the decisions.
  const events = season.eventsByPlot[plot].filter((e) => e.day <= day && e.type !== "irrigate" && e.type !== "booking" && (e.type !== "irrigate-skip" || e.day >= day - 7));
  const sale = [...season.eventsByPlot[plot]].reverse().find((e): e is Extract<PlotEvent, { type: "sale" }> => e.type === "sale" && e.day <= day);
  const recent = events.slice(-10).reverse();

  return (
    <Sheet>
      <SheetHead
        form={season.plots[plot].id}
        title="My record"
        mr="माझी नोंद"
        right={
          <>
            <SourceStamp live={false} label="Synthetic plot record" />
            <DatedImpression day={day} playing={playing} />
          </>
        }
      />
      {sale ? (
        <div className="border-b border-ink/15 px-4 pb-3 pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[14px] font-semibold">Last sale, {fmtDay(sale.day)} <span className="font-normal text-ink-2" style={{ fontFamily: "var(--font-anek-deva)" }}>शेवटची विक्री, {mrDay(sale.day)}</span></p>
            {sale.slip ? (
              <Stamp size="xs" tone={sale.slip.aboveCard > 0 ? "alert" : "stamp"} rotate={-5} press={false}>{sale.slip.aboveCard > 0 ? `₹${sale.slip.aboveCard.toLocaleString("en-IN")} to ask` : "Slip checked"}</Stamp>
            ) : (
              <Stamp size="xs" rotate={-5} press={false}>Slip read</Stamp>
            )}
          </div>
          <Waterfall sale={sale} />
          <ul className="typed -mt-1 space-y-0.5 text-[12.5px]">
            <li className="flex justify-between"><span>Gross, {sale.kg ? `${sale.crates} crates, ${sale.kg.toLocaleString("en-IN")} kg` : `${sale.crates} crates × 20 kg`} × ₹{sale.pricePerKg}</span><span>₹{sale.gross.toLocaleString("en-IN")}</span></li>
            {sale.deductions.map((d) => (
              <li key={d.label} className="flex justify-between gap-2 text-alert">
                <span>
                  {d.label}
                  {d.card !== undefined && d.amount > d.card + 1 ? <span className="block text-[11.5px] font-bold">agreed {d.card ? `₹${d.card.toLocaleString("en-IN")}` : "none"}</span> : null}
                </span>
                <span>−₹{d.amount.toLocaleString("en-IN")}</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-ink pt-0.5 font-bold text-stamp"><span>Net to you · तुम्हाला निव्वळ</span><span>₹{Math.round(sale.net).toLocaleString("en-IN")}</span></li>
          </ul>
        </div>
      ) : null}
      {onCheckSlip && (
        <button type="button" onClick={onCheckSlip} className="flex min-h-12 w-full items-center gap-2.5 border-b border-ink/15 px-4 text-left hover:bg-paper-2">
          <ReceiptText className="size-5 shrink-0" />
          <span className="flex-1 text-[15px] font-semibold leading-tight">Check a sale slip <span className="whitespace-nowrap font-normal text-ink-2" style={{ fontFamily: "var(--font-anek-deva)" }}>पट्टी तपासा</span></span>
        </button>
      )}
      <ol className="ruled" style={{ ["--rule-gap" as string]: "28px", ["--margin-x" as string]: "64px" }}>
        {recent.length === 0 && <li className="pl-[76px] pr-4 text-[13px] leading-[28px] text-ink-3">No entries yet.</li>}
        {recent.map((e) => (
          <li key={e.id} className="grid min-h-[28px] grid-cols-[64px_1fr] items-start">
            <span className="typed pl-3 text-[11.5px] leading-[28px] text-ink-3">{fmtDay(e.day)}</span>
            <span className={cn("pl-3 pr-4 leading-[28px] [&>span:first-child]:leading-[28px]", ((e.type === "scan" && e.finding === "bacterial-blight") || (e.type === "spray" && e.washedOff)) && "[&_*]:!text-alert")}>
              <Ink by={e.by}>{line(e)}</Ink>
              {e.by === "verified" ? <Stamp size="xs" rotate={-6} press={false} className="ml-2 align-middle">Verified</Stamp> : null}
              <span className="block pb-1 text-[13.5px] leading-snug text-ink-2" style={{ fontFamily: "var(--font-anek-deva)" }}>{lineMr(e)}</span>
            </span>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}
