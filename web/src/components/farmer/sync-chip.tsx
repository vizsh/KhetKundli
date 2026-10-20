"use client";

import { CloudUpload, Wifi, WifiOff } from "lucide-react";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Whether the phone's record has reached the relay: synced, sending, or waiting for signal. */
export function SyncChip() {
  const { pending, online } = useDesk((s) => s.sync);
  const state = !online ? "offline" : pending ? "sending" : "synced";
  const label = {
    offline: { en: pending ? `Offline · ${pending} to send` : "Offline", mr: "सिग्नल आल्यावर पाठवले जाईल" },
    sending: { en: `Sending ${pending}`, mr: "पाठवत आहे" },
    synced: { en: "Synced", mr: "पाठवले" },
  }[state];
  const Icon = state === "offline" ? WifiOff : state === "sending" ? CloudUpload : Wifi;
  return (
    <span
      role="status"
      aria-label={`${label.en}. ${label.mr}`}
      title={label.mr}
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-[2px] border px-1.5 text-[10.5px] font-bold uppercase tracking-[0.06em]",
        state === "offline" ? "border-alert text-alert" : state === "sending" ? "border-ink/50 text-ink-2" : "border-stamp/60 text-stamp",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label.en}
    </span>
  );
}
