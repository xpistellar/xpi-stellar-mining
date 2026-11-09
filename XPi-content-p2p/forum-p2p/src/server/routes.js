import { randomUUID } from "node:crypto";
import { config, signalingWsUrl } from "../utils/config.js";
import {
  loadDb,
  saveDb,
  scoreTrend,
  mergePost,
  applyModAction,
  visiblePosts,
  isCommentBanned,
  banComments7d,
  listActiveBans,
  unbanComments,
} from "../storage/db.js";
import { diskInfo, ensureDisk, resetDiskData } from "../storage/disk.js";
import { getNodeDiskSecret, rotateNodeDiskSecret } from "../storage/node-disk-key.js";
import { ensureCategories, categoryStats, getCategory } from "../storage/categories.js";
import { tagStats, ensureSeedPosts } from "../storage/seed-posts.js";
import { writePublicBoard, readPublicBoard, refreshPublicBoardFromDb, mergeIntoPublicBoard } from "../storage/public-board.js";
import { OFFICIAL_MESH, officialSignalingList } from "../network/defaults.js";
import { nodeClaimStatus, recordNodeClaim, touchEligibility } from "../storage/node-claim.js";
import { moderate } from "../moderation/qwen.js";
import { stakeSnapshot } from "../stellar/stake.js";
import { dailyReward } from "../stellar/claim.js";
import {
  canAfford,
  claimReward,
  keypairFrom,
  createWallet,
  readOnChain,
  stakeXlm,
  unstakeXlm,
} from "../stellar/chain.js";
import {
  claimAdminIfEmpty,
  resolveRole,
  canModerate,
  canAppointMod,
  canClaimNode,
  listStaff,
  getNodeOwnerInfo,
  hashAccessPassword,
  verifyAccessPassword,
  setAccessConfig,
  getAccessConfig,
  claimNodeOwner,
  canManageCategories,
  ensureRoles,
  listNetworkModerators,
  applyRoleGrant,
  SUPER_ADMINS,
} from "../roles/roles.js";
import { signPost, signModAction, signRoleGrant } from "../utils/sign.js";
import {
  isSetupComplete,
  publicNetworkInfo,
  completeSetup,
  generateNetworkHash,
  hardForkMesh,
  updateSignalingUrls,
  getSignalingList,
  readNetworkIdentity,
} from "../network/identity.js";
import { applyNetworkIdentity, signalingWsUrls } from "../utils/config.js";
import { createReadStream, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function mountRoutes(app, ctx) {
  const secret = () => ctx.session.diskKey || null;

  function state() {
    // Disk is node-local (not per-wallet). Session is only required for write/stake identity.
    return loadDb(config.diskPath, null);
  }

  function persist(next) {
    saveDb(config.diskPath, null, next);
  }

  function requireSession() {
    if (!ctx.session.publicKey) {
      const error = new Error("Sign in with a Stellar secret key");
      error.status = 401;
      throw error;
    }
  }

  function requireKey() {
    if (!ctx.session.keypair) {
      const error = new Error("open a session with a Stellar secret key");
      error.status = 401;
      throw error;
    }
    return ctx.session.keypair;
  }

  function currentRole(db) {
    return resolveRole(ctx.session.publicKey, db);
  }

  app.get("/api/health", (_req, res) => {
    const net = publicNetworkInfo();
    const signals = getSignalingList();
    res.json({
      ok: true,
      accessMode: getAccessConfig().mode,
      version: "0.6.23",
      nodeId: config.nodeId,
      signalingUrl: signals[0] || config.signalingUrl,
      signalingWs: signalingWsUrl(signals[0] || config.signalingUrl),
      signalingUrls: signals,
      signalingWsUrls: signalingWsUrls(),
      contractId: config.contractId || null,
      network: config.network,
      viewMilestone: config.viewMilestone,
      publicKey: ctx.session.publicKey || null,
      buyXlmUrl: config.buyXlmUrl,
      setupRequired: net.setupRequired,
      networkShort: net.networkShort || config.networkShort || null,
      networkLabel: net.networkLabel || config.networkLabel || null,
      networkHash: net.networkHash || config.networkHash || null,
      genesis: net.genesis || config.isGenesis || false,
    });
  });

  // Public: node + mesh setup hints for footer / docs
  app.get("/api/public/defaults", (_req, res) => {
    res.json({
      ok: true,
      official: {
        networkHash: OFFICIAL_MESH.networkHash,
        networkShort: OFFICIAL_MESH.networkShort,
        networkLabel: OFFICIAL_MESH.networkLabel,
        signalingUrl: officialSignalingList()[0],
        signalingUrls: officialSignalingList(),
      },
      hint: "Fresh installs auto-join this mesh. Create network only to fork a private mesh.",
    });
  });

  app.get("/api/public/board", (req, res) => {
    if (!requireForumAccess(req, res)) return;
    const board = readPublicBoard();
    const net = publicNetworkInfo();
    res.json({
      ok: true,
      setupRequired: Boolean(net.setupRequired),
      networkShort: net.networkShort || null,
      networkLabel: net.networkLabel || null,
      genesis: Boolean(net.genesis),
      signalingUrl: net.signalingUrl || null,
      ...board,
    });
  });

  app.get("/api/public/node-info", (_req, res) => {
    const net = publicNetworkInfo();
    const signals = getSignalingList();
    res.json({
      ok: true,
      version: "0.6.23",
      nodeId: config.nodeId,
      networkShort: net.networkShort || null,
      networkLabel: net.networkLabel || null,
      genesis: Boolean(net.genesis),
      setupRequired: Boolean(net.setupRequired),
      signalingUrls: signals,
      hints: {
        hash: "networkHash = id mesh (chia sẻ offline). Chỉ peer cùng hash mới sync.",
        signal:
          "Signaling URL = bootstrap WebRTC. Cần public (VPS / tunnel). Client thử lần lượt multi-URL.",
        runForum: "npm start   # hoặc node src/index.js",
        runSignal: "cd signaling-standalone && npm install && npm start",
        downloadSignal: "/download/signaling-standalone.zip",
      },
    });
  });

  // Download standalone signaling package (for shared host / VPS bootstrap)
  app.get("/download/signaling-standalone.zip", (_req, res) => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
    const zipPath = join(root, "deploy", "signaling-standalone.zip");
    const dirPath = join(root, "signaling-standalone");
    if (existsSync(zipPath)) {
      res.setHeader("content-type", "application/zip");
      res.setHeader(
        "content-disposition",
        'attachment; filename="forum-p2p-signaling-standalone.zip"'
      );
      createReadStream(zipPath).pipe(res);
      return;
    }
    // Fallback: instruct to use folder if zip not built
    res.status(404).json({
      error: "signaling-standalone.zip not built yet",
      hint: "Copy folder signaling-standalone/ from the release, or run: npm run pack-signaling",
      folder: "signaling-standalone/",
    });
  });

  // Admin: multi-signaling list
  app.get("/api/admin/signaling", (req, res) => {
    if (!ctx.session.publicKey) {
      return res.status(401).json({ error: "login required" });
    }
    const db = state();
    const role = resolveRole(ctx.session.publicKey, db);
    if (role !== "admin" && role !== "super_admin") {
      return res.status(403).json({ error: "admin privilege required" });
    }
    const id = readNetworkIdentity();
    res.json({
      ok: true,
      signalingUrl: id?.signalingUrl || config.signalingUrl,
      signalingUrls: getSignalingList(),
      networkHash: id?.networkHash || null,
      networkShort: id?.networkShort || null,
      genesis: Boolean(id?.genesis),
    });
  });

  app.put("/api/admin/signaling", (req, res, next) => {
    try {
      if (!ctx.session.publicKey) {
        return res.status(401).json({ error: "login required" });
      }
      const db = state();
      const role = resolveRole(ctx.session.publicKey, db);
      if (role !== "admin" && role !== "super_admin") {
        return res.status(403).json({ error: "admin privilege required" });
      }
      let urls = req.body?.signalingUrls;
      if (typeof urls === "string") {
        urls = urls.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      }
      if (!Array.isArray(urls)) {
        return res.status(400).json({ error: "signalingUrls array required" });
      }
      const identity = updateSignalingUrls(urls);
      applyNetworkIdentity(identity);
      const board = writePublicBoard();
      res.json({
        board,
        ok: true,
        signalingUrl: identity.signalingUrl,
        signalingUrls: identity.signalingUrls,
        hint: "Primary = dòng đầu. Peer nên dùng cùng danh sách (hoặc ít nhất 1 URL chung đang online).",
      });
    } catch (error) {
      next(error);
    }
  });



  // ---------- First-run network setup ----------
  app.get("/api/setup/status", (_req, res) => {
    const net = publicNetworkInfo();
    res.json({
      ...net,
      suggestedSignaling: config.signalingUrl,
      nodeIdHint: config.nodeId,
    });
  });

  app.post("/api/setup/preview-hash", (_req, res) => {
    if (isSetupComplete()) {
      return res.status(400).json({ error: "setup already complete" });
    }
    res.json(generateNetworkHash("preview"));
  });

  app.post("/api/setup/signaling", (req, res, next) => {
    try {
      if (!isSetupComplete()) {
        return res.status(400).json({ error: "setup mesh first (join or create)", code: "SETUP_REQUIRED" });
      }
      let urls = req.body?.signalingUrls;
      if (!urls && req.body?.signalingUrl) urls = [req.body.signalingUrl];
      if (typeof urls === "string") {
        urls = urls.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      }
      if (!Array.isArray(urls) || !urls.length) {
        return res.status(400).json({ error: "signalingUrl required" });
      }
      const identity = updateSignalingUrls(urls);
      applyNetworkIdentity(identity);
      const board = writePublicBoard();
      res.json({
        board,
        ok: true,
        signalingUrl: identity.signalingUrl,
        signalingUrls: identity.signalingUrls,
        networkHash: identity.networkHash,
        networkShort: identity.networkShort,
      });
    } catch (error) {
      next(error);
    }
  });


  /** Create private mesh — requires login + ≥31.4 XLM on-chain stake */
  app.post("/api/setup/create-private", async (req, res, next) => {
    try {
      const keypair = requireKey();
      const db = state();
      // refresh stake from chain
      let chain;
      try {
        chain = await readOnChain(ctx.session.secretKey);
      } catch {
        chain = { xlm: ctx.session.balance || "0", stake: "0", pending: "0" };
      }
      const snap = stakeSnapshot({
        address: keypair.publicKey(),
        xlm: chain.xlm,
        staked: chain.stake,
        pending: chain.pending,
        xpi: chain.xpi || chain.pending,
        topicFee: config.topicFee,
      });
      db.stake = snap;
      persist(db);
      if (!snap.canCreateNetwork) {
        return res.status(403).json({
          error: "Stake at least 31.4 XLM on Soroban before creating a private network",
          code: "NEED_STAKE",
          stake: snap,
        });
      }
      if (isSetupComplete()) {
        // Allow fork: overwrite identity only if body.force
        if (!req.body?.force) {
          return res.status(400).json({
            error: "This node already has a mesh identity. Send force:true to replace with a new genesis network.",
            code: "SETUP_DONE",
          });
        }
      }
      const identity = completeSetup({
        mode: "create",
        nodeName: req.body?.nodeName,
        networkLabel: req.body?.networkLabel,
        signalingUrl: req.body?.signalingUrl || officialSignalingList()[0],
        founderPublicKey: keypair.publicKey(),
      });
      try {
        updateSignalingUrls(officialSignalingList());
      } catch { /* */ }
      applyNetworkIdentity(identity);
      const board = writePublicBoard();
      res.json({
        ok: true,
        board,
        identity: {
          nodeName: identity.nodeName,
          networkHash: identity.networkHash,
          networkShort: identity.networkShort,
          networkLabel: identity.networkLabel,
          genesis: identity.genesis,
          signalingUrl: identity.signalingUrl,
        },
        stake: snap,
        hint: "Private network created. Share networkHash + signaling with peers.",
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/setup", (req, res, next) => {
    try {
      if (isSetupComplete()) {
        return res.status(400).json({
          error:
            "Mesh already set up on this node. Use Connect to change signaling, or delete data/network-identity.sealed to reset.",
          code: "SETUP_DONE",
        });
      }
      const mode = String(req.body?.mode || "").toLowerCase();
      if (mode !== "create" && mode !== "join") {
        return res.status(400).json({ error: "mode must be create|join" });
      }
      const identity = completeSetup({
        mode,
        nodeName: req.body?.nodeName,
        networkHash: req.body?.networkHash,
        networkLabel: req.body?.networkLabel,
        signalingUrl: req.body?.signalingUrl,
        founderPublicKey: req.body?.founderPublicKey || null,
      });
      applyNetworkIdentity(identity);
      const board = writePublicBoard();
      res.json({
        board,
        ok: true,
        identity: {
          nodeName: identity.nodeName,
          networkHash: identity.networkHash,
          networkShort: identity.networkShort,
          networkLabel: identity.networkLabel,
          genesis: identity.genesis,
          signalingUrl: identity.signalingUrl,
        },
        hint:
          mode === "create"
            ? "You are genesis of this mesh. Share networkHash + signaling URL with other nodes so they can Join."
            : "Joined mesh. Signaling must point at a public bootstrap (same URL) to meet peers.",
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/wallet/create", (_req, res) => {
    const wallet = createWallet();
    res.json({
      ok: true,
      publicKey: wallet.publicKey,
      secretKey: wallet.secretKey,
      warning: "SAVE YOUR SECRET offline. If lost, funds are gone forever.",
    });
  });

  app.post("/api/session", async (req, res, next) => {
    try {
      if (!isSetupComplete()) {
        return res.status(400).json({
          error:
            "Mesh not set up. Complete Create network or Connect / Join first.",
          code: "SETUP_REQUIRED",
        });
      }
      const { secretKey, resetDisk } = req.body || {};
      if (!secretKey || typeof secretKey !== "string" || !secretKey.trim().startsWith("S")) {
        return res.status(400).json({
          error: "Invalid Stellar secret key (must start with S…).",
          code: "BAD_SECRET",
        });
      }
      let keypair;
      try {
        keypair = keypairFrom(secretKey);
      } catch {
        return res.status(400).json({
          error: "Invalid Stellar secret key — check the S… string (no extra spaces).",
          code: "BAD_SECRET",
        });
      }

      let chain;
      try {
        chain = await readOnChain(secretKey);
      } catch (err) {
        // Vẫn cho login offline nếu Horizon lỗi — stake on-chain = 0
        console.warn("[session] readOnChain failed:", err?.message || err);
        chain = { xlm: "0", stake: "0", pending: "0", stakeSource: "offline" };
      }

      ctx.session.diskKey = getNodeDiskSecret(); // node-local; not the wallet secret
      ctx.session.secretKey = secretKey.trim();
      ctx.session.keypair = keypair;
      ctx.session.publicKey = keypair.publicKey();
      ctx.session.balance = chain.xlm;

      claimAdminIfEmpty(ctx.session.publicKey);

      const snap = stakeSnapshot({
        address: keypair.publicKey(),
        xlm: chain.xlm,
        staked: chain.stake,
        pending: chain.pending,
        xpi: chain.xpi || chain.pending,
        topicFee: config.topicFee,
      });
      snap.stakeSource = chain.stakeSource;

      /**
       * Disk is encrypted with a NODE-LOCAL key (data/node-disk.key or NODE_DISK_SECRET),
       * never with the Stellar secret. Any wallet can sign in.
       * resetDisk / legacy wallet-encrypted disk → recreate empty disk under node key.
       */
      let diskRecreated = false;
      const forceReset = resetDisk === true || resetDisk === "1" || resetDisk === "true";
      if (forceReset) {
        try {
          const { unlinkSync, existsSync } = await import("node:fs");
          if (existsSync(config.diskPath)) unlinkSync(config.diskPath);
        } catch { /* */ }
        resetDiskData(config.diskPath, getNodeDiskSecret());
        diskRecreated = true;
      }

      let db;
      try {
        db = state();
      } catch (err) {
        if (err?.code === "DISK_AUTH_FAIL") {
          // Legacy disk (encrypted with a wallet secret) or rotated node key
          try {
            const { unlinkSync, existsSync } = await import("node:fs");
            if (existsSync(config.diskPath)) unlinkSync(config.diskPath);
          } catch { /* */ }
          resetDiskData(config.diskPath, getNodeDiskSecret());
          diskRecreated = true;
          db = state();
        } else {
          throw err;
        }
      }

      db.stake = snap;
      ensureCategories(db);
      ensureSeedPosts(db);
      if (db._seedDirty) delete db._seedDirty;
      persist(db);
      try {
        refreshPublicBoardFromDb(db);
      } catch {
        /* */
      }
      const file = diskInfo(config.diskPath);
      const role = resolveRole(ctx.session.publicKey, db);
      const nodeClaim = canClaimNode(role)
        ? nodeClaimStatus(ctx.session.publicKey, Boolean(snap.canRunNode))
        : null;
      res.json({
        ok: true,
        stake: snap,
        nodeId: config.nodeId,
        balance: chain.xlm,
        pending: chain.pending,
        diskFile: file,
        role,
        nodeClaim,
        publicKey: ctx.session.publicKey,
        diskRecreated: Boolean(diskRecreated),
        diskNote:
          "Virtual disk is node-local (AES). Any Stellar wallet can sign in. Super-admins are fixed in code.",
      });
    } catch (error) {
      next(error);
    }
  });



  function requireForumAccess(req, res) {
    const access = getAccessConfig();
    if (access.mode !== "private") return true;
    // Signed-in node owner / super_admin always allowed
    if (ctx.session.publicKey) {
      const meta = readNodeMeta();
      if (meta.adminPublicKey === ctx.session.publicKey) return true;
      if (SUPER_ADMINS.has(ctx.session.publicKey)) return true;
    }
    if (ctx.session.forumUnlocked) return true;
    res.status(403).json({
      error: "This node is private. Enter the view password to continue.",
      code: "FORUM_LOCKED",
      mode: "private",
    });
    return false;
  }

  app.get("/api/access/status", (_req, res) => {
    const access = getAccessConfig();
    const unlocked =
      access.mode === "public" ||
      Boolean(ctx.session.forumUnlocked) ||
      (ctx.session.publicKey &&
        (SUPER_ADMINS.has(ctx.session.publicKey) ||
          readNodeMeta().adminPublicKey === ctx.session.publicKey));
    res.json({
      ok: true,
      mode: access.mode,
      hasPassword: access.hasPassword,
      unlocked,
      session: Boolean(ctx.session.publicKey),
    });
  });

  app.post("/api/access/unlock", (req, res) => {
    const access = getAccessConfig();
    if (access.mode !== "private") {
      ctx.session.forumUnlocked = true;
      return res.json({ ok: true, unlocked: true, mode: "public" });
    }
    const password = String(req.body?.password || "");
    const meta = readNodeMeta();
    if (!verifyAccessPassword(password, meta.accessPasswordHash)) {
      return res.status(401).json({ error: "Wrong password", code: "BAD_PASSWORD" });
    }
    ctx.session.forumUnlocked = true;
    res.json({ ok: true, unlocked: true, mode: "private" });
  });

  app.post("/api/access/lock", (_req, res) => {
    ctx.session.forumUnlocked = false;
    res.json({ ok: true, unlocked: false });
  });

  /** Node owner / super_admin: public <-> private + set password */
  app.put("/api/access/config", (req, res, next) => {
    try {
      requireKey();
      const body = req.body || {};
      const out = setAccessConfig(
        {
          mode: body.mode,
          password: body.password,
          clearPassword: body.clearPassword,
        },
        ctx.session.publicKey
      );
      if (out.mode === "public") ctx.session.forumUnlocked = true;
      res.json({
        ok: true,
        ...out,
        hint:
          out.mode === "private"
            ? "Forum is private. Visitors need the view password (avoids casual indexing)."
            : "Forum is public (default genesis mode).",
      });
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/node/status", (_req, res) => {
    const owner = getNodeOwnerInfo();
    const id = readNetworkIdentity();
    const net = publicNetworkInfo();
    res.json({
      ok: true,
      ...owner,
      isOwner: Boolean(
        ctx.session.publicKey &&
          owner.ownerPublicKey &&
          owner.ownerPublicKey === ctx.session.publicKey
      ),
      sessionPublicKey: ctx.session.publicKey || null,
      networkHash: id?.networkHash || net.networkHash || null,
      networkLabel: id?.networkLabel || net.networkLabel || null,
      networkShort: id?.networkShort || null,
      signalingUrl: id?.signalingUrl || net.signalingUrl || null,
      signalingUrls: getSignalingList(),
      hardFork: Boolean(id?.hardFork),
      forkedFromHash: id?.forkedFromHash || null,
      rejoinOriginalBlocked: Boolean(id?.rejoinOriginalBlocked),
      officialHash: (process.env.DEFAULT_NETWORK_HASH || "").slice(0, 12) || "d3e678d640e5",
      minNodeXpi: "0.0314",
      minStakeXlm: "31.4",
    });
  });

  /** Claim this machine as node operator (node-meta.sealed). Requires Sign in. */
  app.post("/api/node/claim", (req, res, next) => {
    try {
      requireKey();
      const owner = claimNodeOwner(ctx.session.publicKey);
      res.json({
        ok: true,
        ...owner,
        role: resolveRole(ctx.session.publicKey, state()),
        hint: owner.alreadyOwner
          ? "You already own this node. Stake ≥31.4 XLM + ≥0.0314 XPi, wait 48h, then claim_node."
          : "Node claimed. You are the local node admin (not network super-admin). Use Claim node reward after eligibility.",
      });
    } catch (e) {
      next(e);
    }
  });

  /**
   * Hard fork: new hash + signaling, keep local disk posts.
   * Irreversible regarding the previous mesh (rejoin blocked).
   */
  app.post("/api/node/hard-fork", async (req, res, next) => {
    try {
      requireKey();
      const body = req.body || {};
      const confirm = body.confirm === true || body.confirm === "1";
      if (!confirm) {
        return res.status(400).json({
          error: 'Set confirm: true — hard fork cannot be undone (you leave the old mesh permanently).',
          code: "CONFIRM_REQUIRED",
        });
      }
      const prev = readNetworkIdentity();
      const urls = Array.isArray(body.signalingUrls)
        ? body.signalingUrls
        : String(body.signalingUrl || "")
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean);
      const identity = hardForkMesh({
        networkLabel: body.networkLabel || `Fork of ${prev?.networkLabel || "mesh"}`,
        signalingUrl: body.signalingUrl || urls[0],
        signalingUrls: urls,
        networkHash: body.networkHash || null,
        nodeName: body.nodeName || prev?.nodeName,
        founderPublicKey: ctx.session.publicKey,
        previousHash: prev?.networkHash,
      });
      // Claim fork founder as node owner if free
      try {
        claimNodeOwner(ctx.session.publicKey);
      } catch {
        /* already owned */
      }
      // Refresh in-process config
      try {
        const mod = await import("../utils/config.js");
        if (typeof mod.applyNetworkIdentity === "function") {
          mod.applyNetworkIdentity(identity);
        }
      } catch {
        /* */
      }
      res.json({
        ok: true,
        identity: {
          networkHash: identity.networkHash,
          networkShort: identity.networkShort,
          networkLabel: identity.networkLabel,
          signalingUrl: identity.signalingUrl,
          signalingUrls: identity.signalingUrls,
          hardFork: true,
          forkedFromHash: identity.forkedFromHash,
          rejoinOriginalBlocked: true,
        },
        hint: "Local posts kept on disk. Peers on the old hash will not sync. You cannot auto-rejoin the original mesh from this node.",
      });
    } catch (e) {
      next(e);
    }
  });


  app.get("/api/me", (_req, res) => {
    if (!ctx.session.publicKey) return res.status(401).json({ error: "no session" });
    const db = state();
    res.json({
      publicKey: ctx.session.publicKey,
      role: resolveRole(ctx.session.publicKey, db),
      balance: ctx.session.balance,
    });
  });


  /** One-shot payload for My Account panels (avoids empty UI from silent failures). */
  app.get("/api/myacc/bootstrap", (req, res) => {
    try {
      requireKey();
      const db = state();
      ensureCategories(db);
      ensureSeedPosts(db);
      if (db._seedDirty) {
        delete db._seedDirty;
        persist(db);
        try {
          refreshPublicBoardFromDb(db);
        } catch {
          /* */
        }
      }
      const role = currentRole(db);
      const posts = [...(db.posts || [])].sort((a, b) => b.createdAt - a.createdAt);
      const catStats = categoryStats(db, visiblePosts(db, { includeHidden: canModerate(role) }));
      const signals = getSignalingList();
      res.json({
        ok: true,
        role,
        publicKey: ctx.session.publicKey,
        categories: catStats.flat,
        categoryList: ensureCategories(db).map((c) => ({
          id: c.id,
          name: c.name,
          parentId: c.parentId || null,
          order: c.order || 100,
        })),
        posts: posts.slice(0, 200),
        postsTotal: posts.length,
        staff: listStaff(db),
        bans: listActiveBans(db),
        signalingUrls: signals,
        signalingUrl: signals[0] || null,
        networkShort: config.networkShort || null,
        networkHash: config.networkHash || null,
        stake: db.stake || null,
      });
    } catch (e) {
      res.status(e.status || 401).json({ error: e.message || String(e) });
    }
  });

  // ---------- Categories (phpBB-style index) ----------
  app.get("/api/categories", (req, res) => {
    if (!requireForumAccess(req, res)) return;
    const db = state();
    const role = currentRole(db);
    const posts = visiblePosts(db, { includeHidden: canModerate(role) });
    const stats = categoryStats(db, posts);
    res.json({
      tree: stats.tree,
      categories: stats.flat,
      role: role || "guest",
    });
  });

  app.post("/api/admin/categories", (req, res, next) => {
    try {
      requireKey();
      const db = state();
      if (!canManageCategories(currentRole(db))) {
        return res.status(403).json({ error: "admin privilege required" });
      }
      const { id, name, description, order, parentId } = req.body || {};
      const cid = String(id || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")
        .slice(0, 40);
      if (!cid || !name) return res.status(400).json({ error: "id and name required" });
      ensureCategories(db);
      let parent = parentId ? String(parentId).slice(0, 40) : null;
      if (parent === cid) parent = null;
      if (parent && !db.categories.some((c) => c.id === parent)) parent = null;
      const existing = db.categories.find((c) => c.id === cid);
      if (existing) {
        existing.name = String(name).slice(0, 80);
        if (description != null) existing.description = String(description).slice(0, 200);
        if (order != null) existing.order = Number(order) || existing.order;
        if (parentId !== undefined) existing.parentId = parent;
      } else {
        db.categories.push({
          id: cid,
          name: String(name).slice(0, 80),
          description: String(description || "").slice(0, 200),
          order: Number(order) || 100,
          parentId: parent,
        });
      }
      persist(db);
      res.json({ ok: true, categories: db.categories });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/categories/:id", (req, res, next) => {
    try {
      requireKey();
      const db = state();
      if (!canManageCategories(currentRole(db))) {
        return res.status(403).json({ error: "admin privilege required" });
      }
      const cid = req.params.id;
      if (cid === "general") {
        return res.status(400).json({ error: "cannot delete default general" });
      }
      ensureCategories(db);
      db.categories = db.categories.filter((c) => c.id !== cid);
      // move posts to general
      for (const p of db.posts) {
        if (p.categoryId === cid) p.categoryId = "general";
      }
      persist(db);
      res.json({ ok: true, categories: db.categories });
    } catch (error) {
      next(error);
    }
  });

  // ---------- Posts ----------
  app.get("/api/posts", (req, res) => {
    if (!requireForumAccess(req, res)) return;
    const db = state();
    const role = currentRole(db);
    const includeHidden = canModerate(role);
    const categoryId = req.query.category ? String(req.query.category) : null;
    const posts = visiblePosts(db, { includeHidden, categoryId }).sort((a, b) => {
      const sa = a.sticky ? 1 : 0;
      const sb = b.sticky ? 1 : 0;
      if (sb !== sa) return sb - sa;
      return b.createdAt - a.createdAt;
    });
    res.json({
      posts,
      categoryId,
      category: categoryId ? getCategory(db, categoryId) : null,
      rankings: {
        topView: [...visiblePosts(db, { includeHidden })].sort((a, b) => b.views - a.views).slice(0, 10),
        topLike: [...visiblePosts(db, { includeHidden })].sort((a, b) => b.likes - a.likes).slice(0, 10),
        topTrend: [...visiblePosts(db, { includeHidden })].sort((a, b) => scoreTrend(b) - scoreTrend(a)).slice(0, 10),
        topTags: tagStats(visiblePosts(db, { includeHidden }), 15),
      },
      stake: db.stake,
      viewMilestone: config.viewMilestone,
      role: role || "guest",
      categories: ensureCategories(db),
    });
  });

  // Admin: all posts including deleted (management panel)

  app.get("/api/tags", (req, res) => {
    try {
      const db = state();
      const posts = visiblePosts(db, { includeHidden: false });
      res.json({ tags: tagStats(posts, Number(req.query.limit) || 30) });
    } catch (e) {
      res.status(401).json({ error: e.message });
    }
  });

  app.get("/api/search", (req, res) => {
    if (!requireForumAccess(req, res)) return;
    try {
      const db = state();
      const q = String(req.query.q || "").trim().toLowerCase();
      const tag = String(req.query.tag || "").trim().toLowerCase().replace(/^#/, "");
      const sort = String(req.query.sort || "trend");
      let posts = visiblePosts(db, { includeHidden: false });
      if (tag) posts = posts.filter((p) => (p.tags || []).map((t) => String(t).toLowerCase()).includes(tag));
      if (q) {
        posts = posts.filter(
          (p) =>
            String(p.title || "").toLowerCase().includes(q) ||
            String(p.body || "").toLowerCase().includes(q) ||
            (p.tags || []).some((t) => String(t).toLowerCase().includes(q))
        );
      }
      if (sort === "views") posts.sort((a, b) => b.views - a.views);
      else if (sort === "likes") posts.sort((a, b) => b.likes - a.likes);
      else if (sort === "new") posts.sort((a, b) => b.createdAt - a.createdAt);
      else posts.sort((a, b) => scoreTrend(b) - scoreTrend(a));
      res.json({
        q,
        tag,
        sort,
        posts: posts.slice(0, 50),
        rankings: {
          topView: [...visiblePosts(db)].sort((a, b) => b.views - a.views).slice(0, 10),
          topLike: [...visiblePosts(db)].sort((a, b) => b.likes - a.likes).slice(0, 10),
          topTrend: [...visiblePosts(db)].sort((a, b) => scoreTrend(b) - scoreTrend(a)).slice(0, 10),
          topTags: tagStats(visiblePosts(db), 15),
        },
      });
    } catch (e) {
      res.status(401).json({ error: e.message });
    }
  });

  app.get("/api/admin/posts", (req, res) => {
    try {
      const db = state();
      const role = currentRole(db);
      // super_admin, moderator: full list; node admin: own posts only unless elevated
      const allowed =
        role === "super_admin" ||
        role === "moderator" ||
        role === "admin";
      if (!allowed) return res.status(403).json({ error: "staff privilege required" });
      const status = req.query.status ? String(req.query.status) : null;
      const categoryId = req.query.categoryId ? String(req.query.categoryId) : null;
      let posts = [...(db.posts || [])];
      if (role === "admin") {
        posts = posts.filter((p) => p.author === ctx.session.publicKey);
      }
      if (status && status !== "mine") {
        posts = posts.filter((p) => (p.status || "active") === status);
      }
      if (status === "mine") {
        posts = posts.filter((p) => p.author === ctx.session.publicKey);
      }
      if (categoryId) {
        posts = posts.filter((p) => (p.categoryId || "general") === categoryId);
      }
      posts.sort((a, b) => b.createdAt - a.createdAt);
      const cats = ensureCategories(db);
      res.json({
        posts: posts.slice(0, 200),
        total: posts.length,
        role,
        categories: cats.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId || null })),
      });
    } catch (e) {
      res.status(401).json({ error: e.message });
    }
  });

  /** Guest / pre-login mesh: merge into public-board.json only (no encrypted disk). */
  app.post("/api/sync/public", (req, res) => {
    const posts = Array.isArray(req.body?.posts) ? req.body.posts.slice(0, 100) : [];
    const out = mergeIntoPublicBoard(posts);
    res.json({ ok: true, ...out, target: "public-board" });
  });

  app.post("/api/sync", (req, res) => {
    const db = state();
    const posts = Array.isArray(req.body?.posts) ? req.body.posts.slice(0, 100) : [];
    let accepted = 0;
    for (const post of posts) {
      if (mergePost(db, post)) accepted += 1;
    }
    const actions = Array.isArray(req.body?.modActions) ? req.body.modActions.slice(0, 50) : [];
    let modAccepted = 0;
    for (const action of actions) {
      if (applyModAction(db, action)) modAccepted += 1;
    }
    const grants = Array.isArray(req.body?.roleGrants) ? req.body.roleGrants.slice(0, 50) : [];
    let grantAccepted = 0;
    for (const g of grants) {
      if (applyRoleGrant(db, g)) grantAccepted += 1;
    }
    persist(db);
    res.json({
      ok: true,
      count: db.posts.length,
      accepted,
      modAccepted,
      grantAccepted,
    });
  });

  app.post("/api/posts/:id/view", async (req, res, next) => {
    try {
      const db = state();
      const post = db.posts.find((p) => p.id === req.params.id);
      if (!post || post.status === "deleted") return res.status(404).json({ error: "not found" });
      post.views += 1;
      persist(db);
      res.json({ ok: true, views: post.views, post });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/posts", async (req, res, next) => {
    try {
      const keypair = requireKey();
      const db = state();
      if (!db.stake?.canPost && !db.stake?.canComment) {
        return res.status(403).json({
          error: "Need ≥31.4 XLM staked on Soroban to post",
          code: "NEED_STAKE",
        });
      }
      const title = String(req.body?.title || "").slice(0, 140);
      // Markdown source — rendered safely on client
      const body = String(req.body?.body || "").slice(0, 20000);
      let categoryId = String(req.body?.categoryId || "general").slice(0, 40);
      ensureCategories(db);
      if (!db.categories.some((c) => c.id === categoryId)) categoryId = "general";

      const tags = Array.isArray(req.body?.tags)
        ? req.body.tags.map((x) => String(x).toLowerCase().replace(/[^a-z0-9à-ỹ_-]/gi, "").slice(0, 24)).filter(Boolean).slice(0, 8)
        : String(req.body?.tags || "")
            .split(/[,#\s]+/)
            .map((x) => x.toLowerCase().replace(/[^a-z0-9à-ỹ_-]/gi, "").slice(0, 24))
            .filter(Boolean)
            .slice(0, 8);

      const role = currentRole(db);
      const sticky =
        Boolean(req.body?.sticky) && (role === "admin" || role === "super_admin" || role === "moderator");

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
        categoryId,
        tags,
        sticky,
        likes: 0,
        views: 0,
        earned: "0",
        createdAt: Date.now(),
        claimedViews: 0,
        topicTx: null,
        status: "active",
        format: "markdown",
        comments: [],
      };
      post.signature = signPost(ctx.session.secretKey, post);
      db.posts.unshift(post);
      persist(db);
      res.json({ ok: true, post, balance: ctx.session.balance, tx: null });
    } catch (error) {
      next(error);
    }
  });


  app.get("/api/posts/:id", (req, res) => {
    try {
      const db = state();
      const post = db.posts.find((p) => p.id === req.params.id);
      if (!post || post.status === "deleted") return res.status(404).json({ error: "not found" });
      if (post.status === "hidden" && !canModerate(currentRole(db))) {
        return res.status(404).json({ error: "not found" });
      }
      if (!Array.isArray(post.comments)) post.comments = [];
      res.json({
        ok: true,
        post,
        path: `/#/forum/${encodeURIComponent(post.categoryId || "general")}/${encodeURIComponent(post.id)}`,
      });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  });

  app.get("/api/posts/:id/comments", (req, res) => {
    try {
      const db = state();
      const post = db.posts.find((p) => p.id === req.params.id);
      if (!post || post.status === "deleted") return res.status(404).json({ error: "not found" });
      const comments = Array.isArray(post.comments) ? post.comments : [];
      res.json({ ok: true, comments, count: comments.length });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  });

  app.post("/api/posts/:id/comments", async (req, res, next) => {
    try {
      const keypair = requireKey();
      const db = state();
      if (!db.stake?.canComment && !db.stake?.canPost) {
        return res.status(403).json({
          error: "Need ≥31.4 XLM staked on Soroban to comment",
          code: "NEED_STAKE",
        });
      }
      const post = db.posts.find((p) => p.id === req.params.id);
      if (!post || post.status === "deleted") return res.status(404).json({ error: "not found" });
      if (post.status === "hidden") return res.status(403).json({ error: "post hidden" });
      if (isCommentBanned(db, keypair.publicKey())) {
        return res.status(403).json({ error: "You are banned from commenting for 7 days" });
      }
      const body = String(req.body?.body || "").trim().slice(0, 4000);
      if (body.length < 1) return res.status(400).json({ error: "comment body required" });
      const check = await moderate(body);
      if (!check.ok) return res.status(400).json({ error: check.reason });
      if (!Array.isArray(post.comments)) post.comments = [];
      const comment = {
        id: randomUUID(),
        body,
        author: keypair.publicKey(),
        createdAt: Date.now(),
        format: "markdown",
      };
      post.comments.push(comment);
      // light engagement signal
      post.views = Number(post.views || 0);
      persist(db);
      res.json({ ok: true, comment, postId: post.id, count: post.comments.length });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/posts/:id/like", async (req, res, next) => {
    try {
      requireKey();
      const db = state();
      if (!db.stake?.canComment && !db.stake?.canPost) {
        return res.status(403).json({ error: "Need ≥31.4 XLM staked on Soroban", code: "NEED_STAKE" });
      }
      const post = db.posts.find((p) => p.id === req.params.id);
      if (!post || post.status === "deleted") return res.status(404).json({ error: "not found" });
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


  app.get("/api/admin/bans", (req, res) => {
    try {
      requireKey();
      const db = state();
      if (!canModerate(currentRole(db))) return res.status(403).json({ error: "forbidden" });
      res.json({ ok: true, bans: listActiveBans(db) });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  });

  app.post("/api/admin/ban", (req, res, next) => {
    try {
      const keypair = requireKey();
      const db = state();
      const role = currentRole(db);
      if (!canModerate(role)) return res.status(403).json({ error: "forbidden" });
      const publicKey = String(req.body?.publicKey || "").trim();
      if (!publicKey.startsWith("G") || publicKey.length < 56) {
        return res.status(400).json({ error: "invalid public key" });
      }
      const ban = banComments7d(db, {
        publicKey,
        by: keypair.publicKey(),
        reason: req.body?.reason || "comment ban 7d",
      });
      persist(db);
      res.json({ ok: true, ban });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/ban/:publicKey", (req, res, next) => {
    try {
      requireKey();
      const db = state();
      if (!canModerate(currentRole(db))) return res.status(403).json({ error: "forbidden" });
      unbanComments(db, req.params.publicKey);
      persist(db);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/posts/:id/moderate", async (req, res, next) => {
    try {
      requireKey();
      const db = state();
      const role = currentRole(db);
      if (!canModerate(role)) {
        return res.status(403).json({ error: "moderator privilege required" });
      }
      const post = db.posts.find((p) => p.id === req.params.id);
      if (!post) return res.status(404).json({ error: "not found" });

      const type = String(req.body?.action || "").toLowerCase();
      if (!["hide", "delete", "restore"].includes(type)) {
        return res.status(400).json({ error: "action must be hide|delete|restore" });
      }

      const action = {
        type,
        postId: post.id,
        by: ctx.session.publicKey,
        at: Date.now(),
        reason: String(req.body?.reason || "").slice(0, 200),
      };
      action.signature = signModAction(ctx.session.secretKey, action);

      if (!applyModAction(db, action)) {
        return res.status(400).json({ error: "could not apply moderation" });
      }
      persist(db);
      res.json({ ok: true, post, action });
    } catch (error) {
      next(error);
    }
  });

  // ---------- Staff / network moderators ----------
  app.get("/api/admin/staff", (_req, res) => {
    const db = state();
    res.json({
      staff: listStaff(db),
      moderators: listNetworkModerators(db),
      superAdmins: [...SUPER_ADMINS],
      myRole: ctx.session.publicKey ? resolveRole(ctx.session.publicKey, db) : "guest",
    });
  });

  app.post("/api/admin/moderator", (req, res, next) => {
    try {
      requireKey();
      const db = state();
      const role = currentRole(db);
      if (!canAppointMod(role)) {
        return res.status(403).json({ error: "admin privilege required" });
      }
      const address = String(req.body?.address || "").trim();
      if (!/^G[A-Z0-9]{55}$/.test(address)) {
        return res.status(400).json({ error: "invalid Stellar public key" });
      }
      if (SUPER_ADMINS.has(address)) {
        return res.status(400).json({ error: "cannot change super admin" });
      }
      const grant = {
        op: "grant",
        address,
        role: "moderator",
        by: ctx.session.publicKey,
        at: Date.now(),
      };
      grant.signature = signRoleGrant(ctx.session.secretKey, grant);
      if (!applyRoleGrant(db, grant)) {
        return res.status(400).json({ error: "could not apply grant" });
      }
      persist(db);
      res.json({
        ok: true,
        address,
        role: "moderator",
        grant,
        staff: listStaff(db),
        moderators: listNetworkModerators(db),
      });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/moderator/:address", (req, res, next) => {
    try {
      requireKey();
      const db = state();
      const role = currentRole(db);
      if (!canAppointMod(role)) {
        return res.status(403).json({ error: "admin privilege required" });
      }
      const address = String(req.params.address || "").trim();
      if (SUPER_ADMINS.has(address)) {
        return res.status(400).json({ error: "cannot revoke super admin" });
      }
      const grant = {
        op: "revoke",
        address,
        role: "moderator",
        by: ctx.session.publicKey,
        at: Date.now(),
      };
      grant.signature = signRoleGrant(ctx.session.secretKey, grant);
      if (!applyRoleGrant(db, grant)) {
        return res.status(400).json({ error: "could not apply revoke" });
      }
      persist(db);
      res.json({
        ok: true,
        address,
        grant,
        staff: listStaff(db),
        moderators: listNetworkModerators(db),
      });
    } catch (error) {
      next(error);
    }
  });


  app.post("/api/posts/:id/sticky", (req, res, next) => {
    try {
      requireKey();
      const db = state();
      const role = currentRole(db);
      if (!canModerate(role)) {
        return res.status(403).json({ error: "moderator privilege required" });
      }
      const post = db.posts.find((p) => p.id === req.params.id);
      if (!post) return res.status(404).json({ error: "not found" });
      post.sticky = Boolean(req.body?.sticky);
      persist(db);
      res.json({ ok: true, post });
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


  app.get("/api/claim-node", (req, res) => {
    try {
      requireKey();
      const db = state();
      const role = currentRole(db);
      if (!canClaimNode(role)) {
        return res.status(403).json({
          error: "claim_node is only for node admin / super_admin on this forum process",
          code: "FORBIDDEN",
        });
      }
      const canRun = Boolean(db.stake?.canRunNode);
      const status = nodeClaimStatus(ctx.session.publicKey, canRun);
      res.json({ ok: true, role, stake: db.stake, nodeClaim: status });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  });

  /**
   * Local node-operator reward (31 lamports XPi / day) after 48h continuous eligibility.
   * Not an on-chain tx until the contract ships claim_node.
   */
  app.post("/api/claim-node", async (req, res, next) => {
    try {
      requireKey();
      const db = state();
      const role = currentRole(db);
      if (!canClaimNode(role)) {
        return res.status(403).json({
          error: "Only node admin / super_admin can use claim_node",
          code: "FORBIDDEN",
        });
      }
      // refresh chain stake
      let chain;
      try {
        chain = await readOnChain(ctx.session.secretKey);
      } catch {
        chain = { xlm: "0", stake: db.stake?.staked || "0", pending: db.stake?.pending || "0" };
      }
      const { stakeSnapshot } = await import("../stellar/stake.js");
      const snap = stakeSnapshot({
        address: ctx.session.publicKey,
        xlm: chain.xlm,
        staked: chain.stake,
        pending: chain.pending,
        xpi: chain.xpi || chain.pending,
        topicFee: config.topicFee,
      });
      db.stake = snap;
      persist(db);
      touchEligibility(ctx.session.publicKey, Boolean(snap.canRunNode));
      const status = nodeClaimStatus(ctx.session.publicKey, Boolean(snap.canRunNode));
      if (!status.canClaimNow) {
        return res.status(400).json({
          error: !snap.canRunNode
            ? "Need ≥31.4 XLM and ≥0.0314 XPi on-chain eligibility to claim node reward"
            : !status.ready48h
              ? `Keep eligibility for ${status.needHours}h (now ${status.hoursHeld}h)`
              : "Already claimed in the last 24h",
          code: "NOT_READY",
          nodeClaim: status,
          stake: snap,
        });
      }
      const after = recordNodeClaim(ctx.session.publicKey);
      res.json({
        ok: true,
        claimed: after.rewardXpi,
        lamports: after.rewardLamports,
        nodeClaim: after,
        stake: snap,
        onChain: false,
        note: after.note,
      });
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
