import { readState, writeState } from "./disk.js";

export function loadDb(diskPath, secret) {
  const state = readState(diskPath, secret);
  if (!Array.isArray(state.posts)) state.posts = [];
  return state;
}

export function saveDb(diskPath, secret, state) {
  writeState(diskPath, secret, state);
}

export function scoreTrend(post, now = Date.now()) {
  const ageHours = Math.max(1, (now - post.createdAt) / 36e5);
  return (post.views + post.likes * 8) / ageHours;
}

export function mergePost(db, incoming) {
  if (!incoming?.id || !incoming.title) return false;
  const existing = db.posts.find((p) => p.id === incoming.id);
  if (!existing) {
    db.posts.unshift({
      id: String(incoming.id).slice(0, 80),
      title: String(incoming.title).slice(0, 140),
      body: String(incoming.body || "").slice(0, 8000),
      author: String(incoming.author || "peer").slice(0, 80),
      likes: Number(incoming.likes || 0),
      views: Number(incoming.views || 0),
      earned: String(incoming.earned || "0"),
      createdAt: Number(incoming.createdAt || Date.now()),
      claimedViews: Number(incoming.claimedViews || 0),
    });
    return true;
  }
  existing.views = Math.max(existing.views, Number(incoming.views || 0));
  existing.likes = Math.max(existing.likes, Number(incoming.likes || 0));
  existing.claimedViews = Math.max(existing.claimedViews || 0, Number(incoming.claimedViews || 0));
  return true;
}
