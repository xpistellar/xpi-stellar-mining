import { readState, writeState } from "./disk.js";
import { getNodeDiskSecret } from "./node-disk-key.js";
import { verifyPostSignature, verifyModAction } from "../utils/sign.js";
import {
  canModerate,
  resolveRole,
  ensureRoles,
  applyRoleGrant,
  rebuildRolesFromGrants,
} from "../roles/roles.js";
import { ensureCategories } from "./categories.js";
import { ensureSeedPosts } from "./seed-posts.js";

export function loadDb(diskPath, secret) {
  const key = secret || getNodeDiskSecret();
  const state = readState(diskPath, key);
  if (!Array.isArray(state.posts)) state.posts = [];
  if (!Array.isArray(state.modActions)) state.modActions = [];
  if (!Array.isArray(state.roleGrants)) state.roleGrants = [];
  ensureRoles(state);
  ensureCategories(state);
  const seeded = ensureSeedPosts(state);
  rebuildRolesFromGrants(state);
  if (seeded) {
    try {
      writeState(diskPath, key, state);
    } catch {
      state._seedDirty = true;
    }
  }
  return state;
}

export function saveDb(diskPath, secret, state) {
  writeState(diskPath, getNodeDiskSecret(), state);
}

export function scoreTrend(post, now = Date.now()) {
  const ageHours = Math.max(1, (now - post.createdAt) / 36e5);
  return (post.views + post.likes * 8) / ageHours;
}

export function mergePost(db, incoming) {
  if (!incoming?.id || !incoming.title) return false;
  if (!verifyPostSignature(incoming)) return false;

  const existing = db.posts.find((p) => p.id === incoming.id);
  if (!existing) {
    db.posts.unshift({
      id: String(incoming.id).slice(0, 80),
      title: String(incoming.title).slice(0, 140),
      body: String(incoming.body || "").slice(0, 8000),
      author: String(incoming.author || "").slice(0, 80),
      categoryId: String(incoming.categoryId || "general").slice(0, 40),
      tags: Array.isArray(incoming.tags)
        ? incoming.tags.map((x) => String(x).slice(0, 24)).slice(0, 8)
        : [],
      sticky: Boolean(incoming.sticky),
      likes: Number(incoming.likes || 0),
      views: Number(incoming.views || 0),
      earned: String(incoming.earned || "0"),
      createdAt: Number(incoming.createdAt || Date.now()),
      claimedViews: Number(incoming.claimedViews || 0),
      status:
        incoming.status === "hidden" || incoming.status === "deleted"
          ? incoming.status
          : "active",
      signature: String(incoming.signature),
      moderatedBy: incoming.moderatedBy || null,
      moderatedAt: incoming.moderatedAt || null,
      modReason: incoming.modReason || null,
      comments: Array.isArray(incoming.comments) ? incoming.comments.slice(0, 500) : [],
    });
    return true;
  }

  if (Array.isArray(incoming.comments) && incoming.comments.length) {
    if (!Array.isArray(existing.comments)) existing.comments = [];
    const seen = new Set(existing.comments.map((c) => c.id));
    for (const c of incoming.comments) {
      if (c?.id && !seen.has(c.id)) {
        existing.comments.push(c);
        seen.add(c.id);
      }
    }
    if (existing.comments.length > 500) existing.comments = existing.comments.slice(-500);
  }

  existing.views = Math.max(existing.views, Number(incoming.views || 0));
  existing.likes = Math.max(existing.likes, Number(incoming.likes || 0));
  existing.claimedViews = Math.max(
    existing.claimedViews || 0,
    Number(incoming.claimedViews || 0)
  );
  if (!existing.categoryId && incoming.categoryId) {
    existing.categoryId = String(incoming.categoryId).slice(0, 40);
  }
  if (incoming.sticky) existing.sticky = true;
  if (Array.isArray(incoming.tags) && incoming.tags.length) {
    existing.tags = incoming.tags.map((x) => String(x).slice(0, 24)).slice(0, 8);
  }

  if (
    (incoming.status === "hidden" || incoming.status === "deleted") &&
    existing.status === "active"
  ) {
    existing.status = incoming.status;
    existing.moderatedBy = incoming.moderatedBy || existing.moderatedBy;
    existing.moderatedAt = incoming.moderatedAt || existing.moderatedAt;
    existing.modReason = incoming.modReason || existing.modReason;
  }
  return true;
}

export function applyModAction(db, action) {
  if (!action?.postId || !action?.by || !action?.type) return false;
  if (!verifyModAction(action)) return false;

  const actorRole = resolveRole(action.by, db);
  if (!canModerate(actorRole)) return false;

  const post = db.posts.find((p) => p.id === action.postId);
  if (!post) return false;

  if (action.type === "hide") post.status = "hidden";
  else if (action.type === "delete") post.status = "deleted";
  else if (action.type === "restore") post.status = "active";
  else return false;

  post.moderatedBy = action.by;
  post.moderatedAt = action.at;
  post.modReason = action.reason || null;

  if (!Array.isArray(db.modActions)) db.modActions = [];
  if (!db.modActions.some((a) => a.signature === action.signature)) {
    db.modActions.push(action);
    if (db.modActions.length > 5000) db.modActions = db.modActions.slice(-4000);
  }
  return true;
}

export function visiblePosts(db, { includeHidden = false, categoryId = null } = {}) {
  return db.posts.filter((p) => {
    if (p.status === "deleted") return false;
    if (p.status === "hidden" && !includeHidden) return false;
    if (categoryId && (p.categoryId || "general") !== categoryId) return false;
    return true;
  });
}

export function ensureBans(db) {
  if (!Array.isArray(db.bans)) db.bans = [];
  return db.bans;
}

/** Active comment ban? */
export function isCommentBanned(db, publicKey, now = Date.now()) {
  if (!publicKey) return false;
  ensureBans(db);
  return db.bans.some(
    (b) =>
      b.publicKey === publicKey &&
      b.type === "comment" &&
      Number(b.until) > now
  );
}

export function banComments7d(db, { publicKey, by, reason }) {
  ensureBans(db);
  const until = Date.now() + 7 * 24 * 60 * 60 * 1000;
  db.bans = db.bans.filter(
    (b) => !(b.publicKey === publicKey && b.type === "comment" && Number(b.until) > Date.now())
  );
  db.bans.push({
    publicKey: String(publicKey).slice(0, 80),
    type: "comment",
    until,
    by: String(by || "").slice(0, 80),
    reason: String(reason || "").slice(0, 200),
    at: Date.now(),
  });
  if (db.bans.length > 2000) db.bans = db.bans.slice(-1500);
  return db.bans.find((b) => b.publicKey === publicKey && b.type === "comment");
}

export function listActiveBans(db, now = Date.now()) {
  ensureBans(db);
  return db.bans.filter((b) => Number(b.until) > now);
}

export function unbanComments(db, publicKey) {
  ensureBans(db);
  db.bans = db.bans.filter(
    (b) => !(b.publicKey === publicKey && b.type === "comment")
  );
}
