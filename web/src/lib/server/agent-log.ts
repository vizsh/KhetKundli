import type { AgentAnswer } from "@/lib/agent/agent";
import { db } from "./db";

/** Every answer the agent gives is kept: the officer can audit it, and the questions retrain the router. */
export function logAnswer(a: AgentAnswer, plot: number, day: number): number {
  const r = db().prepare(`insert into agent_log (at, question, plot, day, audience, intent, confidence, engine, model, guard_passed, ms, answer)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(new Date().toISOString(), a.question, plot, day, a.audience, a.route.intent, a.route.confidence, a.engine, a.model, a.guard.passed ? 1 : 0, Math.round(a.ms), JSON.stringify({ headline: a.headline, steps: a.steps, why: a.why, mr: a.mr, citations: a.citations.map((c) => c.id), guard: a.guard.checks }));
  return Number(r.lastInsertRowid);
}
