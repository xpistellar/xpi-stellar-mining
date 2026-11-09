import { startMesh } from "./mesh.js";

const mainLayout = document.querySelector("#main-layout");
const viewIndex = document.querySelector("#view-index");
const viewCategory = document.querySelector("#view-category");
const viewAdmin = document.querySelector("#view-admin");
const feed = document.querySelector("#feed");
const stakeEl = document.querySelector("#stake");
const nodeEl = document.querySelector("#node");
const composer = document.querySelector("#composer");
const balanceEl = document.querySelector("#balance");
const roleBadge = document.querySelector("#role-badge");
const navHome = document.querySelector("#nav-home");
const navAdmin = document.querySelector("#nav-admin");
const bodyTa = document.querySelector("#composer-body");
const mdPreview = document.querySelector("#md-preview");

let mesh;
let myRole = "guest";
let loggedIn = false;
let meshConnected = false;
let currentCategory = null;
let canPost = false;
let showPreview = false;
let pendingSecret = null;
let buyXlmUrl = "https://stellarterm.com/buy-crypto?crypto=xlm&network=stellar";
let networkHashLocal = "";

/** Canonical in-app paths (hash router) */
function topicPath(categoryId, postId) {
  return `#/forum/${encodeURIComponent(categoryId || "general")}/${encodeURIComponent(postId)}`;
}
function categoryPath(categoryId) {
  return `#/forum/${encodeURIComponent(categoryId || "general")}`;
}
function tagPath(tag) {
  return `#/tag/${encodeURIComponent(String(tag || "").replace(/^#/, ""))}`;
}
function parseHashRoute() {
  const h = (location.hash || "").replace(/^#/, "");
  // /forum/:cat/:postId?
  let m = h.match(/^\/?forum\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (m) return { type: "forum", categoryId: decodeURIComponent(m[1]), postId: m[2] ? decodeURIComponent(m[2]) : null };
  m = h.match(/^\/?tag\/([^/]+)\/?$/);
  if (m) return { type: "tag", tag: decodeURIComponent(m[1]) };
  return { type: "home" };
}
async function navigateFromHash() {
  const route = parseHashRoute();
  if (route.type === "home") {
    showView("index");
    if (loggedIn) {
      await loadCategories();
      await loadHomeRankings();
    } else {
      await loadPublicBoard();
    }
    return;
  }
  if (route.type === "tag") {
    showView("index");
    const tagInput = document.querySelector("#search-tag");
    if (tagInput) tagInput.value = route.tag;
    if (loggedIn) {
      document.querySelector("#search-btn")?.click();
    } else {
      await loadPublicBoard();
      // filter public posts by tag client-side
      try {
        const board = await api("/api/public/board");
        const posts = (board.posts || []).filter((p) =>
          (p.tags || []).map((x) => String(x).toLowerCase()).includes(route.tag.toLowerCase())
        );
        renderPublicForum({ ...board, posts });
      } catch { /* */ }
    }
    return;
  }
  if (route.type === "forum") {
    await openCategory(route.categoryId, route.categoryId);
    if (route.postId) {
      setTimeout(() => openTopicDetail(route.postId, route.categoryId), 200);
    }
  }
}
window.addEventListener("hashchange", () => {
  navigateFromHash().catch(console.warn);
});


function openModal(id) {
  const el = document.querySelector("#" + id);
  if (el) el.hidden = false;
}
function closeModal(id) {
  const el = document.querySelector("#" + id);
  if (el) el.hidden = true;
}
document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.getAttribute("data-close")));
});
document.querySelectorAll(".modal-backdrop").forEach((bg) => {
  bg.addEventListener("click", (e) => {
    if (e.target === bg) bg.hidden = true;
  });
});

function setConnectUI(connected, detail = "") {
  meshConnected = connected;
  const dot = document.querySelector("#connect-dot");
  const banner = document.querySelector("#mesh-banner");
  const text = document.querySelector("#mesh-banner-text");
  const btn = document.querySelector("#mesh-banner-connect");
  if (dot) dot.classList.toggle("on", connected);
  // Banner stays visible as a status strip; only the *error* wording is for unset identity.
  if (banner) banner.hidden = false;
  if (text) {
    if (connected) {
      text.textContent =
        detail ||
        "Mesh identity OK on this node. Other peers are optional — one node is enough to read/post locally.";
      banner.classList.add("mesh-ok");
      banner.classList.remove("mesh-warn");
      if (btn) btn.hidden = true;
    } else {
      text.textContent =
        detail ||
        "No mesh identity on this node yet. Use Connect (paste hash + signaling) or Create network. You do NOT need a second node for this step.";
      banner.classList.add("mesh-warn");
      banner.classList.remove("mesh-ok");
      if (btn) btn.hidden = false;
    }
  }
}

function setAuthNav() {
  const login = document.querySelector("#nav-login");
  const signup = document.querySelector("#nav-signup");
  const genesis = document.querySelector("#nav-genesis");
  const myAcc = document.querySelector("#nav-admin");
  if (login) {
    login.hidden = loggedIn;
    login.textContent = "Sign in";
  }
  if (signup) signup.hidden = loggedIn;
  if (myAcc) myAcc.hidden = !loggedIn; // My Acc only after sign-in
  // Create network merged into Setup node panel
  if (genesis) genesis.hidden = true;
}


async function refreshSetupNodeStatus() {
  const el = document.querySelector("#setup-node-status");
  try {
    const st = await api("/api/node/status");
    if (!el) return st;
    const owner = st.claimed
      ? `Owner: ${shortKey(st.ownerPublicKey)}${st.isOwner ? " (you)" : ""}`
      : "Owner: not claimed yet — first Sign-in + Claim becomes node admin";
    let accessLine = "";
    try {
      const ac = await api("/api/access/status");
      accessLine = ` · access ${ac.mode}${ac.unlocked ? "" : " (locked)"}`;
      const pub = document.querySelector("#setup-access-public");
      const priv = document.querySelector("#setup-access-private");
      if (pub && priv) {
        if (ac.mode === "private") priv.checked = true;
        else pub.checked = true;
      }
    } catch {
      /* */
    }
    el.textContent =
      `Mesh: ${st.networkLabel || "—"} · ${st.networkShort || ""} · signal ${st.signalingUrl || "—"} · ` +
      owner +
      accessLine +
      (st.hardFork ? ` · HARD FORKED from ${(st.forkedFromHash || "").slice(0, 12)}` : " · official/default mesh");
    return st;
  } catch (e) {
    if (el) el.textContent = e.message;
    return null;
  }
}

async function loadSetupNodePanel() {
  const root = document.querySelector("#setup-node-root");
  if (!root) return;
  if (root.dataset.loaded === "1") return;
  const res = await fetch("/panels/setup-node.html", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load setup panel");
  root.innerHTML = await res.text();
  root.dataset.loaded = "1";
  wireSetupNodePanel();
}

function wireSetupNodePanel() {
  // Handlers use optional chaining; re-bind each load once via dataset on root
  document.querySelector("#setup-claim-node")?.addEventListener("click", async () => {
    const msg = document.querySelector("#setup-claim-msg");
    try {
      const out = await api("/api/node/claim", { method: "POST", body: "{}" });
      if (msg) msg.textContent = out.hint || "Claimed.";
      setRoleUI(out.role || myRole);
      await refreshSetupNodeStatus();
    } catch (e) {
      if (msg) msg.textContent = e.message;
    }
  });
  document.querySelector("#setup-stake-xlm-btn")?.addEventListener("click", async () => {
    const msg = document.querySelector("#setup-reward-msg");
    try {
      const xlm = document.querySelector("#setup-stake-xlm")?.value || "31.4";
      const out = await api("/api/stake", { method: "POST", body: JSON.stringify({ xlm }) });
      if (msg) msg.textContent = `Stake submitted. On-chain: ${out.chain?.stake || out.stake?.staked || "…"}`;
    } catch (e) {
      if (msg) msg.textContent = e.message;
    }
  });
  document.querySelector("#setup-stake-xpi-btn")?.addEventListener("click", async () => {
    const msg = document.querySelector("#setup-reward-msg");
    try {
      const st = await api("/api/claim-node");
      if (msg) {
        msg.textContent = st.stake?.canRunNode
          ? `Eligible. Hours: ${st.nodeClaim?.hoursHeld ?? 0}/${st.nodeClaim?.needHours ?? 48}`
          : "Need ≥31.4 XLM + ≥0.0314 XPi on-chain.";
      }
    } catch (e) {
      if (msg) msg.textContent = e.message;
    }
  });
  document.querySelector("#setup-claim-reward")?.addEventListener("click", async () => {
    const msg = document.querySelector("#setup-reward-msg");
    try {
      const out = await api("/api/claim-node", { method: "POST", body: "{}" });
      if (msg) msg.textContent = `Claimed ${out.claimed} XPi (${out.lamports} lamports).`;
    } catch (e) {
      if (msg) msg.textContent = e.message;
    }
  });
  document.querySelector("#setup-access-save")?.addEventListener("click", async () => {
    const msg = document.querySelector("#setup-access-msg");
    try {
      const mode = document.querySelector("#setup-access-private")?.checked ? "private" : "public";
      const password = document.querySelector("#setup-access-password")?.value || "";
      const body = { mode };
      if (password) body.password = password;
      const out = await api("/api/access/config", { method: "PUT", body: JSON.stringify(body) });
      if (msg) msg.textContent = out.hint || `Mode: ${out.mode}`;
    } catch (e) {
      if (msg) msg.textContent = e.message;
    }
  });
  document.querySelector("#setup-moderation-copy-env")?.addEventListener("click", async () => {
    const text =
      "export LOCALMOD_URL=http://127.0.0.1:8000\nnpm start\n\n$env:LOCALMOD_URL = \"http://127.0.0.1:8000\"\nnpm start\n";
    const msg = document.querySelector("#setup-moderation-msg");
    try {
      await navigator.clipboard.writeText(text.replace(/\\n/g, "\n").replace(/\\"/g, '"'));
      if (msg) msg.textContent = "Copied LOCALMOD_URL examples.";
    } catch {
      if (msg) msg.textContent = text;
    }
  });
  document.querySelector("#fork-submit")?.addEventListener("click", async () => {
    const msg = document.querySelector("#fork-msg");
    if (!document.querySelector("#fork-confirm")?.checked) {
      if (msg) msg.textContent = "Check the confirmation box first.";
      return;
    }
    if (!confirm("Hard fork permanently leaves the old mesh. Continue?")) return;
    try {
      const signalingUrl = document.querySelector("#fork-signaling")?.value || "";
      const out = await api("/api/node/hard-fork", {
        method: "POST",
        body: JSON.stringify({
          confirm: true,
          networkLabel: document.querySelector("#fork-label")?.value || "",
          signalingUrl: signalingUrl.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)[0],
          signalingUrls: signalingUrl.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
          networkHash: document.querySelector("#fork-hash")?.value || null,
        }),
      });
      if (msg) {
        msg.textContent = `Forked · ${out.identity?.networkLabel} · ${out.identity?.networkShort}. Reload recommended.`;
      }
      await refreshSetupNodeStatus();
    } catch (e) {
      if (msg) msg.textContent = e.message;
    }
  });
  document.querySelector("#genesis-submit")?.addEventListener("click", async () => {
    const msg = document.querySelector("#genesis-msg");
    try {
      if (!loggedIn) {
        if (msg) msg.textContent = "Sign in first (and stake ≥31.4 XLM on Soroban).";
        openModal("modal-auth");
        return;
      }
      const out = await api("/api/setup/create-private", {
        method: "POST",
        body: JSON.stringify({
          nodeName: document.querySelector("#genesis-node-name")?.value,
          networkLabel: document.querySelector("#genesis-label")?.value,
          signalingUrl:
            document.querySelector("#genesis-signaling")?.value ||
            "https://signal.xgoldmining.com",
          force: true,
        }),
      });
      if (msg) msg.textContent = out.hint || "Private network created.";
      const box = document.querySelector("#genesis-result");
      const hash = document.querySelector("#genesis-result-hash");
      const text = document.querySelector("#genesis-result-text");
      if (box) box.hidden = false;
      if (hash) hash.textContent = out.identity?.networkHash || "";
      if (text) {
        text.textContent = `GENESIS · ${out.identity?.networkShort || ""} · ${out.identity?.nodeName || ""}`;
      }
      setConnectUI(true);
      setAuthNav();
      if (out?.board) {
        renderPublicForum(out.board);
      } else {
        await loadPublicBoard();
      }
      showView("index");
    } catch (e) {
      if (msg) msg.textContent = e.message;
    }
  });
  document.querySelector("#genesis-copy-hash")?.addEventListener("click", async () => {
    const h = document.querySelector("#genesis-result-hash")?.textContent || "";
    try {
      await navigator.clipboard.writeText(h);
    } catch {
      /* */
    }
  });
}

async function openSetupNodePage() {
  showView("setup");
  try {
    // Always reload panel once per page session is OK; allow refresh
    const root = document.querySelector("#setup-node-root");
    if (root) root.dataset.loaded = "";
    await loadSetupNodePanel();
  } catch (e) {
    const root = document.querySelector("#setup-node-root");
    if (root) root.innerHTML = `<p class="meta">${escapeHtml(e.message)}</p>`;
  }
  if (!loggedIn) {
    const st = document.querySelector("#setup-node-status");
    if (st) st.textContent = "Sign in required for claim / create / fork. You can still read the guide links.";
  } else {
    await refreshSetupNodeStatus();
  }
}
async function openSetupNodeModal() {
  return openSetupNodePage();
}

document.querySelector("#nav-setup-node")?.addEventListener("click", () => openSetupNodePage());

document.querySelector("#setup-claim-node")?.addEventListener("click", async () => {
  const msg = document.querySelector("#setup-claim-msg");
  try {
    const out = await api("/api/node/claim", { method: "POST", body: "{}" });
    if (msg) msg.textContent = out.hint || "Claimed.";
    setRoleUI(out.role || myRole);
    await refreshSetupNodeStatus();
  } catch (e) {
    if (msg) msg.textContent = e.message;
  }
});

document.querySelector("#setup-stake-xlm-btn")?.addEventListener("click", async () => {
  const msg = document.querySelector("#setup-reward-msg");
  try {
    const xlm = document.querySelector("#setup-stake-xlm")?.value || "31.4";
    const out = await api("/api/stake", { method: "POST", body: JSON.stringify({ xlm }) });
    if (msg) msg.textContent = `Stake submitted. On-chain stake: ${out.chain?.stake || out.stake?.staked || "…"}`;
  } catch (e) {
    if (msg) msg.textContent = e.message;
  }
});

document.querySelector("#setup-stake-xpi-btn")?.addEventListener("click", async () => {
  const msg = document.querySelector("#setup-reward-msg");
  try {
    // Soft check via claim-node status / stake snapshot (XPi is on-chain balance, not a local stake tx here)
    const st = await api("/api/claim-node");
    const ok = st.stake?.canRunNode;
    if (msg) {
      msg.textContent = ok
        ? `Eligible for node track (XLM + XPi thresholds). Hours held: ${st.nodeClaim?.hoursHeld ?? 0}/${st.nodeClaim?.needHours ?? 48}`
        : "Not eligible yet — need ≥31.4 XLM staked and ≥0.0314 XPi on-chain (Soroban / balances).";
    }
  } catch (e) {
    if (msg) msg.textContent = e.message;
  }
});

document.querySelector("#setup-claim-reward")?.addEventListener("click", async () => {
  const msg = document.querySelector("#setup-reward-msg");
  try {
    const out = await api("/api/claim-node", { method: "POST", body: "{}" });
    if (msg) msg.textContent = `Claimed ${out.claimed} XPi (${out.lamports} lamports).`;
  } catch (e) {
    if (msg) msg.textContent = e.message;
  }
});

document.querySelector("#fork-submit")?.addEventListener("click", async () => {
  const msg = document.querySelector("#fork-msg");
  if (!document.querySelector("#fork-confirm")?.checked) {
    if (msg) msg.textContent = "Check the confirmation box first.";
    return;
  }
  if (!confirm("Hard fork permanently leaves the old mesh. Local data is kept. Continue?")) return;
  try {
    const signalingUrl = document.querySelector("#fork-signaling")?.value || "";
    const out = await api("/api/node/hard-fork", {
      method: "POST",
      body: JSON.stringify({
        confirm: true,
        networkLabel: document.querySelector("#fork-label")?.value || "",
        signalingUrl: signalingUrl.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)[0],
        signalingUrls: signalingUrl.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
        networkHash: document.querySelector("#fork-hash")?.value || null,
      }),
    });
    if (msg) {
      msg.textContent =
        `Forked · ${out.identity?.networkLabel} · ${out.identity?.networkShort} · signal ${out.identity?.signalingUrl}. Reload recommended.`;
    }
    await refreshSetupNodeStatus();
    await refreshFooterInfo?.();
  } catch (e) {
    if (msg) msg.textContent = e.message;
  }
});


document.querySelector("#nav-connect")?.addEventListener("click", async () => {
  try {
    const st = await api("/api/setup/status");
    const sig = st.suggestedSignaling || "http://127.0.0.1:4000";
    const input = document.querySelector("#connect-signaling");
    if (input && !input.value) input.value = sig;
    if (st.networkHash) {
      const h = document.querySelector("#connect-hash");
      if (h && !h.value) h.value = st.networkHash;
    }
  } catch {
    /* */
  }
  openModal("modal-connect");
});
document.querySelector("#mesh-banner-connect")?.addEventListener("click", () => {
  document.querySelector("#nav-connect")?.click();
});
document.querySelector("#nav-login")?.addEventListener("click", () => {
  document.querySelector("#auth-title").textContent = "Sign in";
  document.querySelector("#auth-login-block").hidden = false;
  openModal("modal-auth");
});
document.querySelector("#nav-signup")?.addEventListener("click", () => {
  document.querySelector("#auth-title").textContent = "Sign up / Create wallet";
  document.querySelector("#auth-login-block").hidden = false;
  openModal("modal-auth");
  document.querySelector("#create-wallet-btn")?.focus();
});
document.querySelector("#nav-genesis")?.addEventListener("click", () => openSetupNodeModal());
// legacy
document.querySelector("#nav-genesis-legacy")?.addEventListener("click", async () => {
  try {
    const st = await api("/api/setup/status");
    const sig = st.suggestedSignaling || "http://127.0.0.1:4000";
    const input = document.querySelector("#genesis-signaling");
    if (input && !input.value) input.value = sig;
  } catch {
    /* */
  }
  openModal("modal-genesis");
});

async function finishSetup(body, msgEl, resultBox) {
  if (msgEl) msgEl.textContent = "";
  try {
    const out = await api("/api/setup", { method: "POST", body: JSON.stringify(body) });
    networkHashLocal = out.identity.networkHash;
    setConnectUI(true, out.identity.networkShort);
    setAuthNav();
    if (nodeEl) {
      nodeEl.textContent = `${out.identity.nodeName} · ${out.identity.networkShort}${out.identity.genesis ? " · GENESIS" : ""}`;
    }
    if (resultBox) {
      resultBox.box.hidden = false;
      resultBox.hash.textContent = out.identity.networkHash;
      resultBox.text.textContent =
        (out.hint || "") +
        ` · node=${out.identity.nodeName} · short=${out.identity.networkShort}` +
        (out.identity.genesis ? " · GENESIS" : " · JOIN");
    }
    refreshFooterInfo();
    return out;
  } catch (e) {
    if (msgEl) msgEl.textContent = e.message;
    throw e;
  }
}


document.querySelector("#connect-submit")?.addEventListener("click", async () => {
  const msg = document.querySelector("#connect-msg");
  msg.textContent = "";
  const signalingUrl = document.querySelector("#connect-signaling").value.trim();
  const networkHash = document.querySelector("#connect-hash").value.trim();
  try {
    const st = await api("/api/setup/status");
    if (!st.setupRequired) {
      // Already on a mesh — update signaling bootstrap only
      const out = await api("/api/setup/signaling", {
        method: "POST",
        body: JSON.stringify({ signalingUrl }),
      });
      setConnectUI(true);
      msg.textContent = `Signaling updated. Mesh ${out.networkShort || ""} · ${out.signalingUrl}`;
      refreshFooterInfo();
      setTimeout(() => closeModal("modal-connect"), 900);
      return;
    }
    if (!networkHash) {
      msg.textContent = "networkHash required to join (or Create network if you are genesis).";
      return;
    }
    await finishSetup(
      {
        mode: "join",
        nodeName: document.querySelector("#connect-node-name").value,
        networkHash,
        signalingUrl,
      },
      msg,
      null
    );
    msg.textContent = "Joined mesh. Next: Sign in / Sign up to open the disk and sync.";
    setTimeout(() => closeModal("modal-connect"), 800);
  } catch (e) {
    msg.textContent = e.message;
  }
});

document.querySelector("#genesis-submit")?.addEventListener("click", async () => {
  const msg = document.querySelector("#genesis-msg");
  try {
    if (!loggedIn) {
      if (msg) msg.textContent = "Sign in first. Creating a private network requires ≥31.4 XLM staked on Soroban.";
      openModal("modal-auth");
      return;
    }
    const out = await api("/api/setup/create-private", {
      method: "POST",
      body: JSON.stringify({
        nodeName: document.querySelector("#genesis-node-name").value,
        networkLabel: document.querySelector("#genesis-label").value,
        signalingUrl:
          document.querySelector("#genesis-signaling").value ||
          "https://signal.xgoldmining.com",
        force: true,
      }),
    });
    if (msg) msg.textContent = out.hint || "Private network created.";
    const box = document.querySelector("#genesis-result");
    const hash = document.querySelector("#genesis-result-hash");
    const text = document.querySelector("#genesis-result-text");
    if (box) box.hidden = false;
    if (hash) hash.textContent = out.identity?.networkHash || "";
    if (text) {
      text.textContent = `GENESIS · ${out.identity?.networkShort || ""} · ${out.identity?.nodeName || ""}`;
    }
    setConnectUI(true);
    setAuthNav();
    // Show default seeded board immediately (no peers required for genesis)
    if (out?.board) {
      renderPublicForum(out.board);
      if (out.board.rankings) {
        fillLeaderList("#home-top-view", out.board.rankings.topView);
        fillLeaderList("#home-top-like", out.board.rankings.topLike);
        fillLeaderList("#home-top-trend", out.board.rankings.topTrend);
        fillTagCloud(out.board.rankings.topTags || []);
      }
    } else {
      await loadPublicBoard();
    }
    showView("index");
    if (msg) {
      msg.textContent =
        "Network created. Default XPi topics are on the home page. Sign in to post & sync — signaling can wait until you have peers.";
    }
    // Keep modal open briefly so user can copy hash, then soft-close optional
    setTimeout(() => {
      /* leave modal open for copy hash */
    }, 0);
  } catch {
    /* */
  }
});
document.querySelector("#genesis-copy-hash")?.addEventListener("click", async () => {
  const h = document.querySelector("#genesis-result-hash").textContent;
  try {
    await navigator.clipboard.writeText(h);
  } catch {
    /* */
  }
});

async function loadPublicBoard() {
  try {
    const board = await api("/api/public/board");
    if (!board.setupRequired && (board.networkShort || board.networkHash || board.genesis)) {
      networkHashLocal = board.networkHash || networkHashLocal;
      const label =
        (board.networkLabel || "mesh") +
        " · " +
        (board.networkShort || board.networkHash?.slice(0, 12) || "") +
        (board.genesis ? " · GENESIS" : " · joined");
      setConnectUI(true, `Mesh identity OK: ${label}. Peers optional.`);
      if (nodeEl) {
        nodeEl.textContent = `${board.networkLabel || "node"} · ${board.networkShort || ""}${board.genesis ? " · GENESIS" : ""}`;
      }
    }
    // Rankings for guests from public seed
    if (!loggedIn && board.rankings) {
      fillLeaderList("#home-top-view", board.rankings.topView);
      fillLeaderList("#home-top-like", board.rankings.topLike);
      fillLeaderList("#home-top-trend", board.rankings.topTrend);
      fillTagCloud(board.rankings.topTags || []);
    }
    if (!loggedIn) {
      renderPublicForum(board);
    }
    return board;
  } catch (e) {
    console.warn("public board", e);
    return null;
  }
}

function renderPublicForum(board) {
  const box = document.querySelector("#cat-table");
  if (!box || loggedIn) return;
  const posts = board?.posts || [];
  const cats = board?.categories || [];
  // Build simple section list + recent topics
  const sections = cats.filter((c) => !c.parentId);
  let html = `<div class="admin-card" style="margin:12px">
    <h3 style="margin-top:0">Default board (read-only until you log in)</h3>
    <p class="meta">Starter XPi & community topics are visible to everyone on this node.
    <strong>Sign in</strong> with a Stellar secret to post, stake, and sync P2P.</p>
    <div class="row">
      <button type="button" id="guest-login">Sign in</button>
      <button type="button" class="secondary" id="guest-signup">Sign up</button>
    </div>
  </div>`;
  html += `<div class="topic-list" style="padding:8px 12px 16px">`;
  const sorted = [...posts].sort((a, b) => (b.sticky ? 1 : 0) - (a.sticky ? 1 : 0) || b.views - a.views);
  for (const p of sorted.slice(0, 20)) {
    const tags = (p.tags || []).map((t) => `#${t}`).join(" ");
    const href = topicPath(p.categoryId || "general", p.id);
    const tagLinks = (p.tags || []).map((tg) => `<a class="tag" href="${tagPath(tg)}">#${escapeHtml(tg)}</a>`).join(" ");
    html += `<article class="topic" data-post-id="${escapeHtml(p.id)}" style="padding:12px 0;border-bottom:1px solid var(--line-soft)">
      <div><a class="title-link" href="${href}"><strong>${escapeHtml(p.title)}</strong></a>
      ${p.sticky ? ' <span class="badge">sticky</span>' : ""}</div>
      <div class="meta"><a href="${categoryPath(p.categoryId || "general")}">${escapeHtml(p.categoryId || "")}</a> · ${p.views || 0} views · ${p.likes || 0} likes · ${tagLinks}</div>
      <p class="meta" style="margin:6px 0 0;max-height:3.2em;overflow:hidden">${escapeHtml(String(p.body || "").slice(0, 220))}…</p>
      <div class="row" style="margin-top:6px"><a class="small secondary button-link" href="${href}">Open / Comment</a></div>
    </article>`;
  }
  html += `</div>`;
  box.innerHTML = html;
  document.querySelector("#guest-login")?.addEventListener("click", () =>
    document.querySelector("#nav-login")?.click()
  );
  document.querySelector("#guest-signup")?.addEventListener("click", () =>
    document.querySelector("#nav-signup")?.click()
  );
}


async function collectLocalPostsForMesh() {
  try {
    if (loggedIn) {
      const data = await api("/api/posts?sort=new");
      return { posts: (data.posts || []).slice(0, 80) };
    }
    const board = await api("/api/public/board");
    return { posts: (board.posts || []).slice(0, 80) };
  } catch {
    return { posts: [] };
  }
}

document.querySelector("#mesh-force-sync")?.addEventListener("click", async () => {
  const btn = document.querySelector("#mesh-force-sync");
  const sync = document.querySelector("#mesh-meter-sync");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Syncing…";
  }
  try {
    if (!mesh?.forceSync) {
      await ensureMeshRunning();
    }
    const result = await mesh?.forceSync?.();
    if (sync) {
      sync.textContent =
        result?.asked > 0
          ? `Force sync: asked ${result.asked} peer channel(s)…`
          : "Force sync: no open channels — waiting for peers (check Signal/Peers)";
    }
    // pull public board refresh
    if (!loggedIn) await loadPublicBoard();
    else {
      if (!viewIndex.hidden) await loadCategories();
      if (!viewCategory.hidden) await refreshTopics();
    }
    updateMeshMeter(mesh?.getStatus?.() || {});
  } catch (e) {
    if (sync) sync.textContent = `Force sync failed: ${e.message}`;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Force sync";
    }
  }
});

function updateMeshMeter(st) {
  const meter = document.querySelector("#mesh-meter");
  if (!meter || !st) return;
  const sig = document.querySelector("#mesh-meter-signal");
  const peers = document.querySelector("#mesh-meter-peers");
  const ch = document.querySelector("#mesh-meter-channels");
  const sync = document.querySelector("#mesh-meter-sync");
  if (sig) sig.textContent = `Signal: ${st.signalState || "—"}` + (st.currentUrl ? ` (${st.currentUrl.replace(/^wss?:\/\//, "").slice(0, 28)})` : "");
  if (peers) peers.textContent = `Peers: ${st.lastPeerCount ?? 0}`;
  if (ch) ch.textContent = `Channels: ${st.openChannels ?? 0}`;
  if (sync) {
    sync.textContent = st.lastSyncAt
      ? `Last sync: ${new Date(st.lastSyncAt).toLocaleTimeString()}`
      : "Last sync: never";
  }
  meter.classList.toggle("is-live", st.signalState === "connected" && (st.openChannels > 0 || st.lastPeerCount > 0));
  meter.classList.toggle("is-warn", st.signalState === "error" || st.signalState === "no-url");
}

/**
 * Start (or restart) mesh whenever this node has identity — even without Sign in.
 * Guest nodes can receive & merge posts; publishing still needs login + stake.
 */
async function ensureMeshRunning() {
  try {
    const health = await api("/api/health");
    if (health.setupRequired || !health.networkHash) return null;
    networkHashLocal = health.networkHash || networkHashLocal;
    const wsList =
      health.signalingWsUrls?.length
        ? health.signalingWsUrls
        : health.signalingUrls?.length
          ? health.signalingUrls
          : [health.signalingWs];
    if (mesh?.stop) {
      try { mesh.stop(); } catch { /* */ }
    }
    mesh = startMesh({
      wsUrl: health.signalingWs,
      wsUrls: wsList,
      nodeId: health.nodeId || `guest-${Math.random().toString(36).slice(2, 8)}`,
      stakeXlm: 0,
      diskGb: 0,
      networkHash: networkHashLocal,
      onStatus: updateMeshMeter,
      onNeedPosts: collectLocalPostsForMesh,
      onPosts: async (payload) => {
        try {
          let out;
          if (!loggedIn) {
            out = await api("/api/sync/public", {
              method: "POST",
              body: JSON.stringify({ posts: payload.posts || [] }),
            });
            await loadPublicBoard();
            await loadGuestForumShell();
          } else {
            out = await api("/api/sync", {
              method: "POST",
              body: JSON.stringify({
                posts: payload.posts || [],
                modActions: payload.modActions || [],
                roleGrants: payload.roleGrants || [],
              }),
            });
            if (!viewIndex.hidden) await loadCategories();
            if (!viewCategory.hidden) await refreshTopics();
          }
          updateMeshMeter({
            ...(mesh?.getStatus?.() || {}),
            lastSyncAt: Date.now(),
          });
          console.info("[mesh] merged", out.accepted, "posts");
        } catch (e) {
          console.warn("[mesh] sync failed", e);
        }
      },
    });
    updateMeshMeter(mesh.getStatus?.() || { signalState: "starting" });
    return mesh;
  } catch (e) {
    console.warn("ensureMeshRunning", e);
    updateMeshMeter({ signalState: "error", lastError: e.message });
    return null;
  }
}

async function loadGuestForumShell() {
  if (loggedIn) return;
  try {
    // Prefer live categories API (no auth) so guest UI matches post-login structure
    const data = await api("/api/categories");
    if (data?.categories?.length) {
      const box = document.querySelector("#cat-table");
      if (!box) return;
      box.innerHTML = "";
      for (const row of data.categories) {
        const c = row.category || row;
        const el = document.createElement("div");
        el.className = "cat-row";
        el.innerHTML = `
          <div>
            <h3></h3>
            <p class="desc"></p>
          </div>
          <div class="cat-stat"><strong></strong>topics</div>
          <div class="cat-stat"><strong></strong>posts</div>
          <div class="cat-last"></div>`;
        el.querySelector("h3").textContent = c.name || c.id;
        el.querySelector(".desc").textContent = c.description || "";
        el.querySelectorAll(".cat-stat strong")[0].textContent = row.topics ?? 0;
        el.querySelectorAll(".cat-stat strong")[1].textContent = row.posts ?? 0;
        el.querySelector(".cat-last").textContent = row.lastPost
          ? new Date(row.lastPost).toLocaleString()
          : "—";
        el.addEventListener("click", () => {
          location.hash = categoryPath(c.id);
          // guest: open category via public board filter
          openGuestCategory(c.id, c.name);
        });
        box.appendChild(el);
      }
      return;
    }
  } catch {
    /* fall back public board list */
  }
}

async function openGuestCategory(categoryId, name) {
  if (loggedIn) {
    await openCategory(categoryId, name);
    return;
  }
  showView("category");
  const crumb = document.querySelector("#crumb-cat");
  if (crumb) crumb.innerHTML = ` / <a href="${categoryPath(categoryId)}">${escapeHtml(name || categoryId)}</a>`;
  const feedEl = document.querySelector("#feed") || document.querySelector("#cat-table");
  // load posts from public board filtered
  try {
    const board = await api("/api/public/board");
    const posts = (board.posts || []).filter(
      (p) => (p.categoryId || "general") === categoryId
    );
    const host = document.querySelector("#feed");
    if (host) {
      host.innerHTML = "";
      if (!posts.length) {
        host.innerHTML = '<p class="meta">No posts in this category on the public snapshot. Peers may sync more after mesh connects.</p>';
      } else {
        for (const p of posts) host.appendChild(renderTopic(p, false));
      }
    }
  } catch (e) {
    console.warn(e);
  }
}


async function checkForumAccessOnBoot() {
  try {
    const ac = await api("/api/access/status");
    if (ac.mode === "private" && !ac.unlocked) {
      openModal("modal-forum-lock");
    }
  } catch {
    /* */
  }
}

/** Boot: forum shell + public seeded board */
async function bootUi() {
  await checkForumAccessOnBoot();

  mainLayout.hidden = false;
  showView("index");
  setAuthNav();
  try {
    const def = await api("/api/public/defaults").catch(() => null);
    if (def?.official) {
      const ch = document.querySelector("#connect-hash");
      const cs = document.querySelector("#connect-signaling");
      if (ch && !ch.value) ch.value = def.official.networkHash || "";
      if (cs && !cs.value) cs.value = def.official.signalingUrl || "";
      const gs = document.querySelector("#genesis-signaling");
      if (gs && !gs.value) gs.value = def.official.signalingUrl || "";
    }
    const st = await api("/api/setup/status");
    const sig = st.suggestedSignaling || "http://127.0.0.1:4000";
    ["#connect-signaling", "#genesis-signaling"].forEach((sel) => {
      const el = document.querySelector(sel);
      if (el && !el.value) el.value = sig;
    });
    if (!st.setupRequired && st.networkHash) {
      networkHashLocal = st.networkHash;
      setConnectUI(true);
      if (nodeEl) {
        nodeEl.textContent = `${st.nodeName || "node"} · ${st.networkShort || ""}${st.genesis ? " · GENESIS" : ""}`;
      }
    } else {
      setConnectUI(false);
    }
  } catch {
    setConnectUI(false);
  }
  await loadPublicBoard();
  try {
    const st2 = await api("/api/setup/status");
    if (!st2.setupRequired && st2.networkHash) {
      networkHashLocal = st2.networkHash;
      setConnectUI(
        true,
        `Mesh identity OK: ${st2.networkLabel || st2.networkShort || "mesh"} · ${st2.networkShort || ""}${st2.genesis ? " · GENESIS" : ""}. One node is enough.`
      );
      if (nodeEl) {
        nodeEl.textContent = `${st2.nodeName || "node"} · ${st2.networkShort || ""}${st2.genesis ? " · GENESIS" : ""}`;
      }
    }
  } catch { /* */ }
  refreshFooterInfo();
}

bootUi();



const turndown = window.TurndownService ? new window.TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
}) : null;

function renderMarkdown(src) {
  const raw = window.marked?.parse?.(src || "", { breaks: true }) || escapeHtml(src || "");
  return window.DOMPurify?.sanitize?.(raw, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "iframe", "object", "embed", "form", "input", "script"],
    FORBID_ATTR: ["style", "onerror", "onclick", "onload"],
  }) || escapeHtml(src || "");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || "request failed");
    err.code = data.code;
    err.status = res.status;
    err.payload = data;
    if (data.code === "FORUM_LOCKED") {
      try {
        openModal("modal-forum-lock");
      } catch {
        /* */
      }
    }
    throw err;
  }
  return data;
}

function shortKey(pk) {
  if (!pk) return "—";
  return `${pk.slice(0, 6)}…${pk.slice(-4)}`;
}

function canModUI() {
  // Network moderation only (not node-local admin)
  return myRole === "moderator" || myRole === "super_admin";
}
function canAdminUI() {
  // Appoint mods: super_admin only
  return myRole === "super_admin";
}
function canNodeAdminUI() {
  return myRole === "admin" || myRole === "super_admin";
}

function setRoleUI(role) {
  myRole = normalizeRole(role || "guest");
  window.__role = myRole;
  if (roleBadge) {
    if (!role || role === "guest") {
      roleBadge.hidden = true;
    } else {
      roleBadge.hidden = false;
      roleBadge.textContent = String(role).replace("_", " ").toUpperCase();
      roleBadge.className =
        "badge " + (role === "super_admin" ? "super" : role === "moderator" ? "mod" : role === "admin" ? "admin" : "");
    }
  }
  // My Acc is for every signed-in user (setAuthNav owns visibility)
  if (navAdmin) navAdmin.hidden = !loggedIn;
  const label = document.querySelector("#admin-role-label");
  if (label) label.textContent = `Role: ${myRole}`;
  const appoint = document.querySelector("#appoint-box");
  if (appoint) appoint.hidden = !canAdminUI();
  const stickyBox = document.querySelector("#composer-sticky");
  if (stickyBox?.parentElement) stickyBox.parentElement.hidden = !canModUI();
}

function showView(name) {
  const viewSetup = document.querySelector("#view-setup");
  viewIndex.hidden = name !== "index";
  viewCategory.hidden = name !== "category";
  viewAdmin.hidden = name !== "admin";
  if (viewSetup) viewSetup.hidden = name !== "setup";
  const homeLb = document.querySelector("#home-leaderboards");
  if (homeLb) homeLb.hidden = name !== "index";
}

function list(id, items, pick) {
  const el = document.querySelector(id);
  if (!el) return;
  el.innerHTML = "";
  for (const item of items || []) {
    // posts: real internal links
    if (item && item.id && item.title) {
      el.appendChild(
        leaderLink(
          item,
          typeof pick === "function" ? pick(item) : `${item.views || 0} views`
        )
      );
    } else {
      const li = document.createElement("li");
      li.textContent = typeof pick === "function" ? pick(item) : String(item);
      el.appendChild(li);
    }
  }
  if (!items?.length) el.innerHTML = "<li>—</li>";
}

function renderCatRow(row, isChild) {
  const c = row.category;
  const el = document.createElement("div");
  el.className = "cat-row" + (isChild ? " is-child" : "");
  el.innerHTML = `
    <div class="forum-ico">${isChild ? "📁" : "📂"}</div>
    <div>
      <h3></h3>
      <p class="desc"></p>
    </div>
    <div class="cat-stat"><strong></strong>topics</div>
    <div class="cat-stat"><strong></strong>posts</div>
    <div class="cat-last"></div>`;
  el.querySelector("h3").textContent = c.name;
  el.querySelector(".desc").textContent = c.description || "";
  el.querySelectorAll(".cat-stat strong")[0].textContent = row.topics;
  el.querySelectorAll(".cat-stat strong")[1].textContent = row.posts;
  el.querySelector(".cat-last").textContent = row.lastPost
    ? `${row.lastPost.title}\n${shortKey(row.lastPost.author)}`
    : "—";
  el.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    location.hash = categoryPath(c.id).replace(/^#/, "#");
    openCategory(c.id, c.name);
  });
  return el;
}

async function loadCategories() {
  const data = await api("/api/categories");
  if (data.role) setRoleUI(data.role);
  const table = document.querySelector("#cat-table");
  table.innerHTML = "";

  const head = document.createElement("div");
  head.className = "cat-table-head";
  head.innerHTML =
    "<div></div><div>Forum</div><div style='text-align:center'>Topics</div><div style='text-align:center'>Posts</div><div>Last post</div>";
  table.appendChild(head);

  const tree = data.tree || [];
  for (const root of tree) {
    const section = document.createElement("div");
    section.className = "cat-section";
    const hasChildren = (root.children || []).length > 0;
    // Root with children = category header (phpBB section)
    if (hasChildren) {
      const title = document.createElement("div");
      title.className = "cat-section-title";
      title.textContent = root.category.name;
      section.appendChild(title);
      for (const child of root.children) {
        section.appendChild(renderCatRow(child, true));
        for (const grand of child.children || []) {
          section.appendChild(renderCatRow(grand, true));
        }
      }
    } else {
      section.appendChild(renderCatRow(root, false));
    }
    table.appendChild(section);
  }
}

async function openCategory(categoryId, name) {
  currentCategory = categoryId;
  document.querySelector("#composer-cat").value = categoryId;
  const crumb = document.querySelector("#crumb-cat");
  if (crumb) {
    crumb.innerHTML = ` / <a href="${categoryPath(categoryId)}">${escapeHtml(name || categoryId)}</a>`;
  }
  const expected = categoryPath(categoryId);
  if (!location.hash.startsWith(expected) && !location.hash.includes("/" + encodeURIComponent(categoryId) + "/")) {
    // only set category hash if not already on a topic deep link
    if (!parseHashRoute().postId) location.hash = expected;
  }
  showView("category");
  await refreshTopics();
}

async function refreshTopics() {
  if (!currentCategory) return;
  const data = await api(`/api/posts?category=${encodeURIComponent(currentCategory)}`);
  if (data.role) setRoleUI(data.role);
  document.querySelector("#cat-title").textContent =
    data.category?.name || currentCategory;
  document.querySelector("#cat-desc").textContent = data.category?.description || "";
  composer.hidden = !canPost;

  feed.innerHTML = "";
  if (!data.posts?.length) {
    feed.innerHTML = '<p class="meta" style="padding:14px">No topics in this category yet.</p>';
  }
  for (const post of data.posts) {
    feed.appendChild(renderTopic(post));
  }
  list("#top-view", data.rankings.topView);
  list("#top-like", data.rankings.topLike);
  list("#top-trend", data.rankings.topTrend);
}


/** Ranking item: single internal link only (no duplicate title/stat text). */
function leaderLink(post, _statText) {
  const a = document.createElement("a");
  a.href = topicPath(post.categoryId || "general", post.id);
  a.textContent = post.title || post.id;
  a.title = post.title || post.id;
  const li = document.createElement("li");
  li.appendChild(a);
  return li;
}

function fillLeaderList(sel, posts, fmt) {
  const ol = document.querySelector(sel);
  if (!ol) return;
  ol.innerHTML = "";
  if (!posts?.length) {
    ol.innerHTML = "<li class='meta'>—</li>";
    return;
  }
  for (const p of posts.slice(0, 10)) {
    ol.appendChild(leaderLink(p, typeof fmt === "function" ? fmt(p) : ""));
  }
}

function fillTagCloud(tags) {
  const box = document.querySelector("#home-top-tags");
  if (!box) return;
  box.innerHTML = "";
  if (!tags?.length) {
    box.innerHTML = "<span class='meta'>No tags yet</span>";
    return;
  }
  for (const t of tags) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `#${t.tag} (${t.count})`;
    btn.title = `views ${t.views} · likes ${t.likes}`;
    btn.addEventListener("click", () => {
      document.querySelector("#search-tag").value = t.tag;
      document.querySelector("#search-btn")?.click();
    });
    box.appendChild(btn);
  }
}

async function loadHomeRankings() {
  if (!loggedIn) {
    fillLeaderList("#home-top-view", [], () => "");
    fillLeaderList("#home-top-like", [], () => "");
    fillLeaderList("#home-top-trend", [], () => "");
    fillTagCloud([]);
    return;
  }
  try {
    const data = await api("/api/search?sort=trend");
    const r = data.rankings || {};
    fillLeaderList("#home-top-view", r.topView);
    fillLeaderList("#home-top-like", r.topLike, (p) => `${p.likes} likes`);
    fillLeaderList("#home-top-trend", r.topTrend, (p) => `trend · ${p.views}v / ${p.likes}♥`);
    fillTagCloud(r.topTags || []);
  } catch (e) {
    console.warn(e);
  }
}

document.querySelector("#search-btn")?.addEventListener("click", async () => {
  if (!loggedIn) {
    openModal("modal-auth");
    return;
  }
  const q = document.querySelector("#search-q")?.value || "";
  const tag = document.querySelector("#search-tag")?.value || "";
  const sort = document.querySelector("#search-sort")?.value || "trend";
  const params = new URLSearchParams({ q, tag, sort });
  try {
    const data = await api(`/api/search?${params}`);
    const box = document.querySelector("#search-results");
    box.hidden = false;
    box.innerHTML = "";
    if (!data.posts?.length) {
      box.innerHTML = "<p class='meta'>No matches.</p>";
    } else {
      for (const post of data.posts) box.appendChild(renderTopic(post));
    }
    const r = data.rankings || {};
    fillLeaderList("#home-top-view", r.topView);
    fillLeaderList("#home-top-like", r.topLike, (p) => `${p.likes} likes`);
    fillLeaderList("#home-top-trend", r.topTrend, (p) => "trending");
    fillTagCloud(r.topTags || []);
  } catch (e) {
    alert(e.message);
  }
});


function tagsHtml(tags) {
  if (!tags?.length) return "";
  return tags
    .map(
      (tg) =>
        `<a class="tag" href="${tagPath(tg)}">#${escapeHtml(tg)}</a>`
    )
    .join("");
}


async function openTopicDetail(postId, categoryId) {
  let post = null;
  try {
    if (loggedIn) {
      const data = await api(`/api/posts/${encodeURIComponent(postId)}`);
      post = data.post;
      try {
        await api(`/api/posts/${encodeURIComponent(postId)}/view`, { method: "POST", body: "{}" });
      } catch { /* */ }
    } else {
      const board = await api("/api/public/board");
      post = (board.posts || []).find((p) => p.id === postId) || null;
    }
  } catch (e) {
    alert(e.message);
    return;
  }
  if (!post) {
    alert("Topic not found");
    return;
  }
  const cat = post.categoryId || categoryId || "general";
  if (loggedIn) {
    await openCategory(cat, cat);
  } else {
    showView("index");
  }

  // Expand panel under matching row or inject detail card in feed
  const host = loggedIn ? feed : document.querySelector("#cat-table");
  if (!host) return;
  let existing = document.querySelector("#topic-detail-panel");
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.id = "topic-detail-panel";
  panel.className = "topic-detail panel";
  const comments = Array.isArray(post.comments) ? post.comments : [];
  panel.innerHTML = `
    <div class="board-head">
      <h2><a href="${topicPath(cat, post.id)}">${escapeHtml(post.title)}</a></h2>
      <p class="meta"><a href="${categoryPath(cat)}">${escapeHtml(cat)}</a> · ${shortKey(post.author)} · ${post.views || 0} views · ${post.likes || 0} likes · ${comments.length} comments</p>
    </div>
    <div class="md-preview topic-body" style="padding:12px 14px"></div>
    <div class="tag-row" style="padding:0 14px 8px">${tagsHtml(post.tags)}</div>
    <div class="comments-section" style="padding:12px 14px 18px">
      <h3>Comments</h3>
      <div class="comments-list"></div>
      <form class="comment-form" style="margin-top:12px">
        <textarea name="body" rows="3" maxlength="4000" placeholder="Write a comment (Markdown)…" style="width:100%"></textarea>
        <div class="row" style="margin-top:8px">
          <button type="submit">Post comment</button>
          <button type="button" class="secondary detail-close">Close</button>
          <a class="meta" href="${topicPath(cat, post.id)}" style="margin-left:auto">Permalink</a>
        </div>
        <p class="comment-msg meta"></p>
      </form>
    </div>`;
  panel.querySelector(".topic-body").innerHTML = renderMarkdown(post.body || "");
  const list = panel.querySelector(".comments-list");
  function paintComments(listData) {
    list.innerHTML = "";
    if (!listData.length) {
      list.innerHTML = '<p class="meta">No comments yet — start the thread.</p>';
      return;
    }
    for (const c of listData) {
      const item = document.createElement("div");
      item.className = "comment-item";
      item.innerHTML = `<div class="meta">${shortKey(c.author)} · ${new Date(c.createdAt).toLocaleString()}</div>
        <div class="md-preview" style="padding:6px 0;border:0;background:transparent"></div>`;
      item.querySelector(".md-preview").innerHTML = renderMarkdown(c.body || "");
      list.appendChild(item);
    }
  }
  paintComments(comments);
  panel.querySelector(".detail-close")?.addEventListener("click", () => panel.remove());
  panel.querySelector(".comment-form")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const msg = panel.querySelector(".comment-msg");
    if (!loggedIn) {
      msg.textContent = "Sign in to comment.";
      openModal("modal-auth");
      return;
    }
    const body = new FormData(ev.currentTarget).get("body");
    try {
      const out = await api(`/api/posts/${encodeURIComponent(post.id)}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      msg.textContent = "Comment posted.";
      ev.currentTarget.reset();
      // refresh comments
      const refreshed = await api(`/api/posts/${encodeURIComponent(post.id)}`);
      paintComments(refreshed.post.comments || []);
      if (loggedIn) await refreshTopics();
    } catch (e) {
      msg.textContent = e.message;
    }
  });
  host.prepend(panel);
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderTopic(post, adminMode = false) {
  const row = document.createElement("article");
  if (post?.id) row.dataset.postId = post.id;
  row.className =
    "topic" +
    (post.sticky ? " sticky-topic" : "") +
    (post.status === "hidden" ? " hidden-post" : "");
  const statusTag =
    post.status === "hidden" ? " · [HIDDEN]" : post.status === "deleted" ? " · [DELETED]" : "";
  const pin = post.sticky ? '<span class="pin">📌</span>' : "";
  const cat = post.categoryId || "general";
  const href = topicPath(cat, post.id);
  const nComments = Array.isArray(post.comments) ? post.comments.length : Number(post.commentCount || 0);
  row.innerHTML = `
    <div>
      <h3>${pin}<a class="title-link" href="${href}"></a></h3>
      <div class="body-preview md-preview" style="min-height:0;padding:4px 0;border:0;background:transparent"></div>
      <p class="meta"></p>
      <div class="tag-row"></div>
      <div class="topic-comments" hidden></div>
    </div>
    <div class="stats"></div>
    <div class="actions"></div>`;
  const titleA = row.querySelector(".title-link");
  titleA.textContent = post.title + statusTag;
  titleA.addEventListener("click", (e) => {
    // hash navigation handles open; still prevent full reload
    // allow default hash change
  });
  const previewSrc = (post.body || "").slice(0, 280);
  row.querySelector(".body-preview").innerHTML = renderMarkdown(previewSrc);
  row.querySelector(".meta").innerHTML =
    `${shortKey(post.author)} · ${new Date(post.createdAt).toLocaleString()} · <a href="${categoryPath(cat)}">${escapeHtml(cat)}</a>`;
  row.querySelector(".tag-row").innerHTML = tagsHtml(post.tags);
  row.querySelector(".stats").innerHTML =
    `${post.views || 0} views<br>${post.likes || 0} likes<br>${nComments} comments`;

  const actions = row.querySelector(".actions");
  if (!adminMode) {
    const openBtn = document.createElement("a");
    openBtn.className = "small secondary button-link";
    openBtn.href = href;
    openBtn.textContent = "Open";
    actions.appendChild(openBtn);

    const likeBtn = document.createElement("button");
    likeBtn.type = "button";
    likeBtn.className = "small secondary";
    likeBtn.textContent = "Like";
    likeBtn.addEventListener("click", async () => {
      try {
        const out = await api(`/api/posts/${post.id}/like`, { method: "POST", body: "{}" });
        balanceEl.textContent = `Wallet ${out.balance} XLM`;
        mesh?.publish([out.post]);
        await refreshTopics();
      } catch (err) {
        balanceEl.textContent = err.message;
      }
    });
    actions.appendChild(likeBtn);

    const commentBtn = document.createElement("button");
    commentBtn.type = "button";
    commentBtn.className = "small";
    commentBtn.textContent = `Comment (${nComments})`;
    commentBtn.addEventListener("click", async () => {
      location.hash = href.replace(/^#/, "#");
      await openTopicDetail(post.id, cat);
    });
    actions.appendChild(commentBtn);

    if (canModUI() && post.author) {
      const banBtn = document.createElement("button");
      banBtn.type = "button";
      banBtn.className = "small danger";
      banBtn.hidden = true; // admin-only control — unhide for staff
      banBtn.textContent = "Ban 7d";
      banBtn.title = "Ban this author from commenting for 7 days";
      banBtn.hidden = false;
      banBtn.addEventListener("click", async () => {
        if (!confirm(`Ban ${shortKey(post.author)} from comments for 7 days?`)) return;
        try {
          await api("/api/admin/ban", {
            method: "POST",
            body: JSON.stringify({ publicKey: post.author, reason: "ban from topic actions" }),
          });
          alert("Comment ban applied (7 days).");
        } catch (e) {
          alert(e.message);
        }
      });
      actions.appendChild(banBtn);
    }
  }

  if (canModUI()) {
    for (const [label, act, cls] of [
      ["Hide", "hide", "small secondary"],
      ["Delete", "delete", "small danger"],
      ["Restore", "restore", "small"],
    ]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = cls;
      b.textContent = label;
      b.addEventListener("click", async () => {
        try {
          const reason = act === "restore" ? "" : prompt("Reason (optional):") || "";
          const out = await api(`/api/posts/${post.id}/moderate`, {
            method: "POST",
            body: JSON.stringify({ action: act, reason }),
          });
          mesh?.publish([out.post], [out.action]);
          if (adminMode) await loadAdminPosts();
          else await refreshTopics();
        } catch (e) {
          alert(e.message);
        }
      });
      actions.appendChild(b);
    }
    const st = document.createElement("button");
    st.type = "button";
    st.className = "small";
    st.textContent = post.sticky ? "Unpin" : "Pin";
    st.addEventListener("click", async () => {
      try {
        const out = await api(`/api/posts/${post.id}/sticky`, {
          method: "POST",
          body: JSON.stringify({ sticky: !post.sticky }),
        });
        mesh?.publish([out.post]);
        if (adminMode) await loadAdminPosts();
        else await refreshTopics();
      } catch (e) {
        alert(e.message);
      }
    });
    actions.appendChild(st);
  }

  if (!adminMode) {
    row.addEventListener(
      "pointerenter",
      async () => {
        try {
          const out = await api(`/api/posts/${post.id}/view`, { method: "POST", body: "{}" });
          mesh?.publish([out.post]);
        } catch {
          /* */
        }
      },
      { once: true }
    );
  }
  return row;
}

async function loadStaff() {
  try {
    const data = await api("/api/admin/staff");
    const ul = document.querySelector("#staff-list");
    ul.innerHTML = "";
    const mods = data.moderators || [];
    const supers = (data.staff || []).filter(
      (s) => s.role === "super_admin" || s.role === "admin"
    );
    for (const s of [...supers, ...mods]) {
      const li = document.createElement("li");
      const left = document.createElement("span");
      left.textContent = `${s.role}${s.scope ? " [" + s.scope + "]" : ""}: ${shortKey(s.publicKey)}`;
      li.appendChild(left);
      if (s.role === "moderator" && canAdminUI()) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "small danger";
        btn.textContent = "Remove";
        btn.addEventListener("click", async () => {
          try {
            const out = await api(`/api/admin/moderator/${s.publicKey}`, { method: "DELETE" });
            if (out.grant) mesh?.publish([], [], [out.grant]);
            document.querySelector("#appoint-msg").textContent = "Moderator removed.";
            await loadStaff();
          } catch (err) {
            document.querySelector("#appoint-msg").textContent = err.message;
          }
        });
        li.appendChild(btn);
      }
      ul.appendChild(li);
    }
  } catch (err) {
    document.querySelector("#appoint-msg").textContent = err.message;
  }
}

async function loadAdminCategories() {
  const ul = document.querySelector("#cat-admin-list");
  if (!ul) return;
  ul.innerHTML = '<li class="meta">Loading…</li>';
  try {
    const data = await api("/api/categories");
    ul.innerHTML = "";
    const rows = data.categories || [];
    if (!rows.length) {
      ul.innerHTML = '<li class="meta">No categories yet — add one above.</li>';
      return;
    }
    for (const row of rows) {
      const c = row.category || row;
      if (!c?.id) continue;
      const li = document.createElement("li");
      const parent = c.parentId ? ` ← ${c.parentId}` : " (root)";
      const topics = row.topics != null ? row.topics : 0;
      li.innerHTML = `<span><strong>${escapeHtml(c.id)}</strong> — ${escapeHtml(c.name || c.id)}${parent} · ${topics} topics</span>`;
      if ((canAdminUI() || canNodeAdminUI?.() || myRole === "admin" || myRole === "super_admin") && c.id !== "general") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "small danger";
        btn.textContent = "Delete";
        btn.addEventListener("click", async () => {
          try {
            await api(`/api/admin/categories/${c.id}`, { method: "DELETE" });
            await loadAdminCategories();
            await loadCategories().catch(() => {});
          } catch (e) {
            alert(e.message);
          }
        });
        li.appendChild(btn);
      }
      ul.appendChild(li);
    }
    // Fill category filter select if present
    const sel = document.querySelector("#post-filter-category");
    if (sel) {
      const cur = sel.value;
      sel.innerHTML = '<option value="">All categories</option>';
      for (const row of rows) {
        const c = row.category || row;
        if (!c?.id) continue;
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name || c.id;
        sel.appendChild(opt);
      }
      if (cur) sel.value = cur;
    }
  } catch (e) {
    ul.innerHTML = `<li class="meta">${escapeHtml(e.message)}</li>`;
  }
}


async function loadBans() {
  const ul = document.querySelector("#ban-list");
  if (!ul) return;
  try {
    const data = await api("/api/admin/bans");
    ul.innerHTML = "";
    for (const b of data.bans || []) {
      const li = document.createElement("li");
      const left = document.createElement("span");
      left.textContent = `${shortKey(b.publicKey)} · until ${new Date(b.until).toLocaleString()}`;
      li.appendChild(left);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "small secondary";
      btn.textContent = "Remove ban";
      btn.addEventListener("click", async () => {
        try {
          await api(`/api/admin/ban/${encodeURIComponent(b.publicKey)}`, { method: "DELETE" });
          await loadBans();
        } catch (e) {
          alert(e.message);
        }
      });
      li.appendChild(btn);
      ul.appendChild(li);
    }
    if (!(data.bans || []).length) ul.innerHTML = '<li class="meta">No active bans</li>';
  } catch (e) {
    ul.innerHTML = `<li class="meta">${escapeHtml(e.message)}</li>`;
  }
}

document.querySelector("#ban-btn")?.addEventListener("click", async () => {
  const publicKey = document.querySelector("#ban-address")?.value?.trim();
  const msg = document.querySelector("#appoint-msg");
  try {
    await api("/api/admin/ban", {
      method: "POST",
      body: JSON.stringify({ publicKey, reason: "comment ban 7 days" }),
    });
    if (msg) msg.textContent = "User banned from comments for 7 days.";
    document.querySelector("#ban-address").value = "";
    await loadBans();
  } catch (e) {
    if (msg) msg.textContent = e.message;
  }
});

async function loadAdminPosts() {
  const box = document.querySelector("#admin-posts");
  if (!box) return;
  box.innerHTML = '<p class="meta">Loading posts…</p>';
  const role = normalizeRole(myRole || window.__role || "user");
  const isStaff = role === "admin" || role === "super_admin" || role === "moderator";
  try {
    let posts = [];
    const status = document.querySelector("#post-filter-status")?.value || "";
    const categoryId = document.querySelector("#post-filter-category")?.value || "";
    if (isStaff) {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (categoryId) params.set("categoryId", categoryId);
      const q = params.toString() ? `?${params}` : "";
      try {
        const data = await api(`/api/admin/posts${q}`);
        posts = data.posts || [];
      } catch (err) {
        // fallback: public/session posts list
        const data = await api("/api/posts?sort=new");
        posts = data.posts || [];
        if (categoryId) {
          posts = posts.filter((p) => (p.categoryId || "general") === categoryId);
        }
        if (status === "mine" || role === "admin") {
          posts = posts.filter((p) => p.author === window.__publicKey);
        }
        console.warn("admin/posts fallback", err.message);
      }
    } else {
      const data = await api("/api/posts?sort=new");
      posts = (data.posts || []).filter((p) => p.author === window.__publicKey);
      if (categoryId) {
        posts = posts.filter((p) => (p.categoryId || "general") === categoryId);
      }
    }
    box.innerHTML = "";
    if (!posts.length) {
      box.innerHTML =
        '<p class="meta">No posts match this filter. Seed topics appear after first login opens the disk, or sync from peers.</p>';
      return;
    }
    for (const post of posts) {
      const row = renderTopic(post, isStaff && (role === "super_admin" || role === "moderator"));
      // show category badge
      const meta = row.querySelector(".meta");
      if (meta && post.categoryId) {
        meta.innerHTML += ` · <a href="${categoryPath(post.categoryId)}">${escapeHtml(post.categoryId)}</a>`;
      }
      box.appendChild(row);
    }
  } catch (e) {
    box.innerHTML = `<p class="meta">${escapeHtml(e.message)}</p>`;
  }
}

async function loadAdminSignaling() {
  const ta = document.querySelector("#admin-signaling-list");
  const msg = document.querySelector("#admin-signaling-msg");
  if (!ta) return;
  try {
    const data = await api("/api/admin/signaling");
    ta.value = (data.signalingUrls || []).join("\n");
    if (msg) msg.textContent = data.networkShort
      ? `Mesh ${data.networkShort}${data.genesis ? " · GENESIS" : ""} · ${data.signalingUrls?.length || 0} URL`
      : "";
  } catch (e) {
    if (msg) msg.textContent = e.message;
  }
}

function normalizeRole(r) {
  return String(r || "user")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}


const MYACC_FILES = {
  user: "/myacc/user.html",
  moderator: "/myacc/moderator.html",
  admin: "/myacc/admin.html",
  super_admin: "/myacc/super_admin.html",
};

async function loadMyAccTemplate(role) {
  const r = normalizeRole(role);
  const path = MYACC_FILES[r] || MYACC_FILES.user;
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load My Account template: " + path);
  return res.text();
}

function wireMyAccControls(role) {
  document.querySelector("#stake-btn")?.addEventListener("click", async () => {
    try {
      const xlm = document.querySelector("#stake-amount")?.value;
      const out = await api("/api/stake", { method: "POST", body: JSON.stringify({ xlm }) });
      if (balanceEl) balanceEl.textContent = `Wallet ${out.chain?.xlm ?? out.balance ?? ""} XLM`;
      const reward = document.querySelector("#reward");
      if (reward) reward.textContent = "Stake submitted.";
    } catch (err) {
      const reward = document.querySelector("#reward");
      if (reward) reward.textContent = err.message;
    }
  });
  document.querySelector("#unstake-btn")?.addEventListener("click", async () => {
    try {
      const xlm = document.querySelector("#stake-amount")?.value;
      const out = await api("/api/unstake", { method: "POST", body: JSON.stringify({ xlm }) });
      if (balanceEl) balanceEl.textContent = `Wallet ${out.chain?.xlm ?? ""} XLM`;
    } catch (err) {
      const reward = document.querySelector("#reward");
      if (reward) reward.textContent = err.message;
    }
  });
  document.querySelector("#claim")?.addEventListener("click", async () => {
    try {
      const out = await api("/api/claim", { method: "POST", body: "{}" });
      const reward = document.querySelector("#reward");
      if (reward) reward.textContent = `claim ${out.tx?.hash || "ok"}`;
    } catch (err) {
      const reward = document.querySelector("#reward");
      if (reward) reward.textContent = err.message;
    }
  });
  document.querySelector("#claim-node-btn")?.addEventListener("click", async () => {
    const msg = document.querySelector("#claim-node-msg");
    try {
      const out = await api("/api/claim-node", { method: "POST", body: "{}" });
      if (msg) msg.textContent = `Claimed ${out.claimed} XPi (${out.lamports} lamports).`;
    } catch (e) {
      if (msg) msg.textContent = e.message;
    }
  });
  document.querySelector("#claim-node-refresh")?.addEventListener("click", () => refreshClaimNode());
  document.querySelector("#appoint-btn")?.addEventListener("click", async () => {
    const msg = document.querySelector("#appoint-msg");
    try {
      const address = document.querySelector("#mod-address")?.value?.trim();
      const out = await api("/api/admin/moderator", {
        method: "POST",
        body: JSON.stringify({ address }),
      });
      if (msg) msg.textContent = "Moderator appointed.";
      if (out.grant) mesh?.publish([], [], [out.grant]);
      await loadStaff();
    } catch (e) {
      if (msg) msg.textContent = e.message;
    }
  });
  document.querySelector("#ban-btn")?.addEventListener("click", async () => {
    const msg = document.querySelector("#appoint-msg");
    try {
      const publicKey = document.querySelector("#ban-address")?.value?.trim();
      await api("/api/admin/ban", {
        method: "POST",
        body: JSON.stringify({ publicKey, reason: "comment ban 7 days" }),
      });
      if (msg) msg.textContent = "User banned from comments for 7 days.";
      await loadBans();
    } catch (e) {
      if (msg) msg.textContent = e.message;
    }
  });
  document.querySelector("#admin-signaling-save")?.addEventListener("click", async () => {
    const ta = document.querySelector("#admin-signaling-list");
    const msg = document.querySelector("#admin-signaling-msg");
    if (!ta) return;
    const urls = ta.value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    try {
      const out = await api("/api/admin/signaling", {
        method: "PUT",
        body: JSON.stringify({ signalingUrls: urls }),
      });
      ta.value = (out.signalingUrls || []).join("\n");
      if (msg) msg.textContent = out.hint || "Multi-signaling saved.";
    } catch (e) {
      if (msg) msg.textContent = e.message;
    }
  });
  document.querySelector("#cat-add-btn")?.addEventListener("click", async () => {
    try {
      await api("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({
          id: document.querySelector("#cat-new-id")?.value,
          name: document.querySelector("#cat-new-name")?.value,
          parentId: document.querySelector("#cat-new-parent")?.value || null,
        }),
      });
      await loadAdminCategories();
      await loadCategories();
    } catch (e) {
      alert(e.message);
    }
  });
  document.querySelector("#post-filter-btn")?.addEventListener("click", () => loadAdminPosts());
  document.querySelector("#post-filter-category")?.addEventListener("change", () => loadAdminPosts());
  document.querySelector("#post-filter-status")?.addEventListener("change", () => loadAdminPosts());
}

async function openAdmin() {
  if (!loggedIn) {
    openModal("modal-auth");
    const title = document.querySelector("#auth-title");
    if (title) title.textContent = "Sign in";
    return;
  }
  showView("admin");
  const role = normalizeRole(myRole || window.__role || "user");
  myRole = role;
  window.__role = role;

  const root = document.querySelector("#myacc-root");
  if (!root) {
    console.error("missing #myacc-root");
    return;
  }
  root.innerHTML = `<p class="meta" style="padding:16px">Loading My Account (${role})…</p>`;
  try {
    root.innerHTML = await loadMyAccTemplate(role);
  } catch (e) {
    root.innerHTML = `<p class="meta" style="padding:16px">${escapeHtml(e.message)}</p>`;
    return;
  }
  wireMyAccControls(role);

  try {
    const boot = await api("/api/myacc/bootstrap");
    applyMyAccBootstrap(boot, role);
  } catch (e) {
    console.error("myacc bootstrap", e);
    const msg = escapeHtml(e.message || "bootstrap failed");
    for (const id of ["cat-admin-list", "staff-list", "ban-list", "admin-posts"]) {
      const el = document.querySelector("#" + id);
      if (el) el.innerHTML = `<li class="meta" style="color:var(--danger)">${msg}</li>`;
    }
    const ta = document.querySelector("#admin-signaling-list");
    if (ta) ta.placeholder = e.message;
    const am = document.querySelector("#appoint-msg");
    if (am) am.textContent = e.message;
  }

  if (role === "admin" || role === "super_admin") {
    await refreshClaimNode().catch(() => {});
  }
}

function applyMyAccBootstrap(boot, role) {
  const r = normalizeRole(role || boot.role || "user");
  myRole = r;
  window.__role = r;
  window.__publicKey = boot.publicKey || window.__publicKey;

  // Signaling
  const ta = document.querySelector("#admin-signaling-list");
  if (ta) {
    const urls = boot.signalingUrls || [];
    ta.value = urls.join("\n");
    const msg = document.querySelector("#admin-signaling-msg");
    if (msg) {
      msg.textContent = urls.length
        ? `${urls.length} signaling URL(s)` + (boot.networkShort ? ` · mesh ${boot.networkShort}` : "")
        : "No signaling URLs — add https://signal.xgoldmining.com and Save";
    }
  }

  // Categories list
  const ul = document.querySelector("#cat-admin-list");
  const catRows = boot.categories || [];
  const catList = boot.categoryList || catRows.map((row) => row.category || row);
  if (ul) {
    ul.innerHTML = "";
    if (!catList.length && !catRows.length) {
      ul.innerHTML = '<li class="meta">No categories — click Add / Edit after filling id + name.</li>';
    } else {
      const rows = catRows.length ? catRows : catList.map((c) => ({ category: c, topics: 0 }));
      for (const row of rows) {
        const c = row.category || row;
        if (!c?.id) continue;
        const li = document.createElement("li");
        const parent = c.parentId ? ` ← ${c.parentId}` : " (root)";
        const topics = row.topics != null ? row.topics : 0;
        li.innerHTML = `<span><strong>${escapeHtml(c.id)}</strong> — ${escapeHtml(c.name || c.id)}${parent} · ${topics} topics</span>`;
        ul.appendChild(li);
      }
    }
  }
  // Category filter
  const sel = document.querySelector("#post-filter-category");
  if (sel) {
    const cur = sel.value;
    sel.innerHTML = '<option value="">All categories</option>';
    const opts = catList.length ? catList : catRows.map((x) => x.category || x);
    for (const c of opts) {
      const id = c.id || c;
      const name = c.name || id;
      if (!id) continue;
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = name;
      sel.appendChild(opt);
    }
    if (cur) sel.value = cur;
  }

  // Staff
  const staffUl = document.querySelector("#staff-list");
  if (staffUl) {
    staffUl.innerHTML = "";
    const staff = boot.staff || [];
    if (!staff.length) {
      staffUl.innerHTML = '<li class="meta">No staff entries</li>';
    } else {
      for (const s of staff) {
        const li = document.createElement("li");
        li.innerHTML = `<span>${escapeHtml(s.role)}${s.scope ? " [" + escapeHtml(s.scope) + "]" : ""}: ${escapeHtml(shortKey(s.publicKey))}</span>`;
        staffUl.appendChild(li);
      }
    }
  }

  // Bans
  const banUl = document.querySelector("#ban-list");
  if (banUl) {
    banUl.innerHTML = "";
    const bans = boot.bans || [];
    if (!bans.length) banUl.innerHTML = '<li class="meta">No active bans</li>';
    else {
      for (const b of bans) {
        const li = document.createElement("li");
        li.textContent = `${shortKey(b.publicKey)} · until ${new Date(b.until).toLocaleString()}`;
        banUl.appendChild(li);
      }
    }
  }

  // Posts
  const box = document.querySelector("#admin-posts");
  if (box) {
    box.innerHTML = "";
    let posts = boot.posts || [];
    if (r === "user" || r === "admin") {
      posts = posts.filter((p) => p.author === boot.publicKey);
    }
    if (!posts.length) {
      box.innerHTML = '<p class="meta">No posts on this node yet. Seed should appear after bootstrap — try Sign in again or Force sync.</p>';
    } else {
      const isMod = r === "super_admin" || r === "moderator";
      for (const post of posts) {
        box.appendChild(renderTopic(post, isMod));
      }
    }
  }
}


document.querySelector("#admin-signaling-save")?.addEventListener("click", async () => {
  const ta = document.querySelector("#admin-signaling-list");
  const msg = document.querySelector("#admin-signaling-msg");
  if (!ta) return;
  const urls = ta.value
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    const out = await api("/api/admin/signaling", {
      method: "PUT",
      body: JSON.stringify({ signalingUrls: urls }),
    });
    ta.value = (out.signalingUrls || []).join("\n");
    if (msg) msg.textContent = out.hint || "Multi-signaling saved.";
  } catch (e) {
    if (msg) msg.textContent = e.message;
  }
});

async function refreshFooterInfo() {
  const el = document.querySelector("#footer-node-info");
  const ver = document.querySelector("#footer-version");
  try {
    const info = await fetch("/api/public/node-info").then((r) => r.json());
    if (ver && info.version) ver.textContent = `v${info.version}`;
    if (!el) return;
    if (info.setupRequired) {
      el.textContent = "Mesh not set up — use Create network or Connect / Join.";
      return;
    }
    const sigs = (info.signalingUrls || []).slice(0, 3).join(" · ") || "—";
    el.textContent =
      `Node ${info.nodeId || "?"} · mesh ${info.networkShort || "?"}` +
      (info.genesis ? " · GENESIS" : "") +
      (info.networkLabel ? ` · ${info.networkLabel}` : "") +
      ` · signal: ${sigs}` +
      ((info.signalingUrls || []).length > 3 ? " …" : "");
  } catch {
    if (el) el.textContent = "Could not load node info.";
  }
}

refreshFooterInfo();

/* Markdown toolbar + paste HTML → MD */
document.querySelector("#md-toolbar")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-md]");
  if (!btn || !bodyTa) return;
  const act = btn.dataset.md;
  const start = bodyTa.selectionStart;
  const end = bodyTa.selectionEnd;
  const val = bodyTa.value;
  const sel = val.slice(start, end) || "text";
  let insert = sel;
  if (act === "bold") insert = `**${sel}**`;
  if (act === "italic") insert = `*${sel}*`;
  if (act === "code") insert = sel.includes("\n") ? "```\n" + sel + "\n```" : "`" + sel + "`";
  if (act === "link") insert = `[${sel}](https://)`;
  if (act === "ul") insert = sel.split("\n").map((l) => `- ${l}`).join("\n");
  if (act === "preview") {
    showPreview = !showPreview;
    mdPreview.hidden = !showPreview;
    if (showPreview) mdPreview.innerHTML = renderMarkdown(bodyTa.value);
    return;
  }
  bodyTa.value = val.slice(0, start) + insert + val.slice(end);
  bodyTa.focus();
});

bodyTa?.addEventListener("paste", (e) => {
  const html = e.clipboardData?.getData("text/html");
  if (html && turndown) {
    e.preventDefault();
    const md = turndown.turndown(html);
    const start = bodyTa.selectionStart;
    const end = bodyTa.selectionEnd;
    bodyTa.value = bodyTa.value.slice(0, start) + md + bodyTa.value.slice(end);
    if (showPreview) mdPreview.innerHTML = renderMarkdown(bodyTa.value);
  }
});
bodyTa?.addEventListener("input", () => {
  if (showPreview) mdPreview.innerHTML = renderMarkdown(bodyTa.value);
});


function showLoginError(msg) {
  const box = document.querySelector("#login-error");
  const text = document.querySelector("#login-error-text");
  if (!box || !text) return;
  if (!msg) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  text.textContent = msg;
}

document.querySelector("#create-wallet-btn")?.addEventListener("click", async () => {
  showLoginError("");
  try {
    const out = await api("/api/wallet/create", { method: "POST", body: "{}" });
    pendingSecret = out.secretKey;
    document.querySelector("#created-pk").textContent = out.publicKey;
    document.querySelector("#created-sk").textContent = out.secretKey;
    document.querySelector("#wallet-created").hidden = false;
    document.querySelector("#login-forms").hidden = true;
  } catch (err) {
    showLoginError(err.message);
  }
});

document.querySelector("#copy-secret")?.addEventListener("click", async () => {
  const sk = document.querySelector("#created-sk")?.textContent || pendingSecret || "";
  try {
    await navigator.clipboard.writeText(sk);
    document.querySelector("#stake").textContent = "Secret copied to clipboard.";
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = sk;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    document.querySelector("#stake").textContent = "Secret copied.";
  }
});

document.querySelector("#confirm-saved")?.addEventListener("click", () => {
  document.querySelector("#wallet-created").hidden = true;
  document.querySelector("#login-forms").hidden = false;
  const input = document.querySelector('#auth-secret');
  if (input && pendingSecret) {
    input.value = pendingSecret;
    input.type = "password";
  }
  document.querySelector("#stake").textContent =
    "Secret filled in — click Sign in. (Clear the clipboard after saving offline.)";
});

document.querySelector("#buy-xlm-btn")?.addEventListener("click", () => {
  window.open(buyXlmUrl, "_blank", "noopener,noreferrer");
});

async function doSessionLogin({ secretKey, resetDisk = false }) {
  const health = await api("/api/health");
  if (health.buyXlmUrl) buyXlmUrl = health.buyXlmUrl;
  if (health.setupRequired) {
    const e = new Error(
      "Mesh not set up. Complete Create network or Connect / Join first."
    );
    e.code = "SETUP_REQUIRED";
    throw e;
  }
  const out = await api("/api/session", {
    method: "POST",
    body: JSON.stringify({
      secretKey,
      resetDisk: resetDisk || undefined,
    }),
  });
  loggedIn = true;
  window.__publicKey = out.publicKey;
  window.__role = out.role || "user";
  setRoleUI(out.role);
  if (out.diskRecreated) {
    console.info("[session] node disk recreated under node-local key");
  }
  setAuthNav();
  canPost = !!(out.stake?.canPost || out.stake?.canComment);
  const stakeHint = document.querySelector("#auth-stake-hint");
  if (stakeHint) {
    const st = out.stake || {};
    stakeHint.textContent =
      `${canPost ? "Comment/post OK (≥31.4 XLM staked). " : "Stake ≥31.4 XLM on Soroban to comment. "}` +
      `${shortKey(out.publicKey)} · role ${out.role}` +
      (st.canRunNode ? " · node-eligible" : "");
  }
  balanceEl.textContent = `Wallet ${out.balance} XLM · staked ${out.stake?.staked || "0"}`;
  if (nodeEl) nodeEl.textContent = out.nodeId || health.nodeId;
  mainLayout.hidden = false;
  closeModal("modal-auth");
  showView("index");

  networkHashLocal = health.networkHash || networkHashLocal || "";
  const wsList =
    health.signalingWsUrls?.length
      ? health.signalingWsUrls
      : health.signalingUrls?.length
        ? health.signalingUrls
        : [health.signalingWs];
  if (mesh?.stop) { try { mesh.stop(); } catch { /* */ } }
  mesh = startMesh({
    wsUrl: health.signalingWs,
    wsUrls: wsList,
    nodeId: health.nodeId,
    stakeXlm: Number(out.stake?.staked) || 0,
    diskGb: 0,
    networkHash: networkHashLocal,
    onStatus: updateMeshMeter,
    onNeedPosts: collectLocalPostsForMesh,
    onPosts: async (payload) => {
      await api("/api/sync", {
        method: "POST",
        body: JSON.stringify({
          posts: payload.posts || [],
          modActions: payload.modActions || [],
          roleGrants: payload.roleGrants || [],
        }),
      });
      if (!viewIndex.hidden) await loadCategories();
      if (!viewCategory.hidden) await refreshTopics();
      if (!viewAdmin.hidden) {
        await loadStaff();
        await loadAdminPosts();
        await loadAdminSignaling();
      }
    },
  });
  await loadCategories();
  refreshFooterInfo();
  return out;
}

document.querySelector("#session-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const secretKey = document.querySelector("#auth-secret")?.value;
  showLoginError("");
  try {
    await doSessionLogin({
      secretKey,
      resetDisk: false,
    });
  } catch (err) {
    const msg = err.message || String(err);
    stakeEl.textContent = msg;
    if (err.code === "SETUP_REQUIRED" || /setup mesh|SETUP_REQUIRED/i.test(msg)) {
      showLoginError(msg + " — Use Connect or Create network in the top bar first.");
      return;
    }
    if (err.code === "DISK_AUTH_FAIL" || /DISK_AUTH|authenticate data|Unsupported state|node disk key/i.test(msg)) {
      // Auto-retry once with resetDisk — server also auto-heals; this is a safety path
      try {
        showLoginError("Repairing node disk (legacy encryption)…");
        await doSessionLogin({
          secretKey: document.querySelector("#auth-secret")?.value,
          resetDisk: true,
        });
        return;
      } catch (e2) {
        showLoginError(
          (e2.message || msg) +
            " — Any Stellar wallet can sign in. Disk uses a node key (not your secret). Delete ./data and restart if needed."
        );
        return;
      }
    }
    showLoginError(msg);
  }
});

composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fd = new FormData(composer);
  const msg = document.querySelector("#composer-msg");
  try {
    const out = await api("/api/posts", {
      method: "POST",
      body: JSON.stringify({
        title: fd.get("title"),
        body: fd.get("body"),
        categoryId: fd.get("categoryId") || currentCategory || "general",
        tags: fd.get("tags"),
        sticky: document.querySelector("#composer-sticky")?.checked || false,
      }),
    });
    balanceEl.textContent = `Wallet ${out.balance} XLM`;
    msg.textContent = "Published.";
    mesh?.publish([out.post]);
    composer.reset();
    document.querySelector("#composer-cat").value = currentCategory || "general";
    showPreview = false;
    mdPreview.hidden = true;
    await refreshTopics();
  } catch (err) {
    msg.textContent = err.message;
  }
});

document.querySelector("#appoint-btn")?.addEventListener("click", async () => {
  const address = document.querySelector("#mod-address").value.trim();
  const msg = document.querySelector("#appoint-msg");
  try {
    const out = await api("/api/admin/moderator", {
      method: "POST",
      body: JSON.stringify({ address }),
    });
    if (out.grant) mesh?.publish([], [], [out.grant]);
    msg.textContent = "Moderator appointed.";
    document.querySelector("#mod-address").value = "";
    await loadStaff();
  } catch (err) {
    msg.textContent = err.message;
  }
});

document.querySelector("#cat-add-btn")?.addEventListener("click", async () => {
  try {
    await api("/api/admin/categories", {
      method: "POST",
      body: JSON.stringify({
        id: document.querySelector("#cat-new-id").value,
        name: document.querySelector("#cat-new-name").value,
        parentId: document.querySelector("#cat-new-parent").value || null,
      }),
    });
    document.querySelector("#cat-new-id").value = "";
    document.querySelector("#cat-new-name").value = "";
    document.querySelector("#cat-new-parent").value = "";
    await loadAdminCategories();
    await loadCategories();
  } catch (e) {
    alert(e.message);
  }
});

document.querySelector("#post-filter-btn")?.addEventListener("click", () => loadAdminPosts());
  document.querySelector("#post-filter-category")?.addEventListener("change", () => loadAdminPosts());
  document.querySelector("#post-filter-status")?.addEventListener("change", () => loadAdminPosts());
document.querySelector("#back-index")?.addEventListener("click", async (e) => {
  e.preventDefault();
  showView("index");
  await loadCategories();
  await loadHomeRankings();
});
navHome?.addEventListener("click", async () => {
  showView("index");
  await loadCategories();
});
navAdmin?.addEventListener("click", () => openAdmin());

document.querySelector("#claim")?.addEventListener("click", async () => {
  try {
    const out = await api("/api/claim", { method: "POST", body: "{}" });
    document.querySelector("#reward").textContent = `claim ${out.tx?.hash || "ok"}`;
  } catch (err) {
    document.querySelector("#reward").textContent = err.message;
  }
});
document.querySelector("#stake-btn")?.addEventListener("click", async () => {
  try {
    const xlm = document.querySelector("#stake-amount").value;
    const out = await api("/api/stake", { method: "POST", body: JSON.stringify({ xlm }) });
    balanceEl.textContent = `Wallet ${out.chain?.xlm ?? ""} XLM`;
  } catch (err) {
    document.querySelector("#reward").textContent = err.message;
  }
});
document.querySelector("#unstake-btn")?.addEventListener("click", async () => {
  try {
    const xlm = document.querySelector("#stake-amount").value;
    const out = await api("/api/unstake", { method: "POST", body: JSON.stringify({ xlm }) });
    balanceEl.textContent = `Wallet ${out.chain?.xlm ?? ""} XLM`;
  } catch (err) {
    document.querySelector("#reward").textContent = err.message;
  }
});


document.querySelector("#forum-unlock-btn")?.addEventListener("click", async () => {
  const msg = document.querySelector("#forum-unlock-msg");
  try {
    const password = document.querySelector("#forum-unlock-password")?.value || "";
    await api("/api/access/unlock", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    if (msg) msg.textContent = "Unlocked.";
    closeModal("modal-forum-lock");
    await loadPublicBoard().catch(() => {});
    await loadGuestForumShell().catch(() => {});
    if (loggedIn) await loadCategories().catch(() => {});
  } catch (e) {
    if (msg) msg.textContent = e.message;
  }
});

document.querySelector("#setup-access-save")?.addEventListener("click", async () => {
  const msg = document.querySelector("#setup-access-msg");
  try {
    const mode = document.querySelector("#setup-access-private")?.checked
      ? "private"
      : "public";
    const password = document.querySelector("#setup-access-password")?.value || "";
    const body = { mode };
    if (password) body.password = password;
    const out = await api("/api/access/config", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    if (msg) msg.textContent = out.hint || `Mode: ${out.mode}`;
    await refreshSetupNodeStatus?.();
  } catch (e) {
    if (msg) msg.textContent = e.message;
  }
});


document.querySelector("#setup-moderation-copy-env")?.addEventListener("click", async () => {
  const text =
    "# Linux/macOS\nexport LOCALMOD_URL=http://127.0.0.1:8000\nnpm start\n\n# Windows PowerShell\n$env:LOCALMOD_URL = \"http://127.0.0.1:8000\"\nnpm start\n";
  const msg = document.querySelector("#setup-moderation-msg");
  try {
    await navigator.clipboard.writeText(text);
    if (msg) msg.textContent = "Copied LOCALMOD_URL examples to clipboard.";
  } catch {
    if (msg) msg.textContent = text;
  }
});

document.querySelector("#footer-setup-node")?.addEventListener("click", (e) => {
  e.preventDefault();
  document.querySelector("#nav-setup-node")?.click();
});
