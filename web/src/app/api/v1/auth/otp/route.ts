import { addressOf, limited, tooMany } from "@/lib/server/auth";
import { otpSink } from "@/lib/server/identity";
import { identity } from "@/lib/server/seed";

/**
 * POST { phone } → a one-time code for that number. The answer is the same for registered and
 * unregistered numbers. With the on-screen sink (no SMS sender yet) the code comes back as `devCode`
 * for a registered number; with KHETKUNDLI_OTP_SINK=sms it never does.
 */
export async function POST(req: Request) {
  const wait = limited(`otp:${addressOf(req)}`, 10, 60_000);
  if (wait) return tooMany(wait);
  const body = (await req.json().catch(() => ({}))) as { phone?: unknown };
  const r = await (await identity()).requestOtp(body.phone);
  if (!r.ok) return Response.json({ error: r.reason }, { status: r.retryAfterMs ? 429 : 400 });
  return Response.json({ sent: true, sink: otpSink(), ...(r.code ? { devCode: r.code } : {}) });
}
