# Hướng dẫn cài đặt Forum P2P v0.5.3 — cho người mới bắt đầu

Hướng dẫn này giả định bạn **chưa từng** chạy Node.js. Làm theo từng bước, copy-paste lệnh.

**Forum P2P không phải PHP.** Shared host chỉ PHP **không** chạy được backend. Cần:

- Máy Windows / Ubuntu / macOS local, **hoặc**
- VPS / cloud có quyền cài Node, **hoặc**
- Hosting có “Setup Node.js App” (cPanel)

Signaling (ghép peer WebRTC) cũng cần Node + WebSocket — xem mục **Signaling** bên dưới.

---

## A. Cài Node.js (bắt buộc)

### A1. Windows 10/11

1. Mở trình duyệt → https://nodejs.org  
2. Tải bản **LTS** (ví dụ 20.x hoặc 22.x) — nút xanh lớn.  
3. Chạy file `.msi` → Next → tích “Automatically install necessary tools” nếu có → Finish.  
4. Mở **PowerShell** (Windows key → gõ `PowerShell` → Enter).  
5. Kiểm tra:

```powershell
node -v
npm -v
```

Phải hiện số phiên bản (vd. `v20.18.0` và `10.x.x`). Nếu báo “not recognized”: đóng PowerShell, mở lại, hoặc restart máy.

### A2. Ubuntu 20.04 / 22.04 / 24.04

Mở Terminal (`Ctrl+Alt+T`):

```bash
sudo apt update
sudo apt install -y curl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

Hoặc dùng nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# đóng terminal, mở lại
nvm install 20
node -v
```

---

## B. Giải nén và cài package forum

### B1. Windows (PowerShell)

```powershell
cd C:\forum
Expand-Archive -Force .\forum-p2p-*.zip -DestinationPath .
cd forum-p2p
npm install
```

Nếu lỗi execution policy:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### B2. Ubuntu

```bash
cd ~
unzip ~/Downloads/forum-p2p-*.zip -d ~/
cd ~/forum-p2p
npm install
```

### B3. CLI install (tuỳ chọn)

```bash
npm run install-node
# hoặc: npm run install-node:yes
```

---

## C. Cấu hình nhanh

### Windows PowerShell

```powershell
$env:PORT = "3000"
$env:SIGNALING_URL = "http://127.0.0.1:4000"
# $env:SIGNALING_URLS = "https://s1.example.com,https://s2.example.com"
$env:NODE_INTEGRITY_SECRET = "doi-chuoi-nay-bang-chuoi-ngau-nhien-dai"
npm start
```

### Ubuntu / macOS

```bash
export PORT=3000
export SIGNALING_URL=http://127.0.0.1:4000
# export SIGNALING_URLS=https://s1.example.com,https://s2.example.com
export NODE_INTEGRITY_SECRET="$(openssl rand -hex 32)"
npm start
```

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `PORT` | `3000` | Cổng UI + API |
| `SIGNALING_URL` | `http://127.0.0.1:4000` | Bootstrap chính |
| `SIGNALING_URLS` | (trống) | Danh sách fallback, cách nhau `,` |
| `DISK_PATH` | `./data/network-data.disk` | Virtual disk mã hoá |
| `MIN_DISK_GB` | `100` | Ngưỡng để đăng bài |
| `NODE_INTEGRITY_SECRET` | (tự sinh) | HMAC bảo vệ file admin |
| `LOCALMOD_URL` | (trống) | API LocalMod nếu có |
| `BUY_XLM_URL` | StellarTerm | Nút mua XLM |

---

## D. Chạy forum + signaling

### Terminal 1 — Signaling

```bash
npm run signaling
# hoặc standalone:
cd signaling-standalone && npm install && npm start
```

### Terminal 2 — Forum

```bash
cd /path/to/forum-p2p
npm start
```

Mở: **http://localhost:3000** — Dừng: `Ctrl+C`.

### Windows — hai cửa sổ PowerShell

Cửa sổ 1:

```powershell
cd C:\forum\forum-p2p\signaling-standalone
npm install
npm start
```

Cửa sổ 2:

```powershell
cd C:\forum\forum-p2p
$env:PORT = "3000"
$env:SIGNALING_URL = "http://127.0.0.1:4000"
npm start
```

---

## E. Lần đầu mở site — Setup mesh

1. Tab **Tạo mạng mới (genesis)** — tên node, signaling URL → copy **networkHash**
2. Tab **Join** — dán hash + signaling URL cùng bootstrap
3. Đăng nhập ví Stellar

Chi tiết: `SETUP-MANG.md`.

---

## F. Multi Signaling (Admin)

Login admin node → **Admin** → **Multi Signaling**:

1. Mỗi dòng một URL, **dòng đầu = primary**
2. **Lưu danh sách**
3. **Tải signaling-standalone.zip** để up VPS / máy bootstrap

### Shared host chỉ PHP?

Không chạy WebSocket lâu dài. Dùng:

1. VPS nhỏ chạy `signaling-standalone`
2. Máy nhà + Cloudflare Tunnel: `cloudflared tunnel --url http://127.0.0.1:4000`
3. cPanel Node App → startup `server.mjs`

Health: `https://your-signal/health` → `{"ok":true,...}`

---

## G. Production Ubuntu (pm2)

```bash
sudo npm install -g pm2
cd ~/forum-p2p
export NODE_INTEGRITY_SECRET="$(openssl rand -hex 32)"
export PORT=3000
export SIGNALING_URL=https://signal.yourdomain.com
pm2 start src/index.js --name forum-p2p
pm2 start signaling-standalone/server.mjs --name signaling
pm2 save && pm2 startup
sudo ufw allow 3000/tcp && sudo ufw allow 4000/tcp
```

---

## H. Đăng nhập / quyền

| Role | Cách có |
|------|---------|
| super_admin | 3 public key cố định trong server |
| admin | Ví login đầu tiên trên node |
| moderator | Admin/super bổ nhiệm (ký, sync P2P) |
| user | Mặc định |

Mất secret key Stellar = mất ví, không khôi phục.

---

## I. Lỗi thường gặp

| Lỗi | Cách xử |
|-----|---------|
| node/npm not found | Cài Node, mở lại terminal |
| EADDRINUSE | Đổi PORT hoặc tắt process cũ |
| need >= 100 GB disk | Tăng disk GB khi login |
| Không thấy peer | Cùng networkHash + cùng signaling online? |
| Shared host PHP | Cần Node; xem host-check.php |

---

## J. Checklist người mới

1. Cài Node 18+ (`node -v`)
2. `npm install` trong forum-p2p
3. Chạy signaling (terminal 1)
4. `npm start` forum (terminal 2)
5. Setup genesis / Join tại http://localhost:3000
6. Login ví Stellar
7. (Tuỳ chọn) Admin → Multi Signaling
8. Chia sẻ networkHash + signaling qua kênh tin cậy
