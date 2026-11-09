# Forum P2P

**Open-source peer-to-peer forum nodes for the [XPi](https://xgoldmining.com) ecosystem on Stellar.**

Anyone with a Stellar wallet can sign in, publish, and run a node. Default installs join the **official genesis mesh**; operators can also spawn a **private network** or **hard-fork** while keeping local data.

| | |
|--|--|
| **License** | See repository license file |
| **Stack** | Node.js · Express · WebRTC · encrypted local disk · Stellar / Soroban |
| **Default mesh** | Official XPi Stellar Forum hash + public signaling |
| **Docs** | [About](docs/ABOUT.md) · [Intro & install](docs/INTRODUCTION.md) · [Moderation](docs/MODERATION-GUIDE.md) · [Economics](docs/ECONOMICS.md) |

---

## Why Forum P2P?

Central platforms rank and monetize attention through ad systems. Forum P2P is a different experiment:

- **Identity** = Stellar keypair (no Google/Facebook required).
- **Each install is a node** — local encrypted store, optional peer sync over WebRTC.
- **Content and node operation** can plug into XPi’s on-chain reward design (stake XLM, eligibility, claim paths).
- **Genesis mesh** for public XPi discussion; **private mesh** for teams and closed groups.

Running a forum node is like running a **small piece of internet infrastructure**: you host discussion, you may earn node/content-related rewards when protocol rules say so, and you are not forced through a single company’s monetization stack.

---

## Quick start

### Requirements

- **Node.js 18+** (20 LTS recommended)
- npm
- Outbound HTTPS for Stellar + signaling (if using the public bootstrap)

### Windows (PowerShell)

```powershell
cd forum-p2p
npm install
$env:PORT = "3000"
# optional stable disk key across redeploys:
# $env:NODE_DISK_SECRET = "long-random-secret"
npm start
```

Open `http://localhost:3000`.

### Ubuntu

```bash
cd forum-p2p
npm install
export PORT=3000
# export NODE_DISK_SECRET="long-random-secret"
npm start
```

### Opalstack (Node.js hosting)

1. Create a **Node.js** application (Node ≥ 18).
2. Deploy this repository into the app directory.
3. `npm install`
4. Set environment: `PORT` (Opalstack-assigned), optional `NODE_DISK_SECRET`, optional `LOCALMOD_URL`.
5. Start via the host’s Node runner (`npm start` / package main).
6. Point domain + HTTPS as per Opalstack docs.
7. **Do not delete `data/`** on redeploy if you want to keep local posts and node keys.

Public WebSocket signaling may use the official bootstrap or a second Node process running the signaling package.

---

## First-time operator checklist

1. Confirm home page loads (rankings + categories).
2. Banner shows **Mesh identity OK** (genesis hash by default).
3. **Sign in** with any Stellar secret key (`S…`).
4. Open **Setup node**: claim node ownership, public/private access, moderation notes, create network / hard fork.
5. **My Acc**: stake / claims by role.
6. Public nodes: enable [LocalMod](docs/MODERATION-GUIDE.md) via `LOCALMOD_URL`.

---

## Architecture (short)

```
Browser ──HTTP──► Forum node (Express)
                      │
                      ├─ AES-GCM virtual disk (node-local key, not wallet secret)
                      ├─ Roles: user · moderator · node owner · super_admin
                      └─ WebRTC mesh ◄── signaling URL(s) + networkHash
```

- **Same `networkHash` + overlapping signaling** → peers discover each other and sync.
- **Disk encryption** uses `data/node-disk.key` or `NODE_DISK_SECRET` — **any** Stellar wallet can sign in.
- **Node owner** is stored in sealed `data/node-meta.sealed` (first claim on that machine).

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port (default 3000) |
| `NODE_DISK_SECRET` | Stable disk encryption material (≥16 chars); optional if `data/` is preserved |
| `LOCALMOD_URL` | Optional moderation API, e.g. `http://127.0.0.1:8000` |
| `DEFAULT_NETWORK_HASH` / `DEFAULT_SIGNALING_URL` | Override genesis defaults |
| `SKIP_DEFAULT_MESH=1` | Do not auto-apply official mesh on first boot |

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/INTRODUCTION.md](docs/INTRODUCTION.md) | Product intro, genesis vs private, install guides |
| [docs/ECONOMICS.md](docs/ECONOMICS.md) | Why XPi, production cost, utility, content claims |
| [docs/MODERATION-GUIDE.md](docs/MODERATION-GUIDE.md) | Layer 1 filters + LocalMod + human mod |
| [docs/ABOUT.md](docs/ABOUT.md) | One-page summary |
| [docs/blog/xpi-forum-p2p-economics-and-architecture.md](docs/blog/xpi-forum-p2p-economics-and-architecture.md) | Long-form post for GitHub Pages |

---

## Related

- XPi / Stellar staking and claim flows are defined by **on-chain contracts**; this repo is the **open-source forum node** surface.
- Signaling standalone package may ship separately for operators who self-host bootstrap WebSocket servers.

---

*Forum P2P · XPi open source · Stellar*
