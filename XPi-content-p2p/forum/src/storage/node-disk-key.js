/**
 * Node-local disk encryption key — NOT the user's Stellar secret.
 * Any Stellar wallet can sign in; the encrypted disk is shared on this node.
 * Key is random (persisted) or derived from NODE_INTEGRITY_SECRET.
 */
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "../utils/config.js";

function keyFilePath() {
  const base = dirname(config.diskPath || "./data/network-data.disk");
  return join(base, "node-disk.key");
}

function deriveFromEnv(secret) {
  return createHash("sha256")
    .update(`forum-p2p-disk-v1:${secret}`)
    .digest("hex");
}

/**
 * Stable secret string used as AES material for network-data.disk
 */
export function getNodeDiskSecret() {
  const env = process.env.NODE_DISK_SECRET || process.env.NODE_INTEGRITY_SECRET || "";
  if (env && env.length >= 16) {
    return deriveFromEnv(env);
  }
  const path = keyFilePath();
  try {
    if (existsSync(path)) {
      const raw = readFileSync(path, "utf8").trim();
      if (raw.length >= 32) return raw;
    }
  } catch {
    /* */
  }
  const generated = randomBytes(32).toString("hex");
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, generated, { encoding: "utf8", mode: 0o600 });
    try {
      chmodSync(path, 0o600);
    } catch {
      /* */
    }
  } catch {
    /* memory-only fallback for this process */
  }
  return generated;
}

/** Wipe disk + rotate node key (optional hard reset) */
export function rotateNodeDiskSecret() {
  const path = keyFilePath();
  const generated = randomBytes(32).toString("hex");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, generated, { encoding: "utf8", mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* */
  }
  return generated;
}
