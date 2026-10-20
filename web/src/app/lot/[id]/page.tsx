import { Suspense } from "react";
import type { Metadata } from "next";
import { LotPassport } from "@/components/lot/lot-passport";

export const metadata: Metadata = { title: "Lot passport" };

export default function LotPage() {
  // The lot number is only known at request time, so the passport renders inside Suspense.
  return (
    <Suspense fallback={<p className="px-6 py-8 text-[14px] text-board-ink-2">Opening the lot passport…</p>}>
      <LotPassport />
    </Suspense>
  );
}
