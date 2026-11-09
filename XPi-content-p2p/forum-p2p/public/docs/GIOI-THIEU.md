# Forum P2P — Giới thiệu

**Forum P2P** là phần mềm **mã mở (open source)** trong hệ sinh thái **XPi (XPi Stellar)**. Mỗi máy chạy forum là một **node**: lưu bài local, kết nối peer qua WebRTC, và có thể gắn với mạng **genesis** chung hoặc tự tạo mạng riêng.

---

## Mục đích

### Dân chủ hóa internet

Internet hiện nay phụ thuộc mạnh vào nền tảng tập trung: thuật toán đề xuất, quảng cáo, và **content monetize** (Google, mạng xã hội lớn…). Người viết content thường không kiểm soát được kênh phân phối hay điều kiện hiển thị.

Forum P2P hướng tới:

- **Ai có ví Stellar** đều có thể **đăng nhập và viết content** (theo quy tắc stake / cộng đồng của mạng đó).
- Không bắt buộc tài khoản Google / Facebook / email tập trung.
- Node do cộng đồng vận hành — có thể **public** (mở đọc) hoặc **private** (mật khẩu xem) tùy chủ node.
- Dữ liệu bài trên mỗi node nằm trong **ổ đĩa mã hóa local**; đồng bộ peer khi cùng **networkHash** và **signaling**.

### Không lệ thuộc monetize của Google

Forum không bán traffic cho quảng cáo tìm kiếm. Giá trị gắn với:

- **Tiện ích cộng đồng** (thảo luận, kiến thức, phối hợp công việc).
- **Kinh tế on-chain Stellar / Soroban** (stake, eligibility, thưởng node — theo thiết kế XPi).

Bạn chạy forum giống như **chạy một node máy** để duy trì một “internet thu nhỏ”: một lớp thảo luận + danh tính ví + (tuỳ chọn) phần thưởng cho người giữ node online và tuân thủ điều kiện stake.

### Nhận coin từ việc dùng / vận hành forum

Tùy phiên bản contract và cấu hình mạng:

| Hành vi | Ý nghĩa (thiết kế XPi) |
|--------|-------------------------|
| Stake XLM (ví dụ ≥ 31.4 XLM) | Mở quyền comment / tạo topic trên mạng có quy tắc đó |
| Giữ XPi + stake đủ điều kiện node | **Node operator** có thể **claim** thưởng định kỳ (local ledger / on-chain khi contract hỗ trợ) |
| Đóng góp content | Giá trị cộng đồng; một số mạng có thể gắn phí topic / like với tokenomics XPi |

Chi tiết số liệu stake / claim luôn lấy theo **contract và UI phiên bản bạn đang chạy** (Setup node · My Acc).

---

## Hai cách dùng mạng

### 1) Forum chung — mạng genesis (mặc định)

Khi cài gói Forum P2P, node **mặc định join mesh chính thức** (hash + signaling genesis, ví dụ `signal.xgoldmining.com`).

- Đọc / đồng bộ topic công khai của cộng đồng XPi.
- Sign in bằng ví Stellar bất kỳ.
- Super-admin mạng được định nghĩa trong mã nguồn; **chủ máy** (node owner) claim riêng trên từng server.

Phù hợp: thảo luận công khai, theo dõi thông báo dự án, FAQ, tokenomics.

### 2) Forum riêng — mạng private / hard fork

Trong **Setup node**:

- **Create network**: tạo **networkHash** mới (genesis local), chia sẻ hash + signaling cho đồng nghiệp.
- **Hard fork**: đổi hash + signal, **giữ data local**, **không** tự nhập lại mesh cũ.

Phù hợp: thảo luận nội bộ công ty, nhóm làm việc, cộng đồng kín (kết hợp **Private** + mật khẩu xem).

| | Genesis chung | Mạng riêng |
|--|----------------|------------|
| Hash / signal | Mặc định official | Tự tạo hoặc fork |
| Đồng bộ peer | Cùng hash + signal chồng lấp | Chỉ peer biết hash của bạn |
| Data local | Giữ trên disk node | Giữ; fork không xóa bài local |

---

## Cài đặt nhanh

Yêu cầu chung: **Node.js 18+** (khuyên 20 LTS), npm, mở cổng HTTP forum (mặc định **3000**). Signaling WebSocket thường **4000** nếu tự host.

### Windows (máy cá nhân)

1. Cài [Node.js LTS](https://nodejs.org/) (tick thêm npm).
2. Giải nén mã nguồn Forum P2P.
3. PowerShell:

```powershell
cd đường-dẫn\forum-p2p
npm install
$env:PORT = "3000"
# Tuỳ chọn ổn định disk qua lần deploy:
# $env:NODE_DISK_SECRET = "chuỗi-ngẫu-nhiên-dài"
npm start
```

4. Mở `http://localhost:3000`.
5. Mặc định đã vào **mạng genesis**. Sign in (secret key `S…`) để post / Setup node / My Acc.
6. (Khuyên) Cài LocalMod + `LOCALMOD_URL` — xem [Moderation guide](/docs/MODERATION-GUIDE.md).

**Signaling public:** dùng `https://signal.xgoldmining.com` hoặc tự chạy `signaling-standalone` rồi tunnel (Cloudflare / ngrok) nếu cần URL public.

### Ubuntu (VPS / máy chủ)

```bash
sudo apt update
sudo apt install -y nodejs npm   # hoặc cài Node 20 từ NodeSource
# Giải nén forum-p2p && cd forum-p2p
npm install
export PORT=3000
# export NODE_DISK_SECRET="chuỗi-ngẫu-nhiên-dài"
# export LOCALMOD_URL=http://127.0.0.1:8000
npm start
```

Chạy nền: `pm2`, `systemd`, hoặc `screen`. Mở firewall cổng 3000 (và 4000 nếu host signaling trên cùng máy).

HTTPS: đặt Nginx / Caddy reverse proxy (Let’s Encrypt).

### Opalstack (host Node.js — khuyến nghị shared hosting)

[Opalstack](https://opalstack.com) hỗ trợ app **Node.js** ổn định, phù hợp forum + (tuỳ chọn) process signaling riêng.

1. Tạo **Node.js app** trong dashboard Opalstack (chọn phiên bản Node ≥ 18).
2. Upload / git clone mã Forum P2P vào thư mục app.
3. **Install**: `npm install` trong directory app.
4. **Startup file**: entry trỏ tới script start của package (`npm start` hoặc `node src/index.js` — theo `package.json`).
5. Biến môi trường (Environment):

```text
PORT=<cổng Opalstack gán cho app>
NODE_DISK_SECRET=<chuỗi bí mật ≥ 16 ký tự, giữ cố định>
LOCALMOD_URL=   # để trống nếu chưa có LocalMod
```

6. **Save & Restart** app.
7. Gán domain / proxy theo hướng dẫn Opalstack (HTTPS).
8. Mở site → xác nhận mesh genesis (banner hash) → Sign in.

**Signaling trên Opalstack:** WebSocket lâu dài có thể cần app Node **thứ hai** chạy `signaling-standalone`, hoặc dùng signaling public genesis. PHP-only hosting **không** chạy được signaling.

**Disk:** không xóa thư mục `data/` (chứa `network-data.disk`, `node-disk.key`, `node-meta.sealed`) khi deploy lại nếu muốn giữ bài local.

---

## Checklist sau khi cài

1. Trang chủ load, rankings / categories hiện.
2. Banner: **Mesh identity OK** + hash genesis (hoặc hash riêng nếu đã create/fork).
3. **Sign in** bằng ví Stellar.
4. **Setup node**: Claim node (chủ máy), Public/Private, moderation guide.
5. **My Acc**: stake / claim theo role.
6. (Public node) bật LocalMod; (nội bộ) bật Private + password.

---

## Tài liệu liên quan

| File | Nội dung |
|------|----------|
| [Moderation setup guide (English)](/docs/MODERATION-GUIDE.md) | LocalMod, Layer 1/2, Windows/Ubuntu |
| Footer → **Node setup** | Hash, signal, lệnh nhanh |
| **Setup node** (in-app) | Claim, access, create network, hard fork |

---

## Tóm tắt một câu

**Forum P2P** là open source trong hệ **XPi**: mỗi người có ví Stellar có thể tham gia viết content trên một lớp internet peer-to-peer, chạy node như máy duy trì mạng thảo luận thu nhỏ, và (theo thiết kế token) có cơ hội nhận thưởng — **không phụ thuộc mô hình monetize content của Google**.

---

*Phiên bản tài liệu khớp Forum P2P v0.6.x. Số liệu stake/thưởng lấy theo contract & UI hiện tại.*
