import Link from "next/link";

const SURFACES = [
  { href: "/desk", title: "Taluka Desk", mr: "तालुका डेस्क", note: "Survey map, Pest Radar, Harvest Wave, Water Commons, pooled runs, plot records.", ready: true },
  { href: "/farmer", title: "Farmer phone", mr: "शेतकरी अ‍ॅप", note: "Sunita's kundli wheel, today's action, offline Scan Lens, voice questions, picking date.", ready: true },
  { href: "#", title: "The file (pitch)", mr: "सादरीकरण", note: "The story for judges, told as the season's file.", ready: false },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-4 py-16">
      <p className="flex items-baseline gap-3">
        <span className="text-[56px] font-bold leading-none tracking-[-0.02em] text-board-ink [font-stretch:78%]">KhetKundli</span>
        <span className="font-marathi text-[34px] text-board-ink-2">खेतकुंडली</span>
      </p>
      <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-board-ink-2">
        Every pomegranate plot in Phaltan taluka keeps a living season record. Together, the records show what no single farmer can see.
      </p>
      <ol className="mt-10 space-y-3">
        {SURFACES.map((s, i) => (
          <li key={s.title}>
            <Link
              href={s.href}
              aria-disabled={!s.ready}
              className={`sheet group grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-4 py-3 transition-transform ${s.ready ? "hover:-translate-y-0.5" : "pointer-events-none opacity-70"}`}
            >
              <span className="typed text-[13px] text-ink-3">{String(i + 1).padStart(2, "0")}.</span>
              <span>
                <span className="flex items-baseline gap-2">
                  <span className="text-[19px] font-semibold [font-stretch:90%]">{s.title}</span>
                  <span className="font-marathi text-[16px] text-ink-2">{s.mr}</span>
                </span>
                <span className="block text-[14px] text-ink-2">{s.note}</span>
              </span>
              <span className="typed text-[12px] text-ink-3">{s.ready ? "Open →" : "Next"}</span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
