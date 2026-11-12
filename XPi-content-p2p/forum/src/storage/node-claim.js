
/**
 * Local node-operator claim ledger (until Soroban exposes claim_node).
 * Eligibility: stake snapshot says canRunNode, held continuously >= 48h, 1 claim / 24h.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "../utils/config.js";
import { NODE_CLAIM_XPI, NODE_ELIGIBLE_HOURS } from "../stellar/stake.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const ELIGIBLE_MS = (NODE_ELIGIBLE_HOURS || 48) * 60 * 60 * 1000;

function pathFor() {
  const base = dirname(config.diskPath || "./data/network-data.disk");
  return join(base, "node-claim.json");
}

export function readNodeClaim() {
  try {
    if (existsSync(pathFor())) return JSON.parse(readFileSync(pathFor(), "utf8"));
  } catch { /* */ }
  return { byKey: {} };
}

function writeNodeClaim(data) {
  const p = pathFor();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 0), "utf8");
}

/**
 * Update eligibility clock for publicKey.
 * If currently eligible (canRunNode), start or keep eligibleSince; else reset.
 */
export function touchEligibility(publicKey, canRunNode, now = Date.now()) {
  if (!publicKey) return null;
  const data = readNodeClaim();
  if (!data.byKey) data.byKey = {};
  let row = data.byKey[publicKey] || { eligibleSince: null, lastClaimAt: null, totalClaimed: "0" };
  if (canRunNode) {
    if (!row.eligibleSince) row.eligibleSince = now;
  } else {
    row.eligibleSince = null;
  }
  data.byKey[publicKey] = row;
  writeNodeClaim(data);
  return row;
}

export function nodeClaimStatus(publicKey, canRunNode, now = Date.now()) {
  const row = touchEligibility(publicKey, canRunNode, now) || {};
  const since = row.eligibleSince ? Number(row.eligibleSince) : null;
  const hoursHeld = since ? (now - since) / 36e5 : 0;
  const ready48h = Boolean(since && now - since >= ELIGIBLE_MS);
  const last = row.lastClaimAt ? Number(row.lastClaimAt) : 0;
  const nextClaimAt = last ? last + DAY_MS : null;
  const canClaimNow = Boolean(canRunNode && ready48h && (!last || now >= last + DAY_MS));
  return {
    eligibleSince: since,
    hoursHeld: Math.floor(hoursHeld * 10) / 10,
    needHours: NODE_ELIGIBLE_HOURS || 48,
    ready48h,
    lastClaimAt: last || null,
    nextClaimAt,
    canClaimNow,
    rewardXpi: NODE_CLAIM_XPI || "0.0000031",
    rewardLamports: 31,
    totalClaimed: row.totalClaimed || "0",
    note:
      "On-chain claim_node via Content contract (requires ≥0.0314 XPi staked on Staking + 24h cooldown). Local ledger is display cache only.",
  };
}

export function recordNodeClaim(publicKey, now = Date.now()) {
  const data = readNodeClaim();
  if (!data.byKey) data.byKey = {};
  const row = data.byKey[publicKey] || { eligibleSince: now, lastClaimAt: null, totalClaimed: "0" };
  row.lastClaimAt = now;
  // accumulate display total
  try {
    const prev = Number(row.totalClaimed || 0);
    row.totalClaimed = String(prev + Number(NODE_CLAIM_XPI || 0.0000031));
  } catch {
    row.totalClaimed = NODE_CLAIM_XPI;
  }
  data.byKey[publicKey] = row;
  writeNodeClaim(data);
  return nodeClaimStatus(publicKey, true, now);
}
