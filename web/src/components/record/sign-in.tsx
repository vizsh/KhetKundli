"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { Sheet, SheetHead } from "@/components/record/sheet";
import { Stamp } from "@/components/record/stamp";
import { StampButton } from "@/components/record/stamp-button";
import { useSession, type Person, type Role } from "@/lib/session";
import { cn } from "@/lib/utils";

const MR = { fontFamily: "var(--font-anek-deva)" } as const;
const ROLE: Record<Role, { en: string; mr: string }> = {
  farmer: { en: "Farmer", mr: "शेतकरी" },
  officer: { en: "Extension officer", mr: "कृषी सहाय्यक" },
  fpo_admin: { en: "FPO admin", mr: "एफपीओ" },
  buyer: { en: "Buyer", mr: "खरेदीदार" },
};
const tenDigits = (phone: string) => phone.replace(/\D/g, "").slice(-10);

/** Sign in with a mobile number and a one-time code. */
function SignIn({ roles, title, mr }: { roles: Role[]; title: string; mr: string }) {
  const { sink, demoPeople, requestCode, verify } = useSession();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const people = demoPeople.filter((p) => roles.includes(p.role));

  const send = async (number = phone) => {
    setBusy(true);
    setError(null);
    const r = await requestCode(number);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setPhone(number);
    setDevCode(r.devCode ?? null);
    setCode(r.devCode ?? "");
    setStep("code");
  };
  const check = async () => {
    setBusy(true);
    setError(null);
    const r = await verify(phone, code);
    setBusy(false);
    if (!r.ok) setError(r.error);
  };

  return (
    <div className="grid min-h-dvh place-items-center px-3 py-8">
      <Sheet className="w-full max-w-[420px]">
        <SheetHead form="KK-0" title={title} mr={mr} />
        <div className="px-5 pb-5 pt-4">
          {step === "phone" ? (
            <form onSubmit={(e) => { e.preventDefault(); void send(); }}>
              <label htmlFor="kk-phone" className="text-[14px] font-semibold">
                Mobile number <span className="font-normal text-ink-2" style={MR}>मोबाईल नंबर</span>
              </label>
              <div className="mt-1.5 flex items-stretch overflow-hidden rounded-[3px] border-2 border-ink">
                <span className="typed grid place-items-center bg-paper-2 px-3 text-[15px]">+91</span>
                <input
                  id="kk-phone"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, "").slice(0, 12))}
                  placeholder="98765 43210"
                  className="typed min-h-12 w-full bg-paper px-3 text-[18px] tracking-wide outline-none"
                />
              </div>
              <StampButton tone="stamp" type="submit" disabled={busy || tenDigits(phone).length !== 10} className="mt-3 min-h-13 w-full">
                <span className="text-[16px] font-bold">{busy ? "Sending…" : "Send code"}</span>
                <span className="text-[15px]" style={MR}>कोड पाठवा</span>
              </StampButton>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); void check(); }}>
              <p className="text-[13px] text-ink-2">
                Code sent to <span className="typed text-ink">+91 {tenDigits(phone)}</span>{" "}
                <button type="button" className="font-semibold underline" onClick={() => { setStep("phone"); setDevCode(null); setCode(""); }}>change</button>
              </p>
              <label htmlFor="kk-code" className="mt-3 block text-[14px] font-semibold">
                6-digit code <span className="font-normal text-ink-2" style={MR}>६ अंकी कोड</span>
              </label>
              <input
                id="kk-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="typed mt-1.5 min-h-12 w-full rounded-[3px] border-2 border-ink bg-paper px-3 text-center text-[24px] tracking-[0.4em] outline-none"
              />
              {devCode && (
                <p className="mt-2 flex items-start gap-2 text-[12.5px] leading-snug text-ink-2">
                  <Stamp tone="ink" size="xs" rotate={-3} press={false}>Dev</Stamp>
                  <span>SMS is not connected yet, so the code is shown and filled in here. Once SMS is on, it never is.</span>
                </p>
              )}
              <StampButton tone="stamp" type="submit" disabled={busy || code.length !== 6} className="mt-3 min-h-13 w-full">
                <span className="text-[16px] font-bold">{busy ? "Checking…" : "Sign in"}</span>
                <span className="text-[15px]" style={MR}>लॉग इन करा</span>
              </StampButton>
            </form>
          )}
          {error && <p role="alert" className="mt-3 text-[13.5px] font-semibold text-alert">{error}</p>}

          {sink === "screen" && people.length > 0 && step === "phone" && (
            <div className="mt-5 border-t border-dotted border-ink/30 pt-3">
              <p className="label-form text-ink-3">Demo people · synthetic</p>
              <ul className="mt-1.5 space-y-1.5">
                {people.map((p) => (
                  <li key={p.phone}>
                    <button
                      type="button"
                      onClick={() => void send(p.phone)}
                      disabled={busy}
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[3px] border-2 border-ink/25 bg-paper-2 px-3 text-left hover:border-ink"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                        <span className="block truncate text-[13px] text-ink-2" style={MR}>{p.nameMr}</span>
                      </span>
                      <span className="typed shrink-0 text-right text-[11px] text-ink-3">{ROLE[p.role].en}<br />+91 {tenDigits(p.phone)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}

/** A small "signed in as … · sign out" line for a page header. */
export function SignedInAs({ person, className }: { person: Person; className?: string }) {
  const signOut = useSession((s) => s.signOut);
  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-[3px] px-1.5 text-[12px] text-ink-2 hover:bg-ink/10", className)}
      title={`Signed in as ${person.name} (${ROLE[person.role].en}). Sign out.`}
    >
      <LogOut className="size-3.5" /> <span className="max-w-[12rem] truncate">{person.name}</span>
    </button>
  );
}

/**
 * Shows its children only to a signed-in person with one of `roles`; everyone else gets the sign-in
 * sheet. The children are keyed by the person, so switching people starts the screen afresh.
 */
export function SignInGate({ roles, title, mr, children }: { roles: Role[]; title: string; mr: string; children: (person: Person) => React.ReactNode }) {
  const { status, person, load, signOut } = useSession();
  useEffect(() => { void load(); }, [load]);
  if (status === "loading") return <p className="px-6 py-8 text-[14px] text-board-ink-2">Opening…</p>;
  if (!person) return <SignIn roles={roles} title={title} mr={mr} />;
  if (!roles.includes(person.role)) {
    return (
      <div className="grid min-h-dvh place-items-center px-3">
        <Sheet className="w-full max-w-[420px] px-5 py-5">
          <p className="text-[16px] font-semibold">Signed in as {person.name} ({ROLE[person.role].en}).</p>
          <p className="mt-1 text-[14px] text-ink-2">This page is for {roles.map((r) => ROLE[r].en.toLowerCase()).join(" or ")}s.</p>
          <StampButton onClick={() => void signOut()} className="mt-4 min-h-12 w-full"><span className="text-[15px] font-bold">Sign out</span></StampButton>
        </Sheet>
      </div>
    );
  }
  return <div key={person.id} className="contents">{children(person)}</div>;
}
