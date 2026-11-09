/**
 * Network identity — private mesh via shared networkHash.
 *
 * - Create network: generate hash → this node is genesis for that mesh.
 * - Join network: enter existing hash (+ bootstrap signaling URL).
 *
 * networkHash is membership filter (who may sync).
 * Signaling URL is discovery bootstrap (how peers find each other).
 * Genesis is NOT a permanent central database — only founder role + default bootstrap hint.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "../utils/config.js";

function integrityKey() {
  const raw =
    process.env.NODE_INTEGRITY_SECRET ||
    `forum-p2p|${config.diskPath || "default"}|net-v1`;
  return createHash("sha256").update(raw).digest();
}

function networkPath() {
  const base = dirname(config.diskPath || "./data/network-data.disk");
  return join(base, "network-identity.sealed");
}

function seal(obj) {
  const body = JSON.stringify(obj);
  const mac = createHmac("sha256", integrityKey()).update(body).digest("hex");
  return { v: 1, body, mac };
}

function open(sealed) {
  if (!sealed?.body || !sealed?.mac) return null;
  const expect = createHmac("sha256", integrityKey()).update(sealed.body).digest("hex");
  try {
    const a = Buffer.from(expect, "hex");
    const b = Buffer.from(sealed.mac, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return JSON.parse(sealed.body);
  } catch {
    return null;
  }
}

export function readNetworkIdentity() {
  const path = networkPath();
  try {
    if (!existsSync(path)) return null;
    return open(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return null;
  }
}

export function writeNetworkIdentity(identity) {
  const path = networkPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(seal(identity)), { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* win */
  }
}

export function isSetupComplete() {
  const id = readNetworkIdentity();
  return Boolean(id?.networkHash && id?.nodeName);
}

/** Human-readable + machine hash for a new private network */
export function generateNetworkHash(seedText = "") {
  const salt = randomBytes(16).toString("hex");
  const material = `${seedText || "forum-p2p"}|${salt}|${Date.now()}`;
  const hash = createHash("sha256").update(material).digest("hex");
  // short display form + full hash
  return {
    networkHash: hash,
    networkShort: hash.slice(0, 12),
    salt,
  };
}

/**
 * @param {"create"|"join"} mode
 */
export function completeSetup({
  mode,
  nodeName,
  networkHash,
  networkLabel,
  signalingUrl,
  founderPublicKey,
}) {
  const name = String(nodeName || "").trim().slice(0, 64) || `node-${randomBytes(3).toString("hex")}`;
  let hash = String(networkHash || "").trim().toLowerCase();
  let short = hash.slice(0, 12);
  let genesis = false;

  if (mode === "create") {
    if (!hash || hash.length < 16) {
      const gen = generateNetworkHash(networkLabel || name);
      hash = gen.networkHash;
      short = gen.networkShort;
    }
    genesis = true;
  } else {
    if (!hash || hash.length < 12) {
      throw Object.assign(new Error("networkHash required to join"), { status: 400 });
    }
    // accept short or full
    if (hash.length === 12) {
      // store short-only join — full hash preferred
      short = hash;
    } else {
      short = hash.slice(0, 12);
    }
    genesis = false;
  }

  const primarySignal = String(signalingUrl || config.signalingUrl || "http://127.0.0.1:4000").replace(
    /\/$/,
    ""
  );
  const identity = {
    version: 2,
    mode,
    genesis,
    nodeName: name,
    networkHash: hash,
    networkShort: short,
    networkLabel: String(networkLabel || "").slice(0, 80) || (genesis ? "Private mesh" : "Joined mesh"),
    signalingUrl: primarySignal,
    /** Multi-signal bootstrap list (primary first). Client tries in order. */
    signalingUrls: [primarySignal],
    founderPublicKey: founderPublicKey || null,
    createdAt: Date.now(),
  };
  writeNetworkIdentity(identity);
  return identity;
}

/** Normalize URL list — unique, no trailing slash, max 12 */
export function normalizeSignalingList(urls, primary) {
  const out = [];
  const seen = new Set();
  const push = (u) => {
    const s = String(u || "")
      .trim()
      .replace(/\/$/, "");
    if (!s || s.length > 300) return;
    const key = s.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };
  push(primary);
  for (const u of urls || []) push(u);
  return out.slice(0, 12);
}

/**
 * Admin updates multi-signaling list. Primary = first entry.
 * @returns {object} updated identity
 */
export function updateSignalingUrls(urls) {
  const id = readNetworkIdentity();
  if (!id?.networkHash) {
    throw Object.assign(new Error("setup not complete"), { status: 400 });
  }
  const list = normalizeSignalingList(urls, urls?.[0]);
  if (!list.length) {
    throw Object.assign(new Error("at least one signaling URL required"), { status: 400 });
  }
  id.signalingUrl = list[0];
  id.signalingUrls = list;
  id.updatedAt = Date.now();
  writeNetworkIdentity(id);
  return id;
}

export function getSignalingList() {
  const id = readNetworkIdentity();
  if (!id) {
    const fallback = config.signalingUrl || "http://127.0.0.1:4000";
    const fromEnv = (config.signalingUrls || []).length
      ? config.signalingUrls
      : [fallback];
    return normalizeSignalingList(fromEnv, fallback);
  }
  return normalizeSignalingList(id.signalingUrls || [], id.signalingUrl);
}

export function publicNetworkInfo() {
  const id = readNetworkIdentity();
  if (!id) {
    return { setupRequired: true };
  }
  const signals = normalizeSignalingList(id.signalingUrls || [], id.signalingUrl);
  return {
    setupRequired: false,
    nodeName: id.nodeName,
    networkShort: id.networkShort,
    networkHash: id.networkHash,
    networkLabel: id.networkLabel,
    genesis: id.genesis,
    signalingUrl: signals[0] || id.signalingUrl,
    signalingUrls: signals,
    // full hash only shown after setup on this node — joiners need it shared out-of-band
  };
}

export function sameNetwork(remoteHash) {
  const id = readNetworkIdentity();
  if (!id?.networkHash) return false;
  const r = String(remoteHash || "").trim().toLowerCase();
  if (!r) return false;
  return (
    r === id.networkHash ||
    r === id.networkShort ||
    id.networkHash.startsWith(r) ||
    r.startsWith(id.networkShort)
  );
}


/**
 * Hard-fork: keep local encrypted disk/posts, switch to a NEW mesh identity.
 * Once forked, this node leaves the previous hash forever (cannot auto-rejoin).
 */
export function hardForkMesh({
  networkLabel,
  signalingUrl,
  signalingUrls,
  networkHash,
  nodeName,
  founderPublicKey,
  previousHash,
} = {}) {
  const prev = readNetworkIdentity();
  const prevHash = previousHash || prev?.networkHash || null;
  const name =
    String(nodeName || prev?.nodeName || "").trim().slice(0, 64) ||
    `fork-${randomBytes(3).toString("hex")}`;

  let hash = String(networkHash || "").trim().toLowerCase();
  let short;
  if (!hash || hash.length < 16) {
    const gen = generateNetworkHash(
      networkLabel || name || `fork-${Date.now()}`
    );
    hash = gen.networkHash;
    short = gen.networkShort;
  } else {
    short = hash.slice(0, 12);
  }

  if (prevHash && hash === prevHash) {
    throw Object.assign(
      new Error("Hard fork requires a different networkHash than the current mesh"),
      { status: 400 }
    );
  }

  const primary = String(
    signalingUrl ||
      (Array.isArray(signalingUrls) && signalingUrls[0]) ||
      "https://signal.xgoldmining.com"
  ).replace(/\/$/, "");
  const list = normalizeSignalingList(
    signalingUrls?.length ? signalingUrls : [primary],
    primary
  );

  const identity = {
    version: 3,
    mode: "create",
    genesis: true,
    hardFork: true,
    forkedAt: Date.now(),
    forkedFromHash: prevHash,
    forkedFromLabel: prev?.networkLabel || null,
    rejoinOriginalBlocked: true,
    nodeName: name,
    networkHash: hash,
    networkShort: short,
    networkLabel: String(networkLabel || "").slice(0, 80) || "Forked mesh",
    signalingUrl: list[0],
    signalingUrls: list,
    founderPublicKey: founderPublicKey || prev?.founderPublicKey || null,
    createdAt: Date.now(),
  };
  writeNetworkIdentity(identity);
  return identity;
}
