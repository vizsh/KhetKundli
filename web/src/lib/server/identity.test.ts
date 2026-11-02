import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { Identity, normalizePhone, OTP_MAX_ATTEMPTS, OTP_TTL_MS, OTP_WINDOW_MS, SESSION_TTL_MS } from "./identity";
import { MIGRATIONS } from "./schema";
import { migrate, openSql, type Sql } from "./sql";

/* Sign-in against a real (embedded) Postgres: codes, attempts, expiry, rate limits, sessions. */

let sql: Sql;
let id: Identity;
const T = Date.UTC(2026, 10, 3, 6);
const device = { label: "Test phone", userAgent: "node:test" };

before(async () => {
  sql = await openSql({ dataDir: "memory://" });
  await migrate(sql, MIGRATIONS);
  id = new Identity(sql);
  await id.upsertPerson({ phone: "+91 90000 00001", name: "Sunita Jadhav", nameMr: "सुनीता जाधव", role: "farmer", plots: [84] });
  await id.upsertPerson({ phone: "9000010001", name: "Officer", nameMr: "", role: "officer", plots: [] });
});
after(() => sql.close());

test("phone numbers are normalised; anything else is refused", () => {
  assert.equal(normalizePhone("98765 43210"), "+919876543210");
  assert.equal(normalizePhone("+91-98765-43210"), "+919876543210");
  assert.equal(normalizePhone("09876543210"), "+919876543210");
  for (const bad of ["12345", "5876543210", "+1 555 0100", "", null, 9876543210]) assert.equal(normalizePhone(bad), null, String(bad));
});

test("a code signs in once; the session is known, then revoked", async () => {
  const r = await id.requestOtp("9000000001", T);
  assert.ok(r.ok && r.code && /^\d{6}$/.test(r.code));
  const v = await id.verifyOtp("9000000001", r.ok ? r.code! : "", device, T + 1000);
  assert.ok(v.ok);
  if (!v.ok) return;
  assert.equal(v.person.name, "Sunita Jadhav");
  assert.deepEqual(v.person.plots, [84]);
  const s = await id.session(v.token, T + 2000);
  assert.equal(s?.person.role, "farmer");
  // The same code cannot be used again.
  const again = await id.verifyOtp("9000000001", r.ok ? r.code! : "", device, T + 3000);
  assert.equal(again.ok, false);
  await id.revoke(v.token);
  assert.equal(await id.session(v.token, T + 4000), null);
});

test("codes and session tokens are stored only as hashes", async () => {
  const r = await id.requestOtp("9000010001", T + OTP_WINDOW_MS * 2);
  const v = await id.verifyOtp("9000010001", r.ok ? r.code! : "", device, T + OTP_WINDOW_MS * 2 + 10);
  assert.ok(v.ok);
  const dump = JSON.stringify(await sql.query("select * from otp_codes")) + JSON.stringify(await sql.query("select * from sessions"));
  assert.ok(r.ok && !dump.includes(r.code!), "a code is stored in clear");
  assert.ok(v.ok && !dump.includes(v.token), "a token is stored in clear");
});

test("a wrong code counts; after five wrong tries even the right code is refused", async () => {
  const t0 = T + OTP_WINDOW_MS * 4;
  const r = await id.requestOtp("9000000001", t0);
  assert.ok(r.ok && r.code);
  const wrong = String((Number(r.ok ? r.code : "0") + 1) % 1_000_000).padStart(6, "0");
  for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) assert.equal((await id.verifyOtp("9000000001", wrong, device, t0 + i)).ok, false);
  const right = await id.verifyOtp("9000000001", r.ok ? r.code! : "", device, t0 + 100);
  assert.equal(right.ok, false);
  assert.match(right.ok ? "" : right.reason, /Too many wrong tries/);
});

test("an expired code is refused", async () => {
  const t0 = T + OTP_WINDOW_MS * 6;
  const r = await id.requestOtp("9000000001", t0);
  const v = await id.verifyOtp("9000000001", r.ok ? r.code! : "", device, t0 + OTP_TTL_MS + 1);
  assert.equal(v.ok, false);
  assert.match(v.ok ? "" : v.reason, /expired/);
});

test("at most three codes per number in ten minutes", async () => {
  const t0 = T + OTP_WINDOW_MS * 8;
  for (let i = 0; i < 3; i++) assert.equal((await id.requestOtp("9000010001", t0 + i)).ok, true);
  const fourth = await id.requestOtp("9000010001", t0 + 10);
  assert.equal(fourth.ok, false);
  assert.equal((await id.requestOtp("9000010001", t0 + OTP_WINDOW_MS + 10)).ok, true);
});

test("an unregistered number gets the same answer and no code", async () => {
  const r = await id.requestOtp("9876500000", T);
  assert.deepEqual(r, { ok: true });
  assert.equal((await sql.query("select * from otp_codes where phone = '+919876500000'")).length, 0);
});

test("a session ends when it expires", async () => {
  const t0 = T + OTP_WINDOW_MS * 10;
  const r = await id.requestOtp("9000000001", t0);
  const v = await id.verifyOtp("9000000001", r.ok ? r.code! : "", device, t0);
  assert.ok(v.ok);
  if (!v.ok) return;
  assert.ok(await id.session(v.token, t0 + SESSION_TTL_MS - 1000));
  assert.equal(await id.session(v.token, t0 + SESSION_TTL_MS + 1000), null);
  assert.equal(await id.session("not-a-token", t0), null);
});

test("every sign-in event is in the auth log, with only the last four digits", async () => {
  const rows = await sql.query<{ event: string; phone_tail: string }>("select event, phone_tail from auth_log");
  assert.ok(rows.some((r) => r.event === "signed_in"));
  assert.ok(rows.some((r) => r.event === "otp_failed"));
  assert.ok(rows.every((r) => r.phone_tail.length <= 4));
});
