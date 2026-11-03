import { clientAddress, limited, readJson, tooMany } from "@/lib/server/auth";
import { mode, otpSink } from "@/lib/server/mode";
import { identity } from "@/lib/server/seed";

/**
 * POST { phone } → a one-time code for that number. The answer is the same for registered and
 * unregistered numbers. With the on-screen sink (no SMS sender yet) the code comes back as `devCode`
 * for a registered number; with KHETKUNDLI_OTP_SINK=sms it never does.
 */
export async function POST(req: Request) {
  const wait = limited(`otp:${clientAddress(req)}`, 60, 60_000);
  if (wait) return tooMany(wait);
  const read = await readJson(req, 2048);
  if (!read.ok) return read.response;
  const body = read.body as { phone?: unknown };
  const r = await (await identity()).requestOtp(body.phone);
  if (!r.ok) return Response.json({ error: r.reason }, { status: r.retryAfterMs ? 429 : 400 });
  // A code on screen only ever in demo mode (otpSink refuses `screen` in pilot; this is the second lock).
  return Response.json({ sent: true, sink: otpSink(), ...(r.code && mode() === "demo" ? { devCode: r.code } : {}) });
}
