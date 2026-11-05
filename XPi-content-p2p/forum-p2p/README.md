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
export CONTRACT_ID=CDQ4OO3FU3CBNVWZX2GDU4BQQNQFAHBITTXULTVIECY4OMJGTM33M73H
export TX_FEE=500000
npm start
```

Windows PowerShell:

```powershell
$env:PORT = "3000"
$env:SIGNALING_URL = "http://127.0.0.1:4000"
$env:CONTRACT_ID = "CDQ4OO3FU3CBNVWZX2GDU4BQQNQFAHBITTXULTVIECY4OMJGTM33M73H"
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
| `CONTRACT_ID` | `CDQ4OO3FU3CBNVWZX2GDU4BQQNQFAHBITTXULTVIECY4OMJGTM33M73H` | Live staking contract |
| `TX_FEE` | `500000` | Inclusion fee in stroops (0.05 XLM) |

`CONTRACT_ID` must point at the contract that is actually deployed. The methods the node calls today are `stake`, `unstake`, `claim`, `get_stake`, and `pending`.

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
8. Write a topic. The local fee is subtracted in the app. This deployed contract has no `pay_for_topic`.
9. **Like** subtracts the local like fee and increases the author’s like count in the disk file. This deployed contract has no `like_post`.
10. Moving the pointer onto a post once adds one local view.
11. The side column shows top view, top like, and top trend. Trend is `(views + likes × 8) / age in hours`.

A short keyword filter blocks a few terms and very short posts. It is not a language model.

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
  src/moderation/         keyword filter
  contracts/              xpi-forum.rs and the previous contract
  data/                   created at runtime
```

## 11. Common errors

- **`EADDRINUSE`** — port 3000 or 4000 is taken. Change `PORT` or stop the old process.
- **`invalid encoded string`** — the secret key is not a Stellar `S...` key.
- **Simulation failed** — the contract rejected the call (stake below 31.4 XLM, nothing to claim, contract paused, or not enough XLM for the fee).
- **403** — disk under 100 GB or on-chain stake under 31.4 XLM.
- **402** — the session balance no longer covers the local topic or like fee. Open the session again to re-read Horizon.
- **`blocked by local filter`** — the post hit the keyword list or is too short.
- Signaling down — one-machine use still works.

# 12. LocalMod 
git clone https://github.com/KOKOSde/localmod.git
cd localmod
pip install -e .
python scripts/download_models.py   # ~3.5 GB, chỉ 1 lần
localmod serve --port 8000 --device cpu

# 12.1 Forum
export LOCALMOD_URL=http://127.0.0.1:8000
npm start