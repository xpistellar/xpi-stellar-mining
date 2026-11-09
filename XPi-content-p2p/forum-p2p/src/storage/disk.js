import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { closeSync, existsSync, ftruncateSync, mkdirSync, openSync, readSync, statSync, writeSync } from "node:fs";
import { dirname } from "node:path";

const ALGO = "aes-256-gcm";
const MAGIC = Buffer.from("FP2P");
const HEADER = 8;

function keyFrom(secret) {
  return scryptSync(secret || "local-dev-key", "forum-p2p-salt", 32);
}

export function gbToBytes(gb) {
  const n = Number(gb);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n * 1024 * 1024 * 1024);
}

function encrypt(secret, state) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyFrom(secret), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(state), "utf8"), cipher.final()]);
  const payload = Buffer.concat([iv, cipher.getAuthTag(), body]);
  const head = Buffer.alloc(HEADER);
  MAGIC.copy(head, 0);
  head.writeUInt32BE(payload.length, 4);
  return Buffer.concat([head, payload]);
}

function readPayload(diskPath) {
  const fd = openSync(diskPath, "r");
  try {
    const head = Buffer.alloc(HEADER);
    if (readSync(fd, head, 0, HEADER, 0) < HEADER) return null;
    if (!head.subarray(0, 4).equals(MAGIC)) return null;
    const len = head.readUInt32BE(4);
    if (len < 28 || len > 32 * 1024 * 1024) return null;
    const payload = Buffer.alloc(len);
    readSync(fd, payload, 0, len, HEADER);
    return payload;
  } finally {
    closeSync(fd);
  }
}

export function ensureDisk(diskPath, secret, gb = 0) {
  mkdirSync(dirname(diskPath), { recursive: true });
  if (!existsSync(diskPath)) {
    writeState(diskPath, secret, { posts: [], stake: null });
  }
  const target = gbToBytes(gb);
  if (target > 0 && statSync(diskPath).size < target) {
    const fd = openSync(diskPath, "r+");
    try {
      ftruncateSync(fd, target);
    } finally {
      closeSync(fd);
    }
  }
}

export function readState(diskPath, secret) {
  ensureDisk(diskPath, secret);
  const payload = readPayload(diskPath);
  if (!payload) return { posts: [], stake: null };
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const data = payload.subarray(28);
  try {
    const decipher = createDecipheriv(ALGO, keyFrom(secret), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    return JSON.parse(json);
  } catch (err) {
    const msg = String(err?.message || err);
    // Node crypto AES-GCM: "Unsupported state or unable to authenticate data"
    if (/authenticate|Unsupported state|auth/i.test(msg)) {
      const e = new Error(
        "Cannot decrypt node disk with the current node key (NODE_DISK_SECRET or data/node-disk.key). " +
          "This is independent of your Stellar wallet. Path: " + diskPath
      );
      e.status = 401;
      e.code = "DISK_AUTH_FAIL";
      throw e;
    }
    throw err;
  }
}

/** Wipe encrypted disk contents (node key). Does not change wallet identity. */
export function resetDiskData(diskPath, secret) {
  mkdirSync(dirname(diskPath), { recursive: true });
  // Prefer explicit secret; callers should pass getNodeDiskSecret()
  writeState(diskPath, secret, { posts: [], stake: null, modActions: [], roleGrants: [], categories: [] });
  return diskInfo(diskPath);
}

export function writeState(diskPath, secret, state) {
  mkdirSync(dirname(diskPath), { recursive: true });
  const blob = encrypt(secret, state);
  const size = existsSync(diskPath) ? statSync(diskPath).size : 0;
  const fd = openSync(diskPath, existsSync(diskPath) ? "r+" : "w+");
  try {
    const keep = Math.max(size, blob.length);
    ftruncateSync(fd, keep);
    writeSync(fd, blob, 0, blob.length, 0);
  } finally {
    closeSync(fd);
  }
}

export function diskInfo(diskPath) {
  if (!existsSync(diskPath)) return { path: diskPath, bytes: 0, gb: 0 };
  const bytes = statSync(diskPath).size;
  return { path: diskPath, bytes, gb: Number((bytes / 1024 / 1024 / 1024).toFixed(2)) };
}
