"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, CheckCheck, Volume2, X } from "lucide-react";
import type { FarmMessage } from "@/lib/channel";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

const MR = { fontFamily: "var(--font-anek-deva)" } as const;
const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });

function speak(text: string) {
  if (typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith("mr")) ?? speechSynthesis.getVoices().find((x) => x.lang.startsWith("hi"));
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "mr-IN";
  speechSynthesis.speak(u);
}

/**
 * Advisories the officer sent to this plot: a banner when one arrives, a bell with the unread count,
 * and the list. The phone sends its own receipts: delivered on arrival, read when she opens it.
 */
export function Messages({ plot }: { plot: number }) {
  const all = useDesk((s) => s.messages);
  const acknowledge = useDesk((s) => s.acknowledge);
  const mine = all.filter((m) => m.plot === plot);
  const unread = mine.filter((m) => !m.readAt).length;
  const [open, setOpen] = useState(false);
  const [banner, setBanner] = useState<FarmMessage | null>(null);
  const seen = useRef<Set<string> | null>(null);
  // Messages that were already waiting when the page opened get the badge, not a banner.
  const openedAt = useRef(0);
  useEffect(() => { openedAt.current = Date.now(); }, []);

  // Delivered as soon as the phone has it; a banner for anything new since this page opened.
  useEffect(() => {
    if (!seen.current) {
      seen.current = new Set(mine.map((m) => m.id));
      for (const m of mine) if (!m.deliveredAt) acknowledge(m.id, "delivered");
      return;
    }
    for (const m of mine) {
      if (seen.current.has(m.id)) continue;
      seen.current.add(m.id);
      acknowledge(m.id, "delivered");
      if (Date.parse(m.sentAt) < openedAt.current - 3000) continue;
      queueMicrotask(() => setBanner(m));
      if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(120);
    }
  }, [mine, acknowledge]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 9000);
    return () => clearTimeout(t);
  }, [banner]);

  const openList = () => {
    setOpen(true);
    setBanner(null);
    for (const m of mine) if (!m.readAt) acknowledge(m.id, "read");
  };

  return (
    <>
      <button type="button" onClick={openList} aria-label={unread ? `${unread} new messages` : "Messages"} className="relative grid size-9 place-items-center rounded-full border-2 border-board-ink/40 text-board-ink hover:border-board-ink">
        <Bell className="size-4" />
        {unread > 0 && <span className="typed absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-alert px-1 text-[10.5px] font-bold leading-[18px] text-paper">{unread}</span>}
      </button>

      <AnimatePresence>
        {banner && (
          <motion.button
            type="button"
            onClick={openList}
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="fixed inset-x-3 top-3 z-[60] mx-auto max-w-[456px] rounded-[4px] border-2 border-ink bg-slip px-3.5 py-2.5 text-left shadow-[0_10px_30px_-10px_rgba(0,0,0,0.45)]"
          >
            <span className="label-form flex items-center gap-1.5 text-stamp"><Bell className="size-3.5" /> Advisory from the extension officer <span style={MR} className="normal-case tracking-normal">कृषी सहाय्यक</span></span>
            <span className="mt-1 block text-[15px] leading-snug" style={MR}>{banner.textMr}</span>
            <span className="typed mt-0.5 block text-[11.5px] leading-snug text-ink-2">{banner.text}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col bg-paper"
            role="dialog"
            aria-modal="true"
            aria-label="Messages"
          >
            <header className="flex items-center justify-between border-b-2 border-ink px-4 py-3">
              <h2 className="flex items-baseline gap-2 text-[19px] font-semibold [font-stretch:90%]">Messages <span className="text-[17px] font-normal text-ink-2" style={MR}>संदेश</span></h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-12 place-items-center rounded-full hover:bg-ink/10"><X className="size-5" /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {mine.length === 0 ? (
                <p className="text-[14px] text-ink-3">No messages yet. Warnings from the extension officer arrive here, and as a banner on this phone. <span style={MR}>अधिकाऱ्यांचे संदेश इथे दिसतील.</span></p>
              ) : (
                <ul className="space-y-3">
                  {mine.map((m) => (
                    <li key={m.id} className="slip-shadow">
                      <div className="bg-slip px-3.5 py-3">
                        <p className="text-[16px] leading-snug" style={MR}>{m.textMr}</p>
                        <p className="typed mt-1 text-[12px] leading-snug text-ink-2">{m.text}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="typed flex items-center gap-1 text-[11px] text-ink-3"><CheckCheck className={cn("size-3.5", m.readAt ? "text-stamp" : "")} /> {hm(m.sentAt)} · {m.channel === "app" ? "in the app" : "by SMS"}</span>
                          <button type="button" onClick={() => speak(m.textMr)} className="inline-flex min-h-10 items-center gap-1.5 rounded-[3px] border-2 border-stamp px-2.5 text-[13px] font-semibold text-stamp">
                            <Volume2 className="size-4" /> <span style={MR}>ऐका</span>
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
