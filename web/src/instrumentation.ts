/** Runs once when the server starts: warm the local models in the background (KHETKUNDLI_WARM=0 skips it). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.KHETKUNDLI_WARM === "0") return;
  const { warmModels } = await import("./lib/agent/warm");
  void warmModels();
}
