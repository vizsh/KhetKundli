import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
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
 * - Until an SMS sender is registered (Phase 2), the code is shown on screen: the `screen` sink, which
 *   `/status` reports. It must be switched off (KHETKUNDLI_OTP_SINK=sms) before real farmers use it.
 */

export type Role = "farmer" | "officer" | "fpo_admin" | "buyer";
export type Person = { id: string; phone: string; name: string; nameMr: string; role: Role; plots: number[] };
export type Session = { person: Person; deviceId: string; tokenHash: string; expiresAt: string };

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_PER_WINDOW = 3;
export const OTP_WINDOW_MS = 10 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

export const otpSink = (): "screen" | "sms" => (process.env.KHETKUNDLI_OTP_SINK === "sms" ? "sms" : "screen");

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
   * Make a code for a number. Returns the code only for the on-screen sink and only for a registered
   * number; the caller shows the same answer either way.
   */
  async requestOtp(rawPhone: unknown, now = Date.now()): Promise<{ ok: true; code?: string } | { ok: false; reason: string; retryAfterMs?: number }> {
    const phone = normalizePhone(rawPhone);
    if (!phone) return { ok: false, reason: "Enter a 10-digit mobile number." };
    const recent = await this.sql.query<{ created_at: string }>("select created_at from otp_codes where phone = $1 and created_at > $2 order by created_at", [phone, new Date(now - OTP_WINDOW_MS).toISOString()]);
    if (recent.length >= OTP_MAX_PER_WINDOW) {
      await this.log("otp_rate_limited", phone, false);
      return { ok: false, reason: "Too many codes for this number. Wait a few minutes and try again.", retryAfterMs: new Date(recent[0].created_at).getTime() + OTP_WINDOW_MS - now };
    }
    const person = await this.personByPhone(phone);
    if (!person) {
      await this.log("otp_unknown_number", phone, false);
      return { ok: true };
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await this.sql.query("insert into otp_codes (phone, code_hash, created_at, expires_at) values ($1, $2, $3, $4)", [phone, await this.codeHash(phone, code), new Date(now).toISOString(), new Date(now + OTP_TTL_MS).toISOString()]);
    await this.log("otp_sent", phone, true, person.id, otpSink());
    return otpSink() === "screen" ? { ok: true, code } : { ok: true };
  }

  /** Check a code and open a session on this device. The newest unexpired code for the number counts. */
  async verifyOtp(rawPhone: unknown, rawCode: unknown, device: { label: string; userAgent: string }, now = Date.now()):
    Promise<{ ok: true; token: string; person: Person; expiresAt: string } | { ok: false; reason: string }> {
    const phone = normalizePhone(rawPhone);
    const code = typeof rawCode === "string" ? rawCode.replace(/\s/g, "") : "";
    if (!phone || !/^\d{6}$/.test(code)) return { ok: false, reason: "Enter the 6-digit code." };
    const row = (await this.sql.query<{ id: string; code_hash: string; expires_at: string; attempts: number; consumed_at: string | null }>(
      "select id, code_hash, expires_at, attempts, consumed_at from otp_codes where phone = $1 order by created_at desc, id desc limit 1",
      [phone],
    ))[0];
    const fail = async (reason: string, detail: string) => { await this.log("otp_failed", phone, false, null, detail); return { ok: false as const, reason }; };
    if (!row || row.consumed_at) return fail("Ask for a new code.", "no live code");
    if (new Date(row.expires_at).getTime() < now) return fail("That code has expired. Ask for a new one.", "expired");
    if (row.attempts >= OTP_MAX_ATTEMPTS) return fail("Too many wrong tries. Ask for a new code.", "attempts");
    await this.sql.query("update otp_codes set attempts = attempts + 1 where id = $1", [row.id]);
    const expected = Buffer.from(row.code_hash, "hex");
    const given = Buffer.from(await this.codeHash(phone, code), "hex");
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return fail("That code is not right.", "wrong code");
    const person = await this.personByPhone(phone);
    if (!person) return fail("This number is not registered.", "no person");

    const token = randomBytes(32).toString("base64url");
    const deviceId = `D${randomBytes(6).toString("hex")}`;
    const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
    await this.sql.tx(async (q) => {
      await q.query("update otp_codes set consumed_at = $2 where id = $1", [row.id, new Date(now).toISOString()]);
      await q.query("insert into devices (id, label, user_agent) values ($1, $2, $3)", [deviceId, device.label.slice(0, 80), device.userAgent.slice(0, 300)]);
      await q.query("insert into sessions (token_hash, person_id, device_id, expires_at) values ($1, $2, $3, $4)", [sha256(token), person.id, deviceId, expiresAt]);
    });
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

  async revoke(token: string) {
    const rows = await this.sql.query<{ person_id: string }>("update sessions set revoked_at = now() where token_hash = $1 and revoked_at is null returning person_id", [sha256(token)]);
    if (rows[0]) await this.sql.query("insert into auth_log (event, person_id, ok) values ('signed_out', $1, true)", [rows[0].person_id]);
  }
}
