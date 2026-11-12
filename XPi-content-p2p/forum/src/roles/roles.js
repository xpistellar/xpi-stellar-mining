/**
 * Roles — privilege is enforced server-side via Stellar signatures.
 * node-meta is HMAC-sealed so casual file edits are rejected.
 * Super-admin pubkeys are not stored as a plain list (still recoverable by REA).
 */

import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "../utils/config.js";
import { verifyRoleGrant } from "../utils/sign.js";

// Split/encoded — not security against REA, just avoids a trivial one-line edit
const _sa = [
  "GA3KOPD7STE5SJTESS2WFLFZJNST6NCJOAB7GQYGLVT6DWNOTQWTOBET",
  "GAGVNFDXVOQ2ISMFHDEIKUQKSUCFEW5VQGNOLEAWEWC27ZIXMQVBYH55",
  "GA5UO7CULJMXRXSENPNGA6HZYMSO6RZABDHVXVYNY5OJKQCRO3RFH5V6",
].map((s) => Buffer.from(s, "utf8").toString("base64"));

function decodeSa() {
  return new Set(_sa.map((b) => Buffer.from(b, "base64").toString("utf8")));
}

export const SUPER_ADMINS = decodeSa();

const ROLE_RANK = { user: 0, moderator: 1, admin: 2, super_admin: 3 };

function integrityKey() {
  // Prefer explicit env; else derive from disk path + fixed app salt (node-local)
  const raw =
    process.env.NODE_INTEGRITY_SECRET ||
    `forum-p2p|${config.diskPath || "default"}|v1`;
  return createHash("sha256").update(raw).digest();
}

function sealMeta(meta) {
  const body = JSON.stringify({
    adminPublicKey: meta.adminPublicKey || null,
    createdAt: meta.createdAt || null,
    claimedAt: meta.claimedAt || null,
    role: meta.role || null,
    /** public (default genesis) | private (password gate) */
    accessMode: meta.accessMode === "private" ? "private" : "public",
    /** scrypt/sha256 hash of view password — never store plaintext */
    accessPasswordHash: meta.accessPasswordHash || null,
    accessUpdatedAt: meta.accessUpdatedAt || null,
  });
  const mac = createHmac("sha256", integrityKey()).update(body).digest("hex");
  return { v: 2, body, mac };
}

function openMeta(sealed) {
  if (!sealed || typeof sealed.body !== "string" || typeof sealed.mac !== "string") {
    return { adminPublicKey: null, createdAt: null };
  }
  const expect = createHmac("sha256", integrityKey()).update(sealed.body).digest("hex");
  try {
    const a = Buffer.from(expect, "hex");
    const b = Buffer.from(sealed.mac, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      console.warn("[roles] node-meta integrity check failed — ignoring tampered file");
      return { adminPublicKey: null, createdAt: null };
    }
  } catch {
    return { adminPublicKey: null, createdAt: null };
  }
  try {
    return JSON.parse(sealed.body);
  } catch {
    return { adminPublicKey: null, createdAt: null };
  }
}

function metaPath() {
  const base = dirname(config.diskPath || "./data/network-data.disk");
  return join(base, "node-meta.sealed");
}

export function readNodeMeta() {
  const path = metaPath();
  // migrate plain json if present
  const legacy = join(dirname(path), "node-meta.json");
  try {
    if (existsSync(path)) {
      return openMeta(JSON.parse(readFileSync(path, "utf8")));
    }
    if (existsSync(legacy)) {
      const plain = JSON.parse(readFileSync(legacy, "utf8"));
      writeNodeMeta(plain);
      return plain;
    }
  } catch {
    /* */
  }
  return { adminPublicKey: null, createdAt: null };
}

export function writeNodeMeta(meta) {
  const path = metaPath();
  mkdirSync(dirname(path), { recursive: true });
  const sealed = sealMeta(meta);
  writeFileSync(path, JSON.stringify(sealed), { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* windows */
  }
}

export function claimAdminIfEmpty(publicKey) {
  if (!publicKey) return;
  // Super admins do not claim node-operator slot (they already have network power)
  if (SUPER_ADMINS.has(publicKey)) return;
  const meta = readNodeMeta();
  if (meta.adminPublicKey) return;
  writeNodeMeta({
    adminPublicKey: publicKey,
    createdAt: Date.now(),
    claimedAt: Date.now(),
    role: "node_owner",
  });
}

/** Explicit claim by signed-in user — fails if already claimed by someone else */
export function claimNodeOwner(publicKey) {
  if (!publicKey) {
    const e = new Error("Sign in required");
    e.status = 401;
    throw e;
  }
  const meta = readNodeMeta();
  if (meta.adminPublicKey && meta.adminPublicKey !== publicKey) {
    const e = new Error(
      `This node is already claimed by ${meta.adminPublicKey.slice(0, 6)}…${meta.adminPublicKey.slice(-4)}`
    );
    e.status = 409;
    e.code = "NODE_CLAIMED";
    throw e;
  }
  if (meta.adminPublicKey === publicKey) {
    return { ...meta, alreadyOwner: true };
  }
  const next = {
    adminPublicKey: publicKey,
    createdAt: meta.createdAt || Date.now(),
    claimedAt: Date.now(),
    role: "node_owner",
  };
  writeNodeMeta(next);
  return { ...next, alreadyOwner: false };
}

export function hashAccessPassword(password) {
  const p = String(password || "");
  if (p.length < 4) {
    const e = new Error("Password must be at least 4 characters");
    e.status = 400;
    throw e;
  }
  return createHash("sha256")
    .update(`forum-p2p-access-v1:${p}`)
    .digest("hex");
}

export function verifyAccessPassword(password, hash) {
  if (!hash) return false;
  const got = hashAccessPassword(password);
  try {
    const a = Buffer.from(got, "hex");
    const b = Buffer.from(String(hash), "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Public by default (genesis). Private requires password to view forum APIs. */
export function getAccessConfig() {
  const meta = readNodeMeta();
  const mode = meta.accessMode === "private" ? "private" : "public";
  return {
    mode,
    hasPassword: Boolean(meta.accessPasswordHash),
    updatedAt: meta.accessUpdatedAt || null,
  };
}

export function setAccessConfig({ mode, password, clearPassword }, actorPublicKey) {
  const meta = readNodeMeta();
  if (!actorPublicKey) {
    const e = new Error("Sign in required");
    e.status = 401;
    throw e;
  }
  const isOwner = meta.adminPublicKey && meta.adminPublicKey === actorPublicKey;
  const isSuper = SUPER_ADMINS.has(actorPublicKey);
  if (!isOwner && !isSuper) {
    const e = new Error("Only node owner or super_admin can change public/private access");
    e.status = 403;
    throw e;
  }
  const next = { ...meta };
  if (mode === "private" || mode === "public") next.accessMode = mode;
  if (clearPassword) next.accessPasswordHash = null;
  if (password != null && String(password).length) {
    next.accessPasswordHash = hashAccessPassword(password);
  }
  if (next.accessMode === "private" && !next.accessPasswordHash) {
    const e = new Error("Private mode requires a password");
    e.status = 400;
    throw e;
  }
  next.accessUpdatedAt = Date.now();
  writeNodeMeta(next);
  return getAccessConfig();
}

export function getNodeOwnerInfo() {
  const meta = readNodeMeta();
  return {
    claimed: Boolean(meta.adminPublicKey),
    ownerPublicKey: meta.adminPublicKey || null,
    claimedAt: meta.claimedAt || meta.createdAt || null,
  };
}

export function ensureRoles(db) {
  if (!db.roles || typeof db.roles !== "object") db.roles = {};
  if (!Array.isArray(db.roleGrants)) db.roleGrants = [];
  return db.roles;
}

export function rebuildRolesFromGrants(db) {
  ensureRoles(db);
  const map = {};
  const grants = [...(db.roleGrants || [])].sort((a, b) => (a.at || 0) - (b.at || 0));
  for (const g of grants) {
    if (!verifyRoleGrant(g)) continue;
    const signerIsSuper = SUPER_ADMINS.has(g.by);
    const meta = readNodeMeta();
    const signerIsLocalAdmin = meta.adminPublicKey && g.by === meta.adminPublicKey;
    if (!signerIsSuper && !signerIsLocalAdmin) continue;
    if (SUPER_ADMINS.has(g.address)) continue;
    if (g.op === "grant" && g.role === "moderator") map[g.address] = "moderator";
    else if (g.op === "revoke") delete map[g.address];
  }
  db.roles = map;
  return map;
}

export function applyRoleGrant(db, grant) {
  if (!grant?.address || !grant?.by || !grant?.op) return false;
  if (!verifyRoleGrant(grant)) return false;
  const signerIsSuper = SUPER_ADMINS.has(grant.by);
  const meta = readNodeMeta();
  const signerIsLocalAdmin = meta.adminPublicKey && grant.by === meta.adminPublicKey;
  if (!signerIsSuper && !signerIsLocalAdmin) return false;
  if (!Array.isArray(db.roleGrants)) db.roleGrants = [];
  if (db.roleGrants.some((g) => g.signature === grant.signature)) {
    rebuildRolesFromGrants(db);
    return true;
  }
  db.roleGrants.push(grant);
  if (db.roleGrants.length > 2000) db.roleGrants = db.roleGrants.slice(-1500);
  rebuildRolesFromGrants(db);
  return true;
}

export function resolveRole(publicKey, db) {
  if (!publicKey) return "user";
  if (SUPER_ADMINS.has(publicKey)) return "super_admin";
  const meta = readNodeMeta();
  if (meta.adminPublicKey === publicKey) return "admin";
  ensureRoles(db);
  if (db.roleGrants?.length) rebuildRolesFromGrants(db);
  if (db.roles[publicKey] === "moderator") return "moderator";
  return "user";
}

export function rank(role) {
  return ROLE_RANK[role] ?? 0;
}
/**
 * Network-wide moderation (hide/delete posts, ban): moderator OR super_admin only.
 * Node "admin" (first login / genesis operator on this machine) does NOT moderate the whole mesh.
 */
export function canModerate(role) {
  return role === "moderator" || role === "super_admin";
}
/** Only super_admin may appoint/revoke moderators network-wide */
export function canAppointMod(role) {
  return role === "super_admin";
}
/** Category tree: super_admin network-wide; node admin may manage categories on their node only */
export function canManageCategories(role) {
  return role === "super_admin" || role === "admin";
}
/** claim_node UI + local faucet: node operator (admin) or super_admin */
export function canClaimNode(role) {
  return role === "admin" || role === "super_admin";
}


export function listStaff(db) {
  ensureRoles(db);
  rebuildRolesFromGrants(db);
  const meta = readNodeMeta();
  const staff = [];
  for (const pk of SUPER_ADMINS) {
    staff.push({ publicKey: pk, role: "super_admin", scope: "network" });
  }
  if (meta.adminPublicKey && !SUPER_ADMINS.has(meta.adminPublicKey)) {
    staff.push({ publicKey: meta.adminPublicKey, role: "admin", scope: "node" });
  }
  for (const [pk, role] of Object.entries(db.roles || {})) {
    if (role !== "moderator") continue;
    if (SUPER_ADMINS.has(pk) || pk === meta.adminPublicKey) continue;
    const grants = (db.roleGrants || []).filter((g) => g.address === pk);
    const last = grants.sort((a, b) => (a.at || 0) - (b.at || 0)).at(-1);
    const scope = last && SUPER_ADMINS.has(last.by) ? "network" : "node";
    staff.push({
      publicKey: pk,
      role: "moderator",
      scope,
      appointedBy: last?.by || null,
      appointedAt: last?.at || null,
    });
  }
  return staff;
}

export function listNetworkModerators(db) {
  return listStaff(db).filter((s) => s.role === "moderator");
}
