/**
 * Unencrypted public board snapshot so guests (and post-genesis users)
 * can browse default categories + seeded XPi topics without logging in.
 * Writes happen on setup (genesis/join) and after first encrypted-disk seed.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "../utils/config.js";
import { DEFAULT_CATEGORIES } from "./categories.js";
import { xpiTopics, communityTopics, tagStats, SEED_VERSION } from "./seed-posts.js";

function scoreTrend(post, now = Date.now()) {
  const ageHours = Math.max(1, (now - (post.createdAt || now)) / 36e5);
  return ((Number(post.views) || 0) + (Number(post.likes) || 0) * 8) / ageHours;
}

function boardPath() {
  const base = dirname(config.diskPath || "./data/network-data.disk");
  return join(base, "public-board.json");
}

export function buildDefaultBoard() {
  const posts = [...xpiTopics(), ...communityTopics()];
  const visible = posts.filter((p) => p.status !== "deleted");
  return {
    version: SEED_VERSION,
    updatedAt: Date.now(),
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    posts: visible,
    rankings: {
      topView: [...visible].sort((a, b) => b.views - a.views).slice(0, 10),
      topLike: [...visible].sort((a, b) => b.likes - a.likes).slice(0, 10),
      topTrend: [...visible].sort((a, b) => scoreTrend(b) - scoreTrend(a)).slice(0, 10),
      topTags: tagStats(visible, 15),
    },
  };
}

export function writePublicBoard(board) {
  const path = boardPath();
  mkdirSync(dirname(path), { recursive: true });
  const payload = board || buildDefaultBoard();
  writeFileSync(path, JSON.stringify(payload, null, 0), "utf8");
  return payload;
}

export function readPublicBoard() {
  const path = boardPath();
  try {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf8"));
    }
  } catch {
    /* */
  }
  // Always offer default English XPi seed for first paint
  return buildDefaultBoard();
}

/** Merge live posts into public snapshot (optional, after login save) */
export function refreshPublicBoardFromDb(db) {
  if (!db?.posts) return writePublicBoard();
  const visible = (db.posts || []).filter((p) => p.status !== "deleted" && p.status !== "hidden");
  const board = {
    version: db.seedVersion || SEED_VERSION,
    updatedAt: Date.now(),
    categories: (db.categories?.length ? db.categories : DEFAULT_CATEGORIES).map((c) => ({ ...c })),
    posts: visible,
    rankings: {
      topView: [...visible].sort((a, b) => b.views - a.views).slice(0, 10),
      topLike: [...visible].sort((a, b) => b.likes - a.likes).slice(0, 10),
      topTrend: [...visible].sort((a, b) => scoreTrend(b) - scoreTrend(a)).slice(0, 10),
      topTags: tagStats(visible, 15),
    },
  };
  writePublicBoard(board);
  return board;
}

/** Accept peer posts into the unencrypted public snapshot (guest / pre-login sync). */
export function mergeIntoPublicBoard(incomingPosts = []) {
  const board = readPublicBoard();
  const byId = new Map((board.posts || []).map((p) => [p.id, p]));
  let accepted = 0;
  for (const raw of incomingPosts.slice(0, 100)) {
    if (!raw?.id || !raw?.title) continue;
    const prev = byId.get(raw.id);
    if (!prev) {
      byId.set(raw.id, {
        ...raw,
        views: Number(raw.views || 0),
        likes: Number(raw.likes || 0),
        comments: Array.isArray(raw.comments) ? raw.comments : [],
        status: raw.status === "deleted" ? "deleted" : raw.status === "hidden" ? "hidden" : "active",
      });
      accepted += 1;
    } else {
      prev.views = Math.max(Number(prev.views || 0), Number(raw.views || 0));
      prev.likes = Math.max(Number(prev.likes || 0), Number(raw.likes || 0));
      if (Array.isArray(raw.comments) && raw.comments.length) {
        const seen = new Set((prev.comments || []).map((c) => c.id));
        if (!prev.comments) prev.comments = [];
        for (const c of raw.comments) {
          if (c?.id && !seen.has(c.id)) {
            prev.comments.push(c);
            seen.add(c.id);
          }
        }
      }
    }
  }
  const posts = [...byId.values()].filter((p) => p.status !== "deleted");
  const visible = posts.filter((p) => p.status !== "hidden");
  const now = Date.now();
  function scoreTrend(post) {
    const ageHours = Math.max(1, (now - (post.createdAt || now)) / 36e5);
    return ((Number(post.views) || 0) + (Number(post.likes) || 0) * 8) / ageHours;
  }
  const next = {
    ...board,
    updatedAt: Date.now(),
    posts: visible,
    rankings: {
      topView: [...visible].sort((a, b) => b.views - a.views).slice(0, 10),
      topLike: [...visible].sort((a, b) => b.likes - a.likes).slice(0, 10),
      topTrend: [...visible].sort((a, b) => scoreTrend(b) - scoreTrend(a)).slice(0, 10),
      topTags: board.rankings?.topTags || [],
    },
  };
  writePublicBoard(next);
  return { accepted, count: visible.length };
}
