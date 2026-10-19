import { cn } from "@/lib/utils";
import type { Provenance } from "@/lib/sim/types";

export function Sheet({
  children,
  className,
  ruled = false,
  style,
  as: Tag = "section",
  ...rest
}: React.HTMLAttributes<HTMLElement> & { ruled?: boolean; as?: "section" | "div" | "article" | "aside" }) {
  return (
    <Tag className={cn("sheet", ruled && "ruled", className)} style={style} {...rest}>
      {children}
    </Tag>
  );
}

/** Form header: a form number at left, the title, and anything that belongs at the right edge. */
export function SheetHead({
  form,
  title,
  mr,
  right,
  className,
}: {
  form: string;
  title: string;
  mr?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-center justify-between gap-3 border-b-2 border-ink px-4 py-2.5", className)}>
      <h2 className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[17px] font-semibold leading-tight [font-stretch:92%]">
        <span>{title}</span>
        {mr ? <span className="whitespace-nowrap font-marathi text-[15px] font-normal text-ink-2">{mr}</span> : null}
      </h2>
      <div className="flex shrink-0 items-center gap-2">
        {right}
        <span className="typed text-[10.5px] text-ink-3">{form}</span>
      </div>
    </header>
  );
}

/** A numbered form field: the number and label are printed, the value is entered. */
export function Field({
  n,
  label,
  children,
  className,
  by = "computed",
}: {
  n: number | string;
  label: string;
  children: React.ReactNode;
  className?: string;
  by?: Provenance;
}) {
  return (
    <div className={cn("grid grid-cols-[1.5rem_6.5rem_1fr] items-baseline gap-x-2 border-b border-dotted border-ink/25 py-[5px]", className)}>
      <span className="typed text-[11px] text-ink-3">{n}.</span>
      <span className="label-form text-ink-2">{label}</span>
      <span className={cn("min-w-0 leading-snug", by === "human" ? "ballpoint text-[15px]" : "typed text-[13px]")}>{children}</span>
    </div>
  );
}

/** Text in the ink of whoever wrote it. */
export function Ink({ by, children, className }: { by: Provenance; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        by === "computed" && "typed text-[13px] text-ink",
        by === "human" && "ballpoint text-[15px]",
        by === "verified" && "typed text-[13px] text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function InkKey({ className }: { className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-3", className)}>
      <span><span className="typed text-ink">Typed</span> computed</span>
      <span><span className="ballpoint text-[13px]">Ballpoint</span> entered by a person</span>
      <span><span className="font-bold text-stamp">Stamped</span> verified</span>
    </p>
  );
}
