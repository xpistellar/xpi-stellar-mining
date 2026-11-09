# Forum P2P — Content Moderation Guide (Beginners)

This guide explains how moderation works on a Forum P2P node and how to install an optional **local AI moderation service** so your node can filter spam, toxicity, and clear policy violations without sending posts to a third-party cloud.

**Audience:** first-time node operators on Windows or Ubuntu.

---

## 1. What you already have (built-in)

Forum P2P always runs **Layer 1** filters on the node process:

| Layer | What it does | Needs install? |
|-------|----------------|----------------|
| **Layer 1 — Hard block** | Fast regex rules for clear spam, scams, extreme NSFW, hate, weapons instructions, etc. | No — always on |
| **Layer 2 — LocalMod (optional)** | ML-style scoring: toxicity, spam, NSFW, PII hints | Yes — separate service |
| **Human moderation** | Super-admin / network moderators: Hide, Delete, Restore, Ban 7 days | No — UI in forum |

**Important:** Layer 1 alone is not a full “community safety” system. For a public node, we **strongly recommend** enabling Layer 2 (LocalMod) or appointing human moderators.

Genesis / official mesh defaults to **public** read access. You can switch the node to **private** (view password) under **Setup node** if you are not ready for open indexing.

---

## 2. Roles (who can moderate what)

| Role | How you get it | Powers |
|------|----------------|--------|
| **User** | Any Stellar wallet Sign in | Post/comment if stake rules allow |
| **Node owner (admin)** | First **Claim node** on this machine | Local node tools, claim_node, public/private access — **not** full network moderation |
| **Moderator** | Appointed by **super_admin** | Hide / delete / restore posts, ban comments 7 days |
| **Super admin** | Fixed public keys in source | Full network tools + appoint moderators |

Automated LocalMod does **not** replace human review. It only blocks or flags text at submit time when configured.

---

## 3. Recommended setup (checklist)

1. Run Forum P2P (`npm start`) and confirm the forum loads.
2. **Sign in** with your Stellar secret key.
3. Open **Setup node** → **Claim node** (first operator on this machine).
4. (Optional) Set **Private** + view password until policies are ready; switch back to **Public** when open.
5. Install **LocalMod** on the same machine or a LAN host (Section 4).
6. Set `LOCALMOD_URL` and restart Forum P2P (Section 5).
7. Ask a network **super_admin** to appoint trusted **moderators** if you run a busy public board.
8. Publish clear community rules in a pinned topic (spam, hate, NSFW, scams).

---

## 4. Install LocalMod (Layer 2)

LocalMod is a **separate** HTTP service. Forum P2P calls it when users create posts or comments.

Upstream project (example): [https://github.com/KOKOSde/localmod](https://github.com/KOKOSde/localmod)

> If the repository moves, search for “LocalMod content moderation API” or use any compatible service that exposes `POST /analyze` with a text body. Adjust paths if your fork differs.

### 4.1 Requirements

- **Python 3.10+** recommended (check LocalMod’s README for the exact version)
- **4 GB RAM** minimum for small models; more if the project pulls larger weights
- Disk space for model files (often 1–5 GB depending on the model)
- Outbound network **once** to download models (then can run offline)

### 4.2 Ubuntu (beginner steps)

```bash
# System packages
sudo apt update
sudo apt install -y python3 python3-pip python3-venv git

# Clone (use the official URL from the project README if this path changes)
git clone https://github.com/KOKOSde/localmod.git
cd localmod

python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt

# Start API — port 8000 is the Forum P2P default expectation
# Read the project README for the exact start command; common patterns:
#   uvicorn app:app --host 127.0.0.1 --port 8000
# or:
#   python -m localmod
```

Keep this terminal open, or run under **systemd** / **pm2** / **screen** so it survives logout.

**Health check:** open `http://127.0.0.1:8000/docs` or `/health` if the project exposes them.

### 4.3 Windows (beginner steps)

1. Install [Python 3](https://www.python.org/downloads/) — tick **Add Python to PATH**.
2. Install [Git for Windows](https://git-scm.com/download/win).
3. Open **PowerShell**:

```powershell
git clone https://github.com/KOKOSde/localmod.git
cd localmod
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -U pip
pip install -r requirements.txt
```

4. Start the API on **127.0.0.1:8000** using the command in LocalMod’s README.
5. Allow the port only on localhost (do not expose moderation API to the public internet without auth).

### 4.4 Docker (optional)

If the project provides a Dockerfile:

```bash
docker build -t localmod .
docker run --rm -p 127.0.0.1:8000:8000 localmod
```

Bind to **127.0.0.1** so only the same machine can call it.

---

## 5. Connect LocalMod to Forum P2P

### 5.1 Environment variable

In the same environment as Forum P2P:

```bash
# Linux / macOS
export LOCALMOD_URL=http://127.0.0.1:8000
npm start
```

```powershell
# Windows PowerShell
$env:LOCALMOD_URL = "http://127.0.0.1:8000"
npm start
```

Or put in a `.env` file if your process manager loads it:

```
LOCALMOD_URL=http://127.0.0.1:8000
```

### 5.2 What happens when it is set

1. User submits a post or comment.
2. Forum P2P runs **Layer 1** hard-block rules.
3. If Layer 1 passes, Forum P2P calls LocalMod `POST /analyze` (timeout protected).
4. If LocalMod is **down**, Forum P2P does **not** crash — it continues with Layer 1 only (fail-open for availability). Check your logs if you need fail-closed behavior in a fork.

### 5.3 Verify

1. Start LocalMod, then Forum P2P with `LOCALMOD_URL` set.
2. Sign in and try a normal post — should succeed.
3. Try obvious spam/NSFW text that Layer 1 or LocalMod should reject — should get an error in the UI.
4. Watch LocalMod logs for incoming `/analyze` requests.

---

## 6. Human moderation workflow

Even with LocalMod:

1. **Super admin** opens **My Acc** → Moderators → appoint `G…` public keys.
2. Moderators use **Hide / Delete / Restore / Ban 7d** on topics.
3. Prefer **Hide** for borderline cases; **Delete** for clear violations.
4. Use **Ban 7 days** on repeat comment abusers (comment ban — follow your local policy).
5. Keep a public “Rules” topic: no scams, no hate, no illegal content, no doxxing, stake ethics, etc.

---

## 7. Privacy and security notes

- Prefer LocalMod on **localhost** so post text does not leave the machine.
- Do **not** publish an open moderation port on `0.0.0.0` without authentication.
- Node **private mode** (Setup node → Public/Private) reduces casual web indexing; it is **not** a substitute for moderation of signed-in users.
- Stellar keys are accounts — never paste secrets into public tickets or screenshots.

---

## 8. Troubleshooting

| Symptom | What to try |
|---------|-------------|
| Posts always allowed, even toxic | Is `LOCALMOD_URL` set? Is LocalMod running? Check Forum P2P console for moderation skip logs. |
| Connection refused | Wrong port; firewall; service not started. |
| Slow posts | Model too large for CPU — use a smaller model or more RAM. |
| Only Layer 1 blocks | Normal if LocalMod is offline — start the service. |
| Want zero public reads | Setup node → **Private** + view password. |

---

## 9. Quick reference commands

```bash
# Forum P2P with moderation
export LOCALMOD_URL=http://127.0.0.1:8000
export PORT=3000
npm start

# Optional: pin node disk key across deploys
export NODE_DISK_SECRET="your-long-random-string"
```

```powershell
$env:LOCALMOD_URL = "http://127.0.0.1:8000"
$env:PORT = "3000"
npm start
```

---

## 10. Summary

1. **Always-on:** Layer 1 hard-block in Forum P2P.  
2. **Recommended for public nodes:** LocalMod via `LOCALMOD_URL`.  
3. **Humans:** moderators + clear rules.  
4. **Until ready:** private node password under Setup node.

For mesh identity, signaling, and hard-fork, see footer **Node setup** and the in-app **Setup node** panel.
