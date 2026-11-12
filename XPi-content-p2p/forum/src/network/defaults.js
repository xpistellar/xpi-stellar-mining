/**
 * Official XPi Stellar Forum mesh — applied automatically on first boot
 * when no network-identity.sealed exists.
 *
 * Operators who want a private fork: delete data/network-identity.sealed
 * (and optionally the disk) then use “Create network” in the UI.
 */

export const OFFICIAL_MESH = {
  networkHash:
    process.env.DEFAULT_NETWORK_HASH ||
    "d3e678d640e50c0b8d85d2b521bf7bda0ad089e84d4d4a581d7d6b8e9811979",
  networkLabel: process.env.DEFAULT_NETWORK_LABEL || "Xpi-Stellar-Forum",
  /** Primary bootstrap (public) */
  signalingUrl:
    process.env.DEFAULT_SIGNALING_URL ||
    process.env.SIGNALING_URL ||
    "https://signal.xgoldmining.com",
  /** Optional extra bootstraps (comma-separated env DEFAULT_SIGNALING_URLS) */
  signalingUrls: (
    process.env.DEFAULT_SIGNALING_URLS ||
    process.env.SIGNALING_URLS ||
    "https://signal.xgoldmining.com"
  )
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean),
  /** Suggested node name prefix for this install */
  nodeNamePrefix: process.env.DEFAULT_NODE_NAME_PREFIX || "Xpi-Stellar-Forum",
  networkShort: (
    process.env.DEFAULT_NETWORK_HASH ||
    "d3e678d640e50c0b8d85d2b521bf7bda0ad089e84d4d4a581d7d6b8e9811979"
  ).slice(0, 12),
};

export function officialSignalingList() {
  const list = [];
  const seen = new Set();
  for (const u of [OFFICIAL_MESH.signalingUrl, ...OFFICIAL_MESH.signalingUrls]) {
    const s = String(u || "")
      .trim()
      .replace(/\/$/, "");
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    list.push(s);
  }
  return list.slice(0, 12);
}
