import { randomUUID } from "node:crypto";
import { config, signalingWsUrl } from "../utils/config.js";
import { loadDb, saveDb, scoreTrend, mergePost } from "../storage/db.js";
import { diskInfo, ensureDisk } from "../storage/disk.js";
import { moderate } from "../moderation/qwen.js";
import { stakeSnapshot } from "../stellar/stake.js";
import { dailyReward } from "../stellar/claim.js";
import {
  canAfford,
  claimReward,
  keypairFrom,
  readOnChain,
  stakeXlm,
  unstakeXlm,
} from "../stellar/chain.js";

export function mountRoutes(app, ctx) {
  const secret = () => ctx.session.diskKey || "local-dev-key";

  function state() {
    return loadDb(config.diskPath, secret());
  }

  function persist(next) {
    saveDb(config.diskPath, secret(), next);
  }

  function requireKey() {
    if (!ctx.session.keypair) {
      const error = new Error("open a session with a Stellar secret key");
      error.status = 401;
      throw error;
    }
    return ctx.session.keypair;
  }

  async function maybeClaimViews() {
    return null;
  }

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      nodeId: config.nodeId,
      signalingUrl: config.signalingUrl,
      signalingWs: signalingWsUrl(),
      contractId: config.contractId || null,
      network: config.network,
      viewMilestone: config.viewMilestone,
      publicKey: ctx.session.publicKey || null,
    });
  });

  app.post("/api/session", async (req, res, next) => {
    try {
      const { secretKey, diskGb } = req.body || {};
      const keypair = keypairFrom(secretKey);
      const chain = await readOnChain(secretKey);
      ctx.session.diskKey = secretKey;
      ctx.session.secretKey = secretKey;
      ctx.session.keypair = keypair;
      ctx.session.publicKey = keypair.publicKey();
      ctx.session.balance = chain.xlm;
      const snap = stakeSnapshot({
        address: keypair.publicKey(),
        xlm: chain.xlm,
        staked: chain.stake,
        pending: chain.pending,
        diskGb,
        minDiskGb: config.minDiskGb,
        topicFee: config.topicFee,
      });
      snap.stakeSource = chain.stakeSource;
      const db = state();
      db.stake = snap;
      ensureDisk(config.diskPath, secretKey, diskGb);
      persist(db);
      const file = diskInfo(config.diskPath);
      res.json({ ok: true, stake: snap, nodeId: config.nodeId, balance: chain.xlm, pending: chain.pending, diskFile: file });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/posts", (_req, res) => {
    const db = state();
    const posts = [...db.posts].sort((a, b) => b.createdAt - a.createdAt);
    res.json({
      posts,
      rankings: {
        topView: [...posts].sort((a, b) => b.views - a.views).slice(0, 5),
        topLike: [...posts].sort((a, b) => b.likes - a.likes).slice(0, 5),
        topTrend: [...posts].sort((a, b) => scoreTrend(b) - scoreTrend(a)).slice(0, 5),
      },
      stake: db.stake,
      viewMilestone: config.viewMilestone,
    });
  });

  app.post("/api/sync", (req, res) => {
    const db = state();
    const posts = Array.isArray(req.body?.posts) ? req.body.posts.slice(0, 100) : [];
    for (const post of posts) mergePost(db, post);
    persist(db);
    res.json({ ok: true, count: db.posts.length });
  });

  app.post("/api/posts/:id/view", async (req, res, next) => {
    try {
      const db = state();
      const post = db.posts.find((p) => p.id === req.params.id);
      if (!post) return res.status(404).json({ error: "not found" });
      post.views += 1;
      persist(db);
      let viewReward = null;
      try {
        viewReward = await maybeClaimViews(db, post);
      } catch (error) {
        viewReward = { error: error.message };
      }
      res.json({ ok: true, views: post.views, post, viewReward });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/posts", async (req, res, next) => {
    try {
      const keypair = requireKey();
      const db = state();
      if (!db.stake?.canPost) {
        return res.status(403).json({ error: "need >= 100 GB disk and enough XPi on-chain" });
      }
      const title = String(req.body?.title || "").slice(0, 140);
      const body = String(req.body?.body || "").slice(0, 8000);
      const check = await moderate(`${title}\n${body}`);
      if (!check.ok) return res.status(400).json({ error: check.reason });
      if (!canAfford(ctx.session.balance, config.topicFee)) {
        return res.status(402).json({ error: "insufficient XLM" });
      }
      ctx.session.balance = String(Number(ctx.session.balance) - Number(config.topicFee));
      const post = {
        id: randomUUID(),
        title,
        body,
        author: keypair.publicKey(),
        likes: 0,
        views: 0,
        earned: "0",
        createdAt: Date.now(),
        claimedViews: 0,
        topicTx: null,
      };
      db.posts.unshift(post);
      persist(db);
      res.json({ ok: true, post, balance: ctx.session.balance, tx: null });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/posts/:id/like", async (req, res, next) => {
    try {
      const keypair = requireKey();
      const db = state();
      if (!db.stake?.canPost) return res.status(403).json({ error: "comment rights required" });
      const post = db.posts.find((p) => p.id === req.params.id);
      if (!post) return res.status(404).json({ error: "not found" });
      if (!canAfford(ctx.session.balance, config.likeFee)) {
        return res.status(402).json({ error: "insufficient XLM" });
      }
      ctx.session.balance = String(Number(ctx.session.balance) - Number(config.likeFee));
      post.likes += 1;
      post.earned = config.likeFee;
      persist(db);
      res.json({ ok: true, post, balance: ctx.session.balance, tx: null });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/stake", async (req, res, next) => {
    try {
      requireKey();
      const tx = await stakeXlm(ctx.session.secretKey, req.body?.xlm);
      const chain = await readOnChain(ctx.session.secretKey);
      ctx.session.balance = chain.xlm;
      res.json({ ok: true, tx, chain });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/unstake", async (req, res, next) => {
    try {
      requireKey();
      const tx = await unstakeXlm(ctx.session.secretKey, req.body?.xlm);
      const chain = await readOnChain(ctx.session.secretKey);
      ctx.session.balance = chain.xlm;
      res.json({ ok: true, tx, chain });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/claim", async (req, res, next) => {
    try {
      requireKey();
      const db = state();
      const estimate = dailyReward({
        xlm: db.stake?.staked || 0,
        diskGb: db.stake?.diskGb || 0,
      });
      const tx = await claimReward(ctx.session.secretKey);
      res.json({ ok: true, reward: estimate, tx, contractId: config.contractId });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    const status = error.status || 502;
    res.status(status).json({ error: error.message || "chain error" });
  });
}
