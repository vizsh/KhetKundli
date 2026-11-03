/**
 * Demo or pilot. One setting, read on the server, decides what a deployment may do.
 *
 * - `demo` (the default, for the hackathon laptop): the demo people are seeded and listed on the
 *   sign-in sheet, sign-in codes are shown on screen, and the demo controls (rain, a scan from the desk,
 *   Reset) work.
 * - `pilot` (KHETKUNDLI_MODE=pilot, for real farmers): none of that. No people list, no codes on screen,
 *   no seeding, no demo controls, no Reset. Sign-in codes go by SMS once a sender is registered, or to
 *   the FPO desk for assisted sign-in. The first FPO admin comes from KHETKUNDLI_BOOTSTRAP_ADMIN.
 */
export type Mode = "demo" | "pilot";
export const mode = (): Mode => (process.env.KHETKUNDLI_MODE === "pilot" ? "pilot" : "demo");
export const isPilot = () => mode() === "pilot";

/**
 * Where a sign-in code goes.
 * - `screen`: back in the response, for the demo only (refused in pilot mode).
 * - `desk`: shown to signed-in FPO staff on /status, who read it to the farmer sitting with them.
 *   A staff member's own code is written to the server log, which only the operator sees.
 * - `sms`: by a registered SMS sender (Phase 2; until then nothing is sent).
 */
export type Sink = "screen" | "desk" | "sms";
export function otpSink(): Sink {
  const want = process.env.KHETKUNDLI_OTP_SINK;
  if (want === "sms") return "sms";
  if (want === "desk") return "desk";
  return isPilot() ? "desk" : "screen";
}
