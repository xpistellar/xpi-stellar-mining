const BLOCK = [
  /\bporn\b/i,
  /\bxxx\b/i,
  /\bdrug deal\b/i,
  /\bbomb making\b/i,
];

export function moderate(text) {
  const hit = BLOCK.find((re) => re.test(text || ""));
  if (hit) return { ok: false, reason: "blocked by local filter" };
  if (!text || text.trim().length < 2) return { ok: false, reason: "too short" };
  return { ok: true };
}
