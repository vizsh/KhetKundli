import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { otpSink } from "./mode";
import type { Sql } from "./sql";

/**
 * Who is using KhetKundli: people (farmers, officers, FPO admins), their plots, their devices and their
 * sessions, signed in with a one-time code sent to their phone number.
 *
 * - Codes are 6 digits, stored only as a keyed hash, valid for 5 minutes, 5 attempts each; at most
 *   3 codes per number in 10 minutes.
 * - Session tokens are 32 random bytes; only their sha256 is stored. They last 30 days and can be revoked.
 * - The answer to "send me a code" is the same whether or not the number is registered, so the form
 *   cannot be used to find out who is enrolled.
 * - Where the code goes is set in mode.ts: on screen (demo only), to the FPO desk for assisted
 *   sign-in, or by SMS once a sender is registered (Phase 2).
 */

export type Role = "farmer" | "officer" | "fpo_admin" | "buyer";
export type Person = { id: string; phone: string; name: string; nameMr: string; role: Role; plots: number[] };
export type Session = { person: Person; deviceId: string; tokenHash: string; expiresAt: string };

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_PER_WINDOW = 3;
export const OTP_WINDOW_MS = 10 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
/** Staff sessions are short: an office laptop left open should not stay signed in for a month. */
export const STAFF_SESSION_TTL_MS = 12 * 3600 * 1000;
export const sessionTtl = (role: Role) => (role === "officer" || role === "fpo_admin" ? STAFF_SESSION_TTL_MS : SESSION_TTL_MS);

export { otpSink };

/**
 * Codes waiting for the FPO desk to read out (the `desk` sink), in this process's memory only, gone after
 * 5 minutes or once used. A staff member's own code goes to the server log instead, for the operator.
 */
const deskCodes = new Map<string, { code: string; name: string; expires: number }>();
function deliverToDesk(phone: string, person: Person, code: string, now: number) {
  if (person.role === "officer" || person.role === "fpo_admin") {
    console.info(`[khetkundli] sign-in code for ${person.name} (…${phone.slice(-4)}): ${code}`);
    return;
  }
  deskCodes.set(phone, { code, name: person.name, expires: now + OTP_TTL_MS });
}
export function waitingCodes(now = Date.now()) {
  for (const [k, v] of deskCodes) if (v.expires < now) deskCodes.delete(k);
  return [...deskCodes].map(([phone, v]) => ({ phoneTail: phone.slice(-4), name: v.name, code: v.code, expiresInS: Math.round((v.expires - now) / 1000) }));
}

/** An Indian mobile number in one form, +91 and ten digits starting 6 to 9; null if it is not one. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/[^\d]/g, "");
  const ten = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(ten) ? `+91${ten}` : null;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const tail = (phone: string) => phone.slice(-4);

type PersonRow = { id: string; phone: string; name: string; name_mr: string; role: Role; plots: number[] | null };

export class Identity {
  private secret: Promise<string> | null = null;
  constructor(readonly sql: Sql) {}

  /** The key for code hashes: KHETKUNDLI_SECRET, or one made on first use and kept in the database. */
  private key(): Promise<string> {
    this.secret ??= (async () => {
      if (process.env.KHETKUNDLI_SECRET) return process.env.KHETKUNDLI_SECRET;
      const fresh = randomBytes(32).toString("hex");
      await this.sql.query("insert into secrets (name, value) values ('otp_key', $1) on conflict (name) do nothing", [fresh]);
      return (await this.sql.query<{ value: string }>("select value from secrets where name = 'otp_key'"))[0].value;
    })();
    return this.secret;
  }

  private async codeHash(phone: string, code: string) {
    return sha256(`${await this.key()}\n${phone}\n${code}`);
  }

  private log(event: string, phone: string, ok: boolean, personId: string | null = null, detail = "") {
    return this.sql.query("insert into auth_log (event, phone_tail, person_id, ok, detail) values ($1, $2, $3, $4, $5)", [event, tail(phone), personId, ok, detail]);
  }

  private toPerson(r: PersonRow): Person {
    return { id: r.id, phone: r.phone, name: r.name, nameMr: r.name_mr, role: r.role, plots: (r.plots ?? []).map(Number).sort((a, b) => a - b) };
  }

  async personByPhone(phone: string): Promise<Person | null> {
    const rows = await this.sql.query<PersonRow>(
      "select p.*, array_remove(array_agg(pp.plot), null) as plots from people p left join person_plots pp on pp.person_id = p.id where p.phone = $1 group by p.id",
      [phone],
    );
    return rows[0] ? this.toPerson(rows[0]) : null;
  }

  async people(): Promise<Person[]> {
    const rows = await this.sql.query<PersonRow>("select p.*, array_remove(array_agg(pp.plot), null) as plots from people p left join person_plots pp on pp.person_id = p.id group by p.id order by p.role, p.name");
    return rows.map((r) => this.toPerson(r));
  }

  /** Plot → the person who keeps its record (the owner), for plots that have one. */
  async plotOwners(): Promise<Map<number, string>> {
    const rows = await this.sql.query<{ plot: number; person_id: string }>("select plot, person_id from person_plots where relation = 'owner'");
    return new Map(rows.map((r) => [Number(r.plot), r.person_id]));
  }

  /** Register people idempotently (by phone): the demo's seed, and later the FPO's enrolment desk. */
  async upsertPerson(p: Omit<Person, "id"> & { id?: string }): Promise<Person> {
    const phone = normalizePhone(p.phone);
    if (!phone) throw new Error(`not a mobile number: ${p.phone}`);
    const id = p.id ?? `P${randomBytes(6).toString("hex")}`;
    await this.sql.tx(async (q) => {
      await q.query(
        "insert into people (id, phone, name, name_mr, role) values ($1, $2, $3, $4, $5) on conflict (phone) do update set name = excluded.name, name_mr = excluded.name_mr, role = excluded.role",
        [id, phone, p.name, p.nameMr, p.role],
      );
      const pid = (await q.query<{ id: string }>("select id from people where phone = $1", [phone]))[0].id;
      for (const plot of p.plots) await q.query("insert into person_plots (person_id, plot) values ($1, $2) on conflict do nothing", [pid, plot]);
    });
    return (await this.personByPhone(phone))!;
  }

  /**
   * Make a code for a number. The issue limit is checked and the code stored under a lock on the number,
   * so parallel requests cannot get past it. An unregistered number is answered the same way, and
   * counts towards the same limit (with a code nobody can use), so neither the answer nor the limit
   * says who is enrolled. Returns the code only for the on-screen sink (demo mode).
   */
  async requestOtp(rawPhone: unknown, now = Date.now()): Promise<{ ok: true; code?: string } | { ok: false; reason: string; retryAfterMs?: number }> {
    const phone = normalizePhone(rawPhone);
    if (!phone) return { ok: false, reason: "Enter a 10-digit mobile number." };
    const person = await this.personByPhone(phone);
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const hash = person ? await this.codeHash(phone, code) : randomBytes(32).toString("hex");
    const issued = await this.sql.tx(async (q) => {
      await q.query("select pg_advisory_xact_lock(hashtext($1))", [phone]);
      const recent = await q.query<{ created_at: string }>("select created_at from otp_codes where phone = $1 and created_at > $2 order by created_at", [phone, new Date(now - OTP_WINDOW_MS).toISOString()]);
      if (recent.length >= OTP_MAX_PER_WINDOW) return { ok: false as const, retryAfterMs: new Date(recent[0].created_at).getTime() + OTP_WINDOW_MS - now };
      await q.query("insert into otp_codes (phone, code_hash, created_at, expires_at) values ($1, $2, $3, $4)", [phone, hash, new Date(now).toISOString(), new Date(now + OTP_TTL_MS).toISOString()]);
      return { ok: true as const };
    });
    if (!issued.ok) {
      await this.log("otp_rate_limited", phone, false);
      return { ok: false, reason: "Too many codes for this number. Wait a few minutes and try again.", retryAfterMs: issued.retryAfterMs };
    }
    if (!person) {
      await this.log("otp_unknown_number", phone, false);
      return { ok: true };
    }
    const sink = otpSink();
    await this.log("otp_sent", phone, true, person.id, sink);
    if (sink === "desk") deliverToDesk(phone, person, code, now);
    return sink === "screen" ? { ok: true, code } : { ok: true };
  }

  /**
   * Check a code and open a session on this device. The newest code for the number counts. The try is
   * counted atomically before the code is compared, so parallel guesses cannot exceed the limit.
   */
  async verifyOtp(rawPhone: unknown, rawCode: unknown, device: { label: string; userAgent: string }, now = Date.now()):
    Promise<{ ok: true; token: string; person: Person; expiresAt: string } | { ok: false; reason: string }> {
    const phone = normalizePhone(rawPhone);
    const code = typeof rawCode === "string" ? rawCode.replace(/\s/g, "") : "";
    if (!phone || !/^\d{6}$/.test(code)) return { ok: false, reason: "Enter the 6-digit code." };
    const fail = async (reason: string, detail: string) => { await this.log("otp_failed", phone, false, null, detail); return { ok: false as const, reason }; };
    const latest = (await this.sql.query<{ id: string; expires_at: string; consumed_at: string | null }>(
      "select id, expires_at, consumed_at from otp_codes where phone = $1 order by created_at desc, id desc limit 1",
      [phone],
    ))[0];
    if (!latest || latest.consumed_at) return fail("Ask for a new code.", "no live code");
    if (new Date(latest.expires_at).getTime() < now) return fail("That code has expired. Ask for a new one.", "expired");
    const counted = (await this.sql.query<{ code_hash: string }>(
      "update otp_codes set attempts = attempts + 1 where id = $1 and attempts < $2 and consumed_at is null returning code_hash",
      [latest.id, OTP_MAX_ATTEMPTS],
    ))[0];
    if (!counted) return fail("Too many wrong tries. Ask for a new code.", "attempts");
    const expected = Buffer.from(counted.code_hash, "hex");
    const given = Buffer.from(await this.codeHash(phone, code), "hex");
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return fail("That code is not right.", "wrong code");
    const person = await this.personByPhone(phone);
    if (!person) return fail("This number is not registered.", "no person");

    const token = randomBytes(32).toString("base64url");
    const deviceId = `D${randomBytes(6).toString("hex")}`;
    const expiresAt = new Date(now + sessionTtl(person.role)).toISOString();
    // Consume the code exactly once: of two parallel right answers, only one opens a session.
    const won = await this.sql.tx(async (q) => {
      const used = await q.query("update otp_codes set consumed_at = $2 where id = $1 and consumed_at is null returning id", [latest.id, new Date(now).toISOString()]);
      if (!used.length) return false;
      await q.query("insert into devices (id, label, user_agent) values ($1, $2, $3)", [deviceId, device.label.slice(0, 80), device.userAgent.slice(0, 300)]);
      await q.query("insert into sessions (token_hash, person_id, device_id, expires_at) values ($1, $2, $3, $4)", [sha256(token), person.id, deviceId, expiresAt]);
      return true;
    });
    if (!won) return fail("Ask for a new code.", "already used");
    deskCodes.delete(phone);
    await this.log("signed_in", phone, true, person.id, deviceId);
    return { ok: true, token, person, expiresAt };
  }

  /** The signed-in person for a session token, or null if it is unknown, expired or revoked. */
  async session(token: string | null | undefined, now = Date.now()): Promise<Session | null> {
    if (!token || token.length > 200) return null;
    const tokenHash = sha256(token);
    const row = (await this.sql.query<{ person_id: string; device_id: string; expires_at: string; revoked_at: string | null; phone: string }>(
      "select s.person_id, s.device_id, s.expires_at, s.revoked_at, p.phone from sessions s join people p on p.id = s.person_id where s.token_hash = $1",
      [tokenHash],
    ))[0];
    if (!row || row.revoked_at || new Date(row.expires_at).getTime() < now) return null;
    const person = await this.personByPhone(row.phone);
    return person ? { person, deviceId: row.device_id, tokenHash, expiresAt: new Date(row.expires_at).toISOString() } : null;
  }

  /** Sign this person out on every device (a lost phone, a departing officer). */
  async revokeAll(personId: string) {
    const rows = await this.sql.query("update sessions set revoked_at = now() where person_id = $1 and revoked_at is null returning token_hash", [personId]);
    await this.sql.query("insert into auth_log (event, person_id, ok, detail) values ('signed_out_everywhere', $1, true, $2)", [personId, String(rows.length)]);
    return rows.length;
  }

  async revoke(token: string) {
    const rows = await this.sql.query<{ person_id: string }>("update sessions set revoked_at = now() where token_hash = $1 and revoked_at is null returning person_id", [sha256(token)]);
    if (rows[0]) await this.sql.query("insert into auth_log (event, person_id, ok) values ('signed_out', $1, true)", [rows[0].person_id]);
  }
}
