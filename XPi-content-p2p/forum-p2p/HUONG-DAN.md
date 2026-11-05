**Full Guide — forum-p2p**

Decentralized forum node, minimal version that runs on **Windows** and **Ubuntu**.

Android relay and real WebRTC DataChannel are **not** included in this version. Peer connections currently use an in-process message queue so you can run the UI + stake + post/like fees first. Where to attach `wrtc` is clearly noted at the end of the file.

### 1. Requirements

- Node.js **18 or higher** (recommended 20 or 22).
- No Cloudflare, no database, no GPU needed.
- Default ports: forum `3000`, signaling `4000`.

Check:

```bash
node -v
npm -v
```

### 2. Extract and install

Ubuntu / macOS / Git Bash:

```bash
unzip forum-p2p.zip
cd forum-p2p
npm install
```

Windows PowerShell:

```powershell
Expand-Archive -Force forum-p2p.zip -DestinationPath .
cd forum-p2p
npm install
```

`npm install` only pulls `express`. No native modules, no C++ build required.

### 3. Run the forum node

```bash
npm start
```

Open the browser: [http://localhost:3000](http://localhost:3000)

Stop: `Ctrl + C`.

#### Environment variables (optional)

Copy the sample and edit:

```bash
cp .env.example .env
```

The node **does not automatically read** the `.env` file. Export the variables before running, or set them directly.

Ubuntu:

```bash
export PORT=3000
export SIGNALING_URL=http://127.0.0.1:4000
export DISK_PATH=./data/network-data.disk
export MIN_DISK_GB=100
npm start
```

Windows PowerShell:

```powershell
$env:PORT = "3000"
$env:SIGNALING_URL = "http://127.0.0.1:4000"
npm start
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | UI + API port |
| `SIGNALING_URL` | `http://127.0.0.1:4000` | Bootstrap server |
| `NODE_ID` | auto-generated | Node name |
| `DISK_PATH` | `./data/network-data.disk` | Encrypted virtual disk file |
| `MIN_DISK_GB` | `100` | Threshold required to post / like |
| `TOPIC_FEE` | `0.0000021` | Fee to create a topic |
| `LIKE_FEE` | `0.0000001` | Fee for one like |
| `STELLAR_SECRET` | empty | Not yet sent on-chain |
| `CONTRACT_ID` | empty | Contract ID when you attach Soroban |

### 4. Using the interface

1. **Private key** — password field, exists only in the browser session / server RAM until the process is stopped. The demo uses it as the disk encryption key; it is not sent over the network.
2. **XPi / XLM** — local balance used to deduct fees. Default `1`.
3. **Disk (GB)** — must be **≥ 100** and XPi **> 0** to be allowed to write.
4. Click **Enter node**.
5. Write a topic. Each post deducts `0.0000021`.
6. **Like** deducts `0.0000001` from the liker and adds it to the author (`earned`).
7. Hovering over a post for the first time adds 1 view.
8. Right column: top view, top like, top trend (view + like divided by post age).
9. **Estimated claim today** — off-chain formula, does not call the contract yet.

Local filter blocks some crude keywords (`porn`, `xxx`, `drug deal`, `bomb making`) and posts that are too short. This is not a Qwen model.

### 5. Signaling (bootstrap machine)

Second terminal, same directory:

```bash
npm run signaling
```

Listens on port `4000`. The forum node on startup will `POST /announce`. If signaling is off, the forum still runs and logs `bootstrap skipped`.

Two machines on the same LAN:

- Machine A runs signaling and opens firewall port 4000.
- Machine B: `SIGNALING_URL=http://<ip-of-machine-A>:4000 npm start`.

Signaling API:

- `POST /announce` JSON body `{ "id", "stakeXlm", "diskGb" }` → returns other peers, ordered by highest stake first.
- `GET /peers` → list of still-alive peers (TTL 60 seconds).

### 6. Local API

| Method | Path | Action |
| --- | --- | --- |
| GET | `/api/health` | node id + peers seen |
| POST | `/api/session` | `{ secretKey, xlm, diskGb }` |
| GET | `/api/posts` | posts + 3 ranking tables |
| POST | `/api/posts` | `{ title, body }` |
| POST | `/api/posts/:id/view` | +1 view |
| POST | `/api/posts/:id/like` | transfer like fee |
| POST | `/api/claim` | estimate reward/day |

Examples:

```bash
curl -s http://127.0.0.1:3000/api/health
curl -s -X POST http://127.0.0.1:3000/api/session \
  -H 'content-type: application/json' \
  -d '{"secretKey":"SDEMOKEY12345678","xlm":1,"diskGb":120}'
curl -s -X POST http://127.0.0.1:3000/api/posts \
  -H 'content-type: application/json' \
  -d '{"title":"Hello","body":"First post"}'
```

### 7. Where the data lives

- `data/network-data.disk` — JSON of posts + stake, encrypted with **AES-256-GCM**.
- Key is derived with `scrypt` from the private key you enter. Changing the key makes the old file unreadable.
- Deleting the disk file = loss of local posts. This file is not committed (already in `.gitignore`).

Estimated reward in `src/stellar/claim.js`:

- base = `XLM * 0.001`
- disk = additional `0.00001` per 10 GB

Like / topic currently **deduct balance in RAM**, no Stellar transaction is issued yet. Functions are in `src/stellar/like.js` and `src/stellar/stake.js` so you can replace them with `@stellar/stellar-sdk`.

### 8. Directory layout

```text
forum-p2p/
  package.json
  HUONG-DAN.md
  README.md
  .env.example
  public/                UI
  signaling/server.js    bootstrap peer list
  src/index.js           startup
  src/server/            Express + routes
  src/storage/           encrypted disk + rankings
  src/p2p/               peer, signaling client, message channel
  src/stellar/           stake, like, claim (off-chain)
  src/moderation/        keyword filter
  data/                  created at runtime
```

### Soroban (version 0.2)

The file `stake-claim-31.js` is not in the workspace. The client calls the exact function names from the Claim Content design. Your contract must have these functions (if the names differ, edit `src/stellar/chain.js`):

| Function | Parameters |
| --- | --- |
| `pay_for_topic` | `(user Address, amount i128)` |
| `like_post` | `(user Address, creator Address, amount i128)` |
| `claim` | `(user Address)` |
| `claim_view_reward` | `(creator Address, post_id String, view_count u64)` |
| `get_stake` | `(user Address) -> i128` optional |
| `balance` | on `XPI_CONTRACT`, `(user Address) -> i128` optional |

Amounts use 7 decimal places (`0.0000021` = 21 stroops).

Required environment variables when calling the chain:

```bash
export STELLAR_NETWORK=TESTNET
export HORIZON_URL=https://horizon-testnet.stellar.org
export SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
export CONTRACT_ID=C...
export XPI_CONTRACT=C...   # or XPI_CODE + XPI_ISSUER
npm start
```

The form no longer has a balance input field. The secret key is used only for signing and reading Horizon/RPC. Disk GB is still declared locally because the chain does not know disk size.

View milestone: `VIEW_MILESTONE` (default 1000000). When your own views reach a multiple of the milestone, the node calls `claim_view_reward` once for that milestone.

### WebRTC

`npm run signaling` opens HTTP + WebSocket on port 4000. The browser creates an `RTCDataChannel` named `forum`, uses Google STUN, and sends post metadata. The node receives `POST /api/sync` and merges by id (takes the higher view/like counts). Does not use native `wrtc`.

### Running

```bash
npm install
npm run signaling   # terminal 1
npm start           # terminal 2
```

Open http://localhost:3000 — paste secret key, disk GB, click to read balance. Posting only succeeds when `CONTRACT_ID` points to a real contract and the `pay_for_topic` transaction succeeds.

### 10. Common errors

- **`EADDRINUSE`** — port 3000 or 4000 is already in use. Change `PORT` or kill the old process.
- **403 stake** — disk under 100 or XPi = 0. Click **Enter node** again.
- **402 insufficient** — local balance exhausted after many posts/likes. Enter the node again with a higher balance (demo does not persist balance to disk).
- **`blocked by local filter`** — content hits a forbidden keyword.
- **Signaling silent** — the forum still works alone.