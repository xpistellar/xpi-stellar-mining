import { startMesh } from "./mesh.js";

const feed = document.querySelector("#feed");
const stakeEl = document.querySelector("#stake");
const nodeEl = document.querySelector("#node");
const composer = document.querySelector("#composer");
const balanceEl = document.querySelector("#balance");
let mesh;

async function api(path, options) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function list(id, items, pick) {
  const el = document.querySelector(id);
  el.innerHTML = "";
  for (const item of items || []) {
    const li = document.createElement("li");
    li.textContent = pick(item);
    el.appendChild(li);
  }
  if (!items?.length) el.innerHTML = "<li>—</li>";
}

async function refresh() {
  const data = await api("/api/posts");
  feed.innerHTML = "";
  for (const post of data.posts) {
    const card = document.createElement("article");
    card.className = "panel post";
    card.innerHTML = `
      <h3></h3>
      <p class="meta"></p>
      <p></p>
      <div class="row">
        <button type="button">Like · 0.0000001</button>
        <span class="meta"></span>
      </div>`;
    card.querySelector("h3").textContent = post.title;
    card.querySelector("p.meta").textContent =
      `${post.author} · ${post.views} views · ${post.likes} likes · claimed ${post.claimedViews || 0}`;
    card.querySelector("p:nth-of-type(2)").textContent = post.body;
    card.querySelector("button").addEventListener("click", async () => {
      try {
        const out = await api(`/api/posts/${post.id}/like`, { method: "POST", body: "{}" });
        balanceEl.textContent = `Ví ${out.balance} XLM`;
        mesh?.publish([out.post]);
        await refresh();
      } catch (err) {
        balanceEl.textContent = err.message;
      }
    });
    card.addEventListener("pointerenter", async () => {
      try {
        const out = await api(`/api/posts/${post.id}/view`, { method: "POST", body: "{}" });
        mesh?.publish([out.post]);
      } catch {
        /* view is best-effort */
      }
    }, { once: true });
    feed.appendChild(card);
  }
  list("#top-view", data.rankings.topView, (p) => `${p.title} (${p.views})`);
  list("#top-like", data.rankings.topLike, (p) => `${p.title} (${p.likes})`);
  list("#top-trend", data.rankings.topTrend, (p) => p.title);
  if (data.stake?.canPost) composer.hidden = false;
}

document.querySelector("#session").addEventListener("submit", async (event) => {
  event.preventDefault();
  const fd = new FormData(event.currentTarget);
  try {
    const health = await api("/api/health");
    const out = await api("/api/session", {
      method: "POST",
      body: JSON.stringify({
        secretKey: fd.get("secretKey"),
        diskGb: Number(fd.get("diskGb")),
      }),
    });
    stakeEl.textContent = `${out.stake.canPost ? "Đủ quyền viết. " : "Chưa đủ quyền viết. "}${out.stake.address} · stake ${out.stake.staked} XLM · pending ${out.stake.pending} · ví ${out.balance} · disk ảo ${out.diskFile.path} = ${out.diskFile.gb} GB (${out.diskFile.bytes} byte, file thưa như vmdk)`;
    balanceEl.textContent = `Ví ${out.balance} XLM · stake ${out.stake.staked} · pending ${out.pending}`;
    composer.hidden = !out.stake.canPost;
    mesh = startMesh({
      wsUrl: health.signalingWs,
      nodeId: health.nodeId,
      stakeXlm: Number(out.stake.xlm) || 0,
      diskGb: out.stake.diskGb,
      onPosts: async (posts) => {
        await api("/api/sync", { method: "POST", body: JSON.stringify({ posts }) });
        await refresh();
      },
    });
    await refresh();
  } catch (err) {
    stakeEl.textContent = err.message;
  }
});

composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fd = new FormData(composer);
  const msg = document.querySelector("#composer-msg");
  try {
    const out = await api("/api/posts", {
      method: "POST",
      body: JSON.stringify({ title: fd.get("title"), body: fd.get("body") }),
    });
    balanceEl.textContent = `Ví ${out.balance} XLM`;
    msg.textContent = "Đã đăng (phí local). Contract này không có pay_for_topic.";
    mesh?.publish([out.post]);
    composer.reset();
    await refresh();
  } catch (err) {
    msg.textContent = err.message;
  }
});

document.querySelector("#claim").addEventListener("click", async () => {
  try {
    const out = await api("/api/claim", { method: "POST", body: "{}" });
    document.querySelector("#reward").textContent = `claim ${out.tx.hash}`;
  } catch (err) {
    document.querySelector("#reward").textContent = err.message;
  }
});

document.querySelector("#stake-btn").addEventListener("click", async () => {
  try {
    const xlm = document.querySelector("#stake-amount").value;
    const out = await api("/api/stake", { method: "POST", body: JSON.stringify({ xlm }) });
    document.querySelector("#reward").textContent = `stake ${out.tx.hash} · còn trong contract ${out.chain.stake} XLM`;
    balanceEl.textContent = `Ví ${out.chain.xlm} XLM · pending ${out.chain.pending}`;
  } catch (err) {
    document.querySelector("#reward").textContent = err.message;
  }
});

document.querySelector("#unstake-btn").addEventListener("click", async () => {
  try {
    const xlm = document.querySelector("#stake-amount").value;
    const out = await api("/api/unstake", { method: "POST", body: JSON.stringify({ xlm }) });
    document.querySelector("#reward").textContent = `unstake ${out.tx.hash} · còn ${out.chain.stake} XLM`;
  } catch (err) {
    document.querySelector("#reward").textContent = err.message;
  }
});

const health = await api("/api/health");
nodeEl.textContent = `${health.nodeId} · ${health.network} · contract ${health.contractId || "chưa cấu hình"}`;
await refresh();
