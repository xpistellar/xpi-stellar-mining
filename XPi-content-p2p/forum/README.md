# forum-p2p — full guide

A local forum node for Windows and Ubuntu. It serves a web UI, stakes XLM through the live Soroban contract, stores posts in an encrypted virtual-disk file, and syncs post metadata over WebRTC.

Android relay is not included.

## 1. Requirements

- Node.js 18 or newer (20 or 22 recommended).
- A Stellar account on **public** mainnet, funded with a little XLM for fees.
- No Cloudflare account, no database, no GPU.

Default ports: forum `3000`, signaling `4000`.

```bash
node -v
npm -v
```

## 2. Install

Linux, macOS, or Git Bash:

```bash
unzip forum-p2p-full.zip
cd forum-p2p
npm install
```

Windows PowerShell:

```powershell
Expand-Archive -Force forum-p2p-full.zip -DestinationPath .
cd forum-p2p
npm install
```

Dependencies: `express`, `ws`, `@stellar/stellar-sdk`. No native addons.

## 3. Run

Terminal 1, signaling (optional, needed only to connect two browsers):

```bash
npm run signaling
```

Terminal 2, forum:

```bash
npm start
```

Open http://localhost:3000. Stop a process with Ctrl+C.

## 4. Configuration

The process does **not** read a `.env` file by itself. Export variables before `npm start`, or rely on the defaults in `src/utils/config.js`.

Linux:

```bash
export PORT=3000
export SIGNALING_URL=http://127.0.0.1:4000
export DISK_PATH=./data/network-data.disk
export MIN_DISK_GB=100
export HORIZON_URL=https://horizon.stellar.org
export SOROBAN_RPC_URL=https://mainnet.sorobanrpc.com
export STAKING_ID=CCFA55AIBV5JDU3T3D3GTKG5FVMNO2KFQYU56C52JR45I5IDSYBFMCHF
export CONTENT_ID=CCENQ25MNJUENBZ3JTD7PESKYTCUT6E3XR535734VTKLN6AFJ473IQBV
export XPI_SAC=CAKQOAJY46GIXT36XJXATTBTRERL66LGLPZUWSXODE6D2LPEZYH6TY2C
export DIST_ID=CC6NOS2KVU3FJMYRWERZED3DVJPJ3OGOZ67UZLE5LSCGUQQY5MERAMKI
export TX_FEE=500000
npm start
```

Windows PowerShell:

```powershell
$env:PORT = "3000"
$env:SIGNALING_URL = "http://127.0.0.1:4000"
$env:STAKING_ID = "CCFA55AIBV5JDU3T3D3GTKG5FVMNO2KFQYU56C52JR45I5IDSYBFMCHF"
$env:CONTENT_ID = "CCENQ25MNJUENBZ3JTD7PESKYTCUT6E3XR535734VTKLN6AFJ473IQBV"
npm start
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | Local UI and API |
| `SIGNALING_URL` | `http://127.0.0.1:4000` | Bootstrap server. The browser uses the same host with `ws://` |
| `NODE_ID` | random | Name announced to peers |
| `DISK_PATH` | `./data/network-data.disk` | Virtual disk file |
| `MIN_DISK_GB` | `100` | Disk size required before posting |
| `TOPIC_FEE` | `0.0000021` | Local topic fee, subtracted from the displayed XLM balance |
| `LIKE_FEE` | `0.0000001` | Local like fee |
| `VIEW_MILESTONE` | `1000000` | Ranking hint only. The live contract has no view-reward call |
| `HORIZON_URL` | `https://horizon.stellar.org` | Account source for transactions |
| `SOROBAN_RPC_URL` | `https://mainnet.sorobanrpc.com` | Simulate and submit |
| `STAKING_ID` | `CCFA55AIBV5JDU3T3D3GTKG5FVMNO2KFQYU56C52JR45I5IDSYBFMCHF` | Central Staking contract (XLM stake + XPi stake + views) |
| `CONTENT_ID` | `CCENQ25MNJUENBZ3JTD7PESKYTCUT6E3XR535734VTKLN6AFJ473IQBV` | Content contract (pay_for_topic, like_post, claim_node) |
| `XPI_SAC` | `CAKQOAJY46GIXT36XJXATTBTRERL66LGLPZUWSXODE6D2LPEZYH6TY2C` | XPi token SAC |
| `DIST_ID` | `CC6NOS2KVU3FJMYRWERZED3DVJPJ3OGOZ67UZLE5LSCGUQQY5MERAMKI` | Distributor (lottery / trigger_daily) |
| `TX_FEE` | `500000` | Inclusion fee in stroops (0.05 XLM) |
| `LOCALMOD_URL` | (empty) | Optional LocalMod API base URL, e.g. `http://127.0.0.1:8000`. Leave empty to use hard-block only |

The node now calls the multi-contract system: Staking (stake/unstake/claim/has_min_stake/get_xpi_staked/stake_xpi), Content (pay_for_topic/like_post/claim_node), and Distributor (trigger_daily for the lottery button).

## 5. Using the UI

1. Paste the Stellar **secret key** (`S...`). It stays in the local Node process for that session. It is the disk encryption key and the transaction signer. It is not sent to other peers.
2. Set **disk GB**. This is a local commitment. The chain cannot see the file.
3. Click the button that reads the chain. The node calls `get_stake` and `pending` (simulate only) and reads the native XLM balance from Horizon.
4. You can post only when all of these are true:
   - the virtual disk was allocated at **≥ 100 GB**
   - on-chain stake is **≥ 31.4 XLM**
   - the wallet still covers the local topic fee
5. **Stake** sends `stake(address, amount)`. Minimum **31.4 XLM**. The inclusion fee is about 0.05 XLM.
6. **Unstake** sends `unstake(address, amount)`. Amount `0` withdraws the whole stake.
7. **Claim** sends `claim(address)` and pays the contract’s continuous staking reward.
8. Write a topic. The node calls Content.pay_for_topic (0.0000021 XPi fee to Staking). Requires has_min_stake.
9. **Like** calls Content.like_post (0.0000001 XPi to the author). Requires has_min_stake.
10. Moving the pointer onto a post once adds one local view.
11. The side column shows top view, top like, and top trend. Trend is `(views + likes × 8) / age in hours`.

### Content moderation

Posts are checked by a two-layer community filter before they are accepted:

1. **Hard-block** (always on) — multi-language regex (English + Vietnamese) for clear NSFW, extreme violence/terrorism, hard-drug dealing, and obvious spam patterns. Rejects with `blocked by community filter`.
2. **LocalMod** (optional) — self-hosted offline API for toxicity / hate speech, spam, NSFW text, and PII. When `LOCALMOD_URL` is set, the node calls `POST /analyze`. If LocalMod is down the node continues with hard-block only.

Set `LOCALMOD_URL=http://127.0.0.1:8000` (or leave empty to disable). See https://github.com/KOKOSde/localmod for install.

## 6. Virtual disk

On login the node creates or grows `data/network-data.disk` to the GB value you entered (1 GB = 1024³ bytes).

- The file is sparse, like a thin `.vmdk`: the filesystem reports the full size, disk blocks are used as data is written.
- Posts are AES-256-GCM, key derived with scrypt from the secret key. The ciphertext sits at the start of the file. Later writes do not shrink the allocation.
- A different secret key cannot decrypt an existing file.
- Deleting the file deletes local posts. The path is gitignored.
- The chain does not check this file. `commit_disk` exists only in the **upgrade** contract (`contracts/xpi-forum.rs`), which is not the contract at `CDQ4OO3F…` until you deploy and upgrade.

## 7. Signaling and WebRTC

```bash
npm run signaling
```

Listens on port 4000 for HTTP and WebSocket.

- Each browser says hello with its node id, stake, and disk GB.
- The server sends the peer list, highest stake and disk first.
- The browser opens an `RTCDataChannel` named `forum`, using Google STUN, and exchanges SDP and ICE through the signaling socket.
- A peer message is a JSON list of posts. The node merges them with `POST /api/sync` (same id: keep the higher view and like counts).
- If signaling is down, the forum still runs on one machine. You only lose peer sync.

Two machines on one LAN: machine A runs signaling and opens port 4000. Machine B starts with `SIGNALING_URL=http://<machine-A-ip>:4000`.

## 8. Local API

| Method | Path | Body / result |
| --- | --- | --- |
| GET | `/api/health` | node id, network, contract id, signaling WebSocket URL |
| POST | `/api/session` | `{ "secretKey", "diskGb" }` → chain balances, stake, disk file size |
| GET | `/api/posts` | posts and three rankings |
| POST | `/api/posts` | `{ "title", "body" }` local post |
| POST | `/api/posts/:id/view` | +1 view |
| POST | `/api/posts/:id/like` | local like fee |
| POST | `/api/sync` | `{ "posts": [...] }` from a peer |
| POST | `/api/stake` | `{ "xlm": "31.4" }` on-chain stake |
| POST | `/api/unstake` | `{ "xlm": "0" }` on-chain unstake (`0` = all) |
| POST | `/api/claim` | on-chain `claim` |

Example that only checks the process (a real secret is required for `/api/session`):

```bash
curl -s http://127.0.0.1:3000/api/health
```

## 9. Upgrade contract (not deployed yet)

`contracts/xpi-forum.rs` keeps the current stake storage and adds forum calls. Details are in `contracts/FORUM-CONTRACT.md`.

| Call | Role |
| --- | --- |
| `commit_disk(user, gb)` | Record a self-declared disk size. Not a proof. |
| `can_write(user)` | True only after ≥ 31.4 XLM staked for 48 hours and disk ≥ 100 GB |
| `pay_for_topic(user, post_id)` | Charge 0.0000021 XPi into the contract. `post_id` is 32 bytes |
| `like_post(from, post_id)` | Send 0.0000001 XPi to the author |
| `set_oracle` / `attest_views` | Only the bootstrap oracle may raise the view counter |
| `claim_view_reward` | Author withdraws 1 XPi from the XPi treasury per 1,000,000 attested views |

Do not point `CONTRACT_ID` at this source file until the WASM is deployed with `upgrade`. Until then the node must keep calling `stake`, `unstake`, `claim`, `get_stake`, and `pending` only.

View rewards are intentionally not self-reported. Peers can lie about views. The oracle key is set by the admin.

## 10. Layout

```text
forum-p2p/
  package.json
  HUONG-DAN.md
  README.md
  .env.example
  public/                 UI
  signaling/server.js     WebSocket bootstrap
  src/index.js
  src/server/             Express routes
  src/storage/            sparse virtual disk + rankings
  src/p2p/                peer ordering
  src/stellar/            Horizon + Soroban calls
  src/moderation/         community filter (hard-block + optional LocalMod)
  contracts/              xpi-forum.rs and the previous contract
  data/                   created at runtime
```

## 11. Common errors

- **`EADDRINUSE`** — port 3000 or 4000 is taken. Change `PORT` or stop the old process.
- **`invalid encoded string`** — the secret key is not a Stellar `S...` key.
- **Simulation failed** — the contract rejected the call (stake below 31.4 XLM, nothing to claim, contract paused, or not enough XLM for the fee).
- **403** — disk under 100 GB or on-chain stake under 31.4 XLM.
- **402** — the session balance no longer covers the local topic or like fee. Open the session again to re-read Horizon.
- **`blocked by community filter`** / **`blocked by moderation (...)`** — the post failed the hard-block or LocalMod check (or is too short).
- Signaling down — one-machine use still works.

## 12. Roles, admin panel & P2P integrity

### Roles

| Role | Who | Powers |
| --- | --- | --- |
| **super_admin** | Fixed public keys (hardcoded): `GA3KOPD7…`, `GAGVNFDX…`, `GA5UO7CU…` | Full: moderate, appoint/revoke moderators |
| **admin** | First wallet that successfully opens a session on **this node** (stored in `data/node-meta.json`) | Moderate + appoint/revoke moderators |
| **moderator** | Appointed by admin / super_admin | Hide / delete / restore posts |
| **user** | Everyone else | Post / like when stake+disk requirements met |

Login is still: paste Stellar **secret key**. The node derives the public key and assigns the role.

### Admin panel

After login, staff see a side panel:
- list of super admins / admin / moderators
- appoint moderator by public key (admin+)
- on each topic: Hide / Delete / Restore (moderator+)

### Database design

Still a **single encrypted JSON state** inside the virtual disk (`posts`, `roles`, `modActions`, `stake`). Reasons:
- Easy to encrypt with the session key
- Easy to sync over WebRTC as whole post objects
- No extra native deps (SQLite would need rebuild; Mongo needs a server)

Structure is document-oriented (Mongo-like), not relational. Suitable for a small forum node.

### P2P: can a hacked peer poison others?

**Previously:** naive merge accepted any post with an `id`. A compromised peer could inject arbitrary content.

**Now:**
1. Every new post is **signed** by the author's Stellar key (`signature` over `id|title|body|author|createdAt`).
2. `mergePost` **rejects** posts with missing/invalid signatures → a hacked peer **cannot forge** posts as another author.
3. Moderation actions are also signed by the moderator; peers only apply them if the signer currently has mod/admin/super role **on the receiving node**.
4. Counters (views/likes) only ever increase (max merge).

**What a hacked peer can still do:**
- Spam posts signed with **keys it controls**
- Withhold or delay data
- Push inflated views/likes on posts it already holds (max-merge)

**What it cannot do:**
- Rewrite another user's post body
- Impersonate super_admin without their secret key
- Force other nodes to accept unsigned garbage

True global consensus would need on-chain anchoring or a BFT layer; this design is **signed gossip**, which is the practical minimum for a light P2P forum.
