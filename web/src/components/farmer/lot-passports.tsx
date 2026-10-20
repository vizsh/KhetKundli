"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, Share2, X } from "lucide-react";
import { Qr } from "@/components/record/qr";
import { Sheet, SheetHead } from "@/components/record/sheet";
import { SourceStamp } from "@/components/record/stamp";
import { mrDay } from "@/lib/farmer";
import { lotsOf, passportFor } from "@/lib/lot";
import { fmtDay } from "@/lib/sim/calendar";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

const MR = { fontFamily: "var(--font-anek-deva)" } as const;
const useOrigin = () => useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");

/** One QR per picking: the buyer scans it and sees the lot's record, without her name or gat number. */
export function LotPassports({ plot }: { plot: number }) {
  const season = useDesk((s) => s.season);
  const origin = useOrigin();
  const [open, setOpen] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const lots = lotsOf(season, plot).map((l) => ({ ...l, check: passportFor(season, l.id)?.exportCheck }));
  const current = lots.find((l) => l.id === open);
  const url = current ? `${origin}/lot/${current.id}` : "";

  return (
    <Sheet>
      <SheetHead form="KK-9" title="Lot passports" mr="लॉट पासपोर्ट" right={<SourceStamp live={false} label="From the synthetic plot record" />} />
      <p className="px-4 pt-2.5 text-[13px] leading-snug text-ink-2">
        One QR for each picking. A buyer scans it to see where the lot grew, the sprays and the export check; not your name or gat number.
        <span className="block" style={MR}>प्रत्येक तोडणीसाठी एक QR: खरेदीदाराला लॉटची नोंद दिसते, तुमचे नाव किंवा गट क्रमांक नाही.</span>
      </p>
      <div className="grid grid-cols-2 gap-2 px-4 pb-4 pt-3">
        {lots.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => { setOpen(l.id); setShared(false); }}
            className="min-h-16 rounded-[3px] border-2 border-ink/30 px-2.5 py-2 text-left hover:border-ink"
          >
            <span className="typed block text-[13px] font-bold">{l.id}</span>
            <span className="block text-[12.5px] leading-tight text-ink-2">{fmtDay(l.day)} · {l.crates} crates · {l.grade}</span>
            <span className={cn("label-form mt-1 block text-[9.5px]", l.check?.eligible ? "text-stamp" : "text-alert")}>{l.check?.eligible ? "Export PHI clear" : "Domestic market"}</span>
          </button>
        ))}
      </div>

      {/* Portalled to the body so the dialog sits above the phone's bottom bar. */}
      {origin && createPortal(
      <AnimatePresence>
        {current && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-ink/55 px-4"
            role="dialog"
            aria-modal="true"
            aria-label={`Lot passport ${current.id}`}
            onClick={() => setOpen(null)}
          >
            <motion.div initial={{ y: 16, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 8 }} className="w-full max-w-[360px] rounded-[3px] bg-paper px-5 pb-5 pt-4 shadow-[var(--shadow-lift)]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="label-form text-ink-3">Lot passport · लॉट पासपोर्ट</p>
                  <p className="typed text-[22px] font-bold leading-tight">{current.id}</p>
                  <p className="text-[13px] text-ink-2">{fmtDay(current.day)} · {current.crates} crates · grade {current.grade} <span style={MR}>· {mrDay(current.day)}</span></p>
                </div>
                <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="grid size-11 place-items-center rounded-full hover:bg-ink/10"><X className="size-5" /></button>
              </div>
              <div className="mt-3 grid place-items-center border-2 border-dashed border-ink/40 bg-paper-2 p-4">
                {url && <Qr value={url} size={220} label={`QR code for lot ${current.id}`} />}
              </div>
              <p className="typed mt-2 break-all text-center text-[10.5px] text-ink-3">{url}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a href={url} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-1.5 rounded-[3px] bg-ink text-[14px] font-bold text-paper">
                  <ExternalLink className="size-4" /> Open
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (navigator.share) await navigator.share({ title: `Lot ${current.id}`, url });
                      else await navigator.clipboard.writeText(url);
                      setShared(true);
                    } catch { /* closed the share sheet */ }
                  }}
                  className="flex min-h-12 items-center justify-center gap-1.5 rounded-[3px] border-2 border-ink text-[14px] font-bold"
                >
                  <Share2 className="size-4" /> {shared ? "Shared" : "Share"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
      )}
    </Sheet>
  );
}
