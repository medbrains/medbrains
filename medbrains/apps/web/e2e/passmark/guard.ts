/**
 * Passmark specs make paid, non-deterministic external-LLM calls, so they must never run in the
 * normal test gate. A spec is enabled only when explicitly opted in AND an Anthropic key is present.
 * See ./README.md — synthetic / de-identified data only, never real PHI.
 */
export function passmarkEnabled(): boolean {
  return process.env.PASSMARK_ENABLED === "1" && !!process.env.ANTHROPIC_API_KEY;
}

export const PASSMARK_SKIP_REASON =
  "passmark disabled — set PASSMARK_ENABLED=1 + ANTHROPIC_API_KEY (synthetic data only)";
