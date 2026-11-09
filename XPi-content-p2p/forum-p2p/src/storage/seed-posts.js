/**
 * Seed starter topics (English) — XPi homepage content + Reddit-style community posts.
 * Runs once per disk when db.seedVersion !== SEED_VERSION.
 */

export const SEED_VERSION = "xpi-en-v1";

const AUTHOR = "XPi-Official";
const NOW = Date.now();
const day = 864e5;

function post(partial) {
  return {
    sticky: false,
    likes: 0,
    views: 0,
    earned: "0",
    claimedViews: 0,
    status: "active",
    signature: "seed-local",
    moderatedBy: null,
    moderatedAt: null,
    modReason: null,
    author: AUTHOR,
    comments: [],
    ...partial,
  };
}

/** 10 long-form XPi topics from official homepage themes */
export function xpiTopics() {
  const base = NOW - 12 * day;
  return [
    post({
      id: "seed-xpi-intro",
      categoryId: "stellar",
      title: "What is XPi? Digital Gold of Humanity on Stellar",
      tags: ["xpi", "stellar", "digital-gold", "introduction"],
      sticky: true,
      views: 12840,
      likes: 312,
      createdAt: base,
      body: `**XPi** is a scarce digital asset on the **Stellar** network, designed as long-horizon “digital gold.”

- **Hard-capped supply** on the order of ~63 million XPi  
- **Distribution**: 21 XPi per day from the distributor wallet — roughly a **~7,000-year** schedule  
- **Self-custody**: you hold your own Stellar private keys (no KYC required to stake)  
- **Settlement**: Soroban smart contracts on Stellar mainnet  

XPi is **not** legal tender. Value is set by the market. Always verify the live contract on a Stellar explorer before interacting.

**Tagline:** Scarce asset · Self-custody private keys · Multi-millennium distribution.`,
    }),
    post({
      id: "seed-xpi-tokenomics",
      categoryId: "stellar",
      title: "XPi Tokenomics: Fixed Supply, 21 XPi/Day, Team Allocation",
      tags: ["xpi", "tokenomics", "supply"],
      views: 9420,
      likes: 201,
      createdAt: base + 1 * day,
      body: `### Supply philosophy

XPi rejects open-ended inflation. Total supply is **fixed**. New distribution follows a strict schedule of **21 XPi per day** from the distributor wallet — not an unbounded mint.

### Team allocation (~15%)

The team allocation is framed as **network protection**: limiting pure whale pump-and-dump dynamics, not as a short-term liquidity dump. Community members should still verify on-chain balances and vesting behavior themselves.

### What “scarce” means here

Scarcity is **schedule scarcity** (slow emission) plus a **hard cap**, not a marketing slogan. Compare emission rate to Bitcoin’s halving culture: XPi’s daily 21 is intentionally glacial relative to typical altcoin emissions.

### Verify

Inspect issuer, distributor, and contract IDs on a public explorer. Prefer primary sources (GitHub + on-chain) over screenshots.`,
    }),
    post({
      id: "seed-xpi-staking",
      categoryId: "stellar",
      title: "How to Stake XLM and Claim XPi (Min 31.4 XLM)",
      tags: ["staking", "xlm", "claim", "how-to"],
      views: 15602,
      likes: 445,
      createdAt: base + 2 * day,
      body: `### Requirements

- A **Stellar** account on **public mainnet**
- At least **31.4 XLM** available to stake (plus a little extra for fees)
- Your **secret key** stays local (browser/app/node) — never paste it into untrusted sites

### Flow

1. Open official staking UI or this forum node’s stake panel  
2. **Stake** XLM into the live Soroban contract (≥ 31.4 XLM)  
3. Leave stake active; rewards accrue per contract rules  
4. **Claim** XPi when ready  
5. **Unstake** returns XLM to your wallet (subject to contract timing)

### Continuous stake gate

Claim Game and related features may require **continuous stake** for a window (e.g. 48 hours) — this raises the cost of sybil farming.

### Safety

Always confirm **contract ID** matches documentation before signing. This is not investment advice.`,
    }),
    post({
      id: "seed-xpi-contract",
      categoryId: "stellar",
      title: "Verify the Soroban Contract & Issuer On-Chain",
      tags: ["soroban", "contract", "security", "verify"],
      views: 7210,
      likes: 188,
      createdAt: base + 3 * day,
      body: `### Why verify?

Phishing UIs can point at look-alike contracts. Your keys sign **whatever contract ID the UI embeds**.

### Reference identifiers (from public docs)

- **Contract**: \`CDQ4OO3FU3CBNVWZX2GDU4BQQNQFAHBITTXULTVIECY4OMJGTM33M73H\`
- **Issuer**: \`GDOFJEZ3FUWAC2EVHPRMJPSWPOD3KJF7FTXFZIERFFPB2VMTRQLZFUEF\`

Cross-check against the official GitHub repository and Stellar expert / explorer pages.

### Checklist

1. Contract ID in the app matches the repo README  
2. Network is **Public** mainnet (not testnet)  
3. Simulation succeeds before submit  
4. You understand stake / unstake / claim methods

Never share your \`S...\` secret. Loss is permanent.`,
    }),
    post({
      id: "seed-xpi-philosophy",
      categoryId: "stellar",
      title: "Philosophy: Built for Thousands of Years, Not One Cycle",
      tags: ["philosophy", "xpi", "long-term"],
      views: 6105,
      likes: 276,
      createdAt: base + 4 * day,
      body: `XPi’s thesis is deliberately unfashionable in a market that optimizes for quarterly narratives:

> **21 XPi every day. Nearly 7,000 years of distribution. Fixed total supply. Private keys in your hands.**

That is the entire pitch — not a promise of price, but a **design constraint**.

### Homage and seriousness

The name nods to unfinished dreams of broad participation, made **economically serious** via stake, scarcity, and self-custody.

### What it is not

- Not a bank  
- Not legal tender  
- Not a guaranteed return  

It is a **Stellar-native scarce asset** with a slow faucet and optional P2P social layer on top.`,
    }),
    post({
      id: "seed-xpi-claim-content",
      categoryId: "stellar",
      title: "Claim Content: Topic Fees, Likes, View Milestones",
      tags: ["claim-content", "forum", "fees", "views"],
      views: 5340,
      likes: 142,
      createdAt: base + 5 * day,
      body: `### Content economy (design)

- **Topic fee** (example default): \`0.0000021\` XPi-class units locally / on-chain where implemented  
- **Like fee** (example): \`0.0000001\`  
- **View milestone**: 1,000,000 views (oracle-attested where enabled)  
- **Min disk to write**: 100 GB committed virtual disk on full nodes  

### Anti-sybil alignment

Heavy writers need **stake + disk**. Likes cost a fee. View counts are not pure self-reporting when an oracle path exists.

### P2P vs chain

Heavy content lives in the **P2P / encrypted disk** layer. The chain stores **economic eligibility** and critical counters — a practical split for decentralization and cost.`,
    }),
    post({
      id: "seed-xpi-p2p-nodes",
      categoryId: "tech",
      title: "Running a Full Forum Node (Windows / Ubuntu + WebRTC)",
      tags: ["p2p", "node", "webrtc", "guide"],
      views: 4890,
      likes: 167,
      createdAt: base + 6 * day,
      body: `### Stack

- **Node.js 18+** (20/22 recommended)  
- Local **Express** UI + API  
- **WebRTC** data channels for post metadata sync  
- **Signaling** only for bootstrap (then peer-to-peer)  
- Encrypted **virtual disk** file for posts  

### Ops tips

1. Run \`signaling-standalone\` on a VPS or tunnel for public discovery  
2. Share **networkHash** out-of-band for private meshes  
3. Prefer multi-signaling URLs for failover  
4. \`NODE_INTEGRITY_SECRET\` in production for sealed admin meta  

Android may act as a lightweight relay in broader designs; this package focuses on full desktop/server nodes.`,
    }),
    post({
      id: "seed-xpi-tools",
      categoryId: "stellar",
      title: "Official Tools: Web Staking, Android APK, CLI, Game",
      tags: ["tools", "staking", "android", "cli"],
      views: 11020,
      likes: 298,
      createdAt: base + 7 * day,
      body: `### Start here

1. **Web staking** — fastest path on desktop / mobile browser  
2. **iOS** — Add staking page to Home Screen (PWA via Safari)  
3. **Android APK** — only from official GitHub Releases  
4. **Ubuntu CLI** — Node scripts for stake / unstake / claim  
5. **Windows portable** — see repo Windows folder  
6. **Space mining game** — fun layer; read that folder’s README  

Official repo (example): \`github.com/xpistellar/xpi-stellar-mining\`

Never install APKs from random mirrors.`,
    }),
    post({
      id: "seed-xpi-faq",
      categoryId: "stellar",
      title: "XPi FAQ: KYC, CEX Listings, Minting, Legality",
      tags: ["faq", "xpi", "kyc"],
      views: 8755,
      likes: 190,
      createdAt: base + 8 * day,
      body: `**Is KYC required to stake?** No — self-custody keys.

**Can more XPi be minted beyond the schedule?** Design goal: fixed supply + fixed daily distribution — verify on-chain.

**Will it list on every CEX?** Project materials emphasize Stellar DEX; CEX listings are not a “at all costs” goal.

**Is XLM locked while staking?** Yes while staked; unstake returns XLM per contract rules.

**Can the network be “shut down”?** Full nodes can run on ordinary machines; social/P2P layers are harder to turn off than a single website.

**Is this investment advice?** No. Do your own research; verify contracts.`,
    }),
    post({
      id: "seed-xpi-compare",
      categoryId: "stellar",
      title: "XPi vs Typical Inflationary Tokens (Design Comparison)",
      tags: ["comparison", "tokenomics", "xpi"],
      views: 4022,
      likes: 121,
      createdAt: base + 9 * day,
      body: `| Dimension | XPi (design) | Typical inflationary alt |
|-----------|--------------|---------------------------|
| Supply | Hard cap + slow faucet | Often open emissions |
| Daily distribution | 21 XPi/day narrative | High APY marketing |
| Custody | Self-custody Stellar keys | Often exchange-centric |
| Horizon | Multi-thousand years | Cycle-driven |
| Base chain | Stellar + Soroban | Varies |

This table is **educational**, not a price prediction. Always re-read the live contract parameters.`,
    }),
  ];
}

/** Reddit-inspired community / rules posts */
export function communityTopics() {
  const base = NOW - 5 * day;
  return [
    post({
      id: "seed-rules-rediquette",
      categoryId: "rules",
      title: "Community Standards (Rediquette-inspired)",
      tags: ["rules", "rediquette", "meta"],
      sticky: true,
      views: 2200,
      likes: 96,
      createdAt: base,
      body: `Please follow these norms (inspired by Reddit’s Rediquette):

### Do
- **Search before posting** — duplicates waste everyone’s time  
- **Stay on-topic** for the category  
- **Argue ideas, not people** — no personal attacks  
- **Use descriptive titles**  
- **Credit sources**; link primary material for XPi / Stellar claims  
- **Report** clear spam, scams, or malware  

### Don’t
- Harassment, hate, or illegal content  
- Vote brigading / fake engagement  
- Phishing for secret keys (\`S...\`)  
- Spam, excessive CAPS, or misleading titles  
- Doxxing  

Moderators may hide or remove posts that break these rules. Serious abuse may lose moderator trust network-wide.`,
    }),
    post({
      id: "seed-announce-welcome",
      categoryId: "announcements",
      title: "Welcome to Forum P2P — Mesh, Stake, and Discuss",
      tags: ["announcement", "welcome", "p2p"],
      sticky: true,
      views: 3100,
      likes: 140,
      createdAt: base + 0.5 * day,
      body: `This node is part of a **peer-to-peer forum** mesh:

1. **Connect** with \`networkHash\` + signaling URL  
2. **Log in** with a Stellar secret (local disk encryption key)  
3. **Stake** if you want write privileges under local policy  
4. Read **XPi · Digital Gold** for project primers  

Posts sync over WebRTC between peers that share the same network hash.`,
    }),
    post({
      id: "seed-help-start",
      categoryId: "help",
      title: "Start Here: Connect Mesh, Login, and Signaling FAQ",
      tags: ["help", "signaling", "setup"],
      views: 1800,
      likes: 74,
      createdAt: base + 1 * day,
      body: `**Mesh not connected?** Use the **Connect** button: paste hash + signaling.

**Login error about disk authentication?** The virtual disk is encrypted with your Stellar secret. Use the same secret, or reset the local disk (destroys local posts on this node only).

**No peers?** Signaling must be reachable (VPS / tunnel). Multi-signaling lists try URLs in order.

**Shared PHP hosting?** Backend needs Node.js; signaling needs WebSockets.`,
    }),
    post({
      id: "seed-feedback",
      categoryId: "feedback",
      title: "Feature Requests: Tags, Rankings, and Multi-Signaling",
      tags: ["feedback", "features"],
      views: 980,
      likes: 45,
      createdAt: base + 2 * day,
      body: `This build includes:

- Multi-signaling admin list  
- Forum-first UX (connect / login / genesis in the top bar)  
- English categories and seeded XPi primers  
- Home leaderboards: **Top View · Top Like · Top Trend / Tags**

Reply with concrete UX proposals (what, why, acceptance criteria).`,
    }),
  ];
}

export function ensureSeedPosts(db) {
  if (!db || db.seedVersion === SEED_VERSION) return false;
  if (!Array.isArray(db.posts)) db.posts = [];
  const have = new Set(db.posts.map((p) => p.id));
  let added = 0;
  for (const p of [...xpiTopics(), ...communityTopics()]) {
    if (have.has(p.id)) continue;
    db.posts.push(p);
    have.add(p.id);
    added += 1;
  }
  db.seedVersion = SEED_VERSION;
  return added > 0;
}

export function tagStats(posts, limit = 20) {
  const map = new Map();
  for (const p of posts || []) {
    if (p.status === "deleted") continue;
    for (const t of p.tags || []) {
      const key = String(t).toLowerCase();
      if (!key) continue;
      const row = map.get(key) || { tag: key, count: 0, views: 0, likes: 0 };
      row.count += 1;
      row.views += Number(p.views) || 0;
      row.likes += Number(p.likes) || 0;
      map.set(key, row);
    }
  }
  return [...map.values()]
    .sort((a, b) => b.views + b.likes * 8 - (a.views + a.likes * 8))
    .slice(0, limit);
}
