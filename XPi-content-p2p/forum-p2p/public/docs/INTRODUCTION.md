# Forum P2P — Introduction & Installation

Forum P2P is **open-source software** in the **XPi (Stellar)** ecosystem. Each installation is a **node**: encrypted local storage, optional WebRTC peer sync, and Stellar-wallet identity.

## Goals

### Democratize online discussion

- Sign in with a **Stellar secret key** — no Google/Facebook account required.
- Publish subject to mesh rules (e.g. on-chain stake thresholds).
- Run your own node; choose **public** read access or **private** (view password).

### Reduce dependence on ad-driven platforms

Value is intended to come from:

- Community utility (discussion, knowledge, coordination).
- Stellar / Soroban economics (staking, eligibility, claims — as implemented by contracts and the UI of your version).

Operating a node is analogous to running a **small internet machine** that hosts a slice of conversation and may receive protocol rewards when conditions are met.

## Two network modes

### Official genesis mesh (default)

On first boot the node applies the **official network hash and signaling** (unless overridden). Suitable for public XPi discussion, FAQs, and project topics.

### Private network or hard fork

From **Setup node** in the UI:

| Action | Effect |
|--------|--------|
| **Create network** | New genesis hash on this node; share hash + signaling with peers |
| **Hard fork** | New hash + signaling, **keep local disk posts**, leave the old mesh permanently |

Private mode + view password further limits casual indexing.

## Installation

### Windows

1. Install [Node.js LTS](https://nodejs.org/).
2. Extract the repository.
3. PowerShell:

```powershell
cd forum-p2p
npm install
$env:PORT = "3000"
npm start
```

4. Open `http://localhost:3000`.
5. Sign in with any `S…` key. Use **Setup node** to claim ownership or fork.

### Ubuntu

```bash
sudo apt update && sudo apt install -y nodejs npm   # or Node 20 via NodeSource
cd forum-p2p && npm install
export PORT=3000
npm start
```

Use `pm2` or `systemd` for persistence. Terminate TLS with Nginx or Caddy.

### Opalstack (recommended shared Node host)

1. Create a **Node.js** app (Node ≥ 18).
2. Deploy sources; run `npm install`.
3. Environment: `PORT`, optional `NODE_DISK_SECRET`, optional `LOCALMOD_URL`.
4. Start the app; attach domain + HTTPS.
5. Preserve the `data/` directory across deploys.

WebSocket signaling: use the public genesis signal or a second Node app for self-hosted signaling.

## After install

1. Home page rankings and categories load.
2. Mesh banner shows identity OK.
3. **Sign in** → **Setup node** (claim, access mode, moderation, create/fork).
4. **My Acc** for stake and role tools.
5. Public nodes: follow [MODERATION-GUIDE.md](./MODERATION-GUIDE.md).

## Further reading

- [ECONOMICS.md](./ECONOMICS.md) — production cost, utility, content claims  
- [Blog post (GitHub Pages)](./blog/xpi-forum-p2p-economics-and-architecture.md)
