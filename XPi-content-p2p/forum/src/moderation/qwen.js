/**
 * Community moderation for forum-p2p
 * Layer 1: Hard-block regex (multi-language, always on, <1ms)
 * Layer 2: LocalMod API (toxicity, spam, NSFW, PII) — optional, offline
 *
 * LocalMod: https://github.com/KOKOSde/localmod
 * Set LOCALMOD_URL=http://127.0.0.1:8000 to enable.
 */

import { config } from "../utils/config.js";

// ---------------------------------------------------------------------------
// Hard-block patterns (English + Vietnamese + common multi-lang)
// Keep this list focused on clear community-standard violations.
// ---------------------------------------------------------------------------
const HARD_BLOCK = [
  // NSFW / sexual (EN + VN)
  /\b(porn|porno|xxx|xvideos|xhamster|onlyfans|sex\s*video|sex\s*chat|nude\s*pic|hentai)\b/i,
  /\b(lồn|cặc|địt|đụ|buồi|vếu|dâm\s*dục|làm\s*tình|sex\s*toy|dildo)\b/i,
  /\b(đĩ|điếm|gái\s*gọi|bán\s*dâm|prostitut)/i,

  // Hate / extreme violence / terrorism
  /\b(kill\s*all|kill\s*yourself|kys\b|nazi|holocaust|white\s*power|racial\s*slur)\b/i,
  /\b(giết\s*người|đánh\s*bom|khủng\s*bố|tàn\s*sát|genocide)\b/i,
  /\b(bomb\s*making|how\s*to\s*make\s*a\s*bomb|pipe\s*bomb)\b/i,

  // Hard drugs / dealing
  /\b(drug\s*deal|buy\s*heroin|sell\s*cocaine|meth\s*lab|fentanyl)\b/i,
  /\b(mua\s*ma\s*túy|bán\s*heroin|bán\s*cần\s*sa|ma\s*túy\s*đá)\b/i,

  // Clear spam / scam patterns
  /(kiếm\s*\d+\s*(triệu|tỷ)|free\s*money|click\s*here\s*now|mua\s*ngay\s*kẻo\s*hết)/i,
  /(https?:\/\/[^\s]{40,})/i, // unusually long raw URLs often used in spam
];

/**
 * Call LocalMod /analyze endpoint.
 * Returns the full report or null if unavailable / timed out.
 */
async function callLocalMod(text) {
  const base = (config.localmodUrl || "").replace(/\/$/, "");
  if (!base) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${base}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.slice(0, 8000),
        classifiers: ["toxicity", "spam", "nsfw", "pii"],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    // LocalMod down or network error → degrade gracefully to hard-block only
    console.warn("[moderation] LocalMod unavailable:", err.message);
    return null;
  }
}

/**
 * Moderate user content before allowing a post.
 * @param {string} text  title + body combined
 * @returns {Promise<{ok: boolean, reason?: string, details?: object}>}
 */
export async function moderate(text) {
  const t = (text || "").trim();

  if (t.length < 2) {
    return { ok: false, reason: "too short" };
  }

  // Layer 1 — hard community filter (always runs)
  const hit = HARD_BLOCK.find((re) => re.test(t));
  if (hit) {
    return { ok: false, reason: "blocked by community filter" };
  }

  // Layer 2 — LocalMod (optional)
  const report = await callLocalMod(t);
  if (report?.flagged) {
    const categories = (report.results || [])
      .filter((r) => r.flagged)
      .map((r) => r.classifier)
      .join(", ");
    return {
      ok: false,
      reason: `blocked by moderation (${categories || "policy violation"})`,
      details: report,
    };
  }

  return { ok: true };
}
