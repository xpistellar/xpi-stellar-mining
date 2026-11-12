## v0.6.7

- Role split: node **admin** (local) vs **moderator** / **super_admin** (network)
- `claim_node` local reward after 48h eligibility (31.4 XLM + 0.0314 XPi)
- Super_admin only appoints moderators & network moderation
- Hash vs signaling documented in SETUP

# Forum P2P — Version history & feature map

**Current package version:** `0.6.0`

## 0.6.0 — Forum-first UX · Kết nối · Login / Signup / Tạo mạng trên topbar

- Vào site là **màn hình diễn đàn** (không còn gate setup/login chặn toàn trang)
- Nút **Kết nối** nổi trên topbar: nhập networkHash + Signaling URL (join) hoặc cập nhật signaling nếu đã có mesh
- Cạnh Admin: **Đăng nhập**, **Đăng ký**, **Tạo mạng** (genesis) dạng modal
- Banner gợi ý khi chưa kết nối mesh
- API `POST /api/setup/signaling` đổi bootstrap sau khi đã setup
- Guest board hướng dẫn 3 bước trước khi login

---


**Current package version:** `0.5.3`  
**Runtime:** Node.js ≥ 18 (Express + WebRTC multi-signaling + Stellar/Soroban)  
**Not a PHP application** — shared hosting *chỉ PHP* không chạy node forum. Cần VPS / cloud / cPanel Node, hoặc máy local. Signaling standalone cũng cần Node (WebSocket).

---

## 0.5.3 — Multi-signaling admin · download standalone · footer hướng dẫn

- **Multi signaling URL** lưu trong `network-identity.sealed` (primary = dòng đầu; client failover lần lượt)
- **Admin Console → Multi Signaling:** liệt kê / sửa danh sách URL, nút tải `signaling-standalone.zip`
- API: `GET/PUT /api/admin/signaling`, `GET /api/public/node-info`, `GET /download/signaling-standalone.zip`
- Hướng dẫn trong panel admin: VPS, cPanel Node App, shared host PHP (tunnel), Cloudflare Tunnel, health check
- **Footer public:** hiện node id, mesh short hash, danh sách signal; details hướng dẫn hash · signal · lệnh chạy
- Client mesh dùng `signalingWsUrls` (thử lần lượt khi disconnect)
- `npm run pack-signaling` đóng gói zip vào `deploy/`
- Tài liệu cài Windows / Ubuntu chi tiết cho người mới (`CAI-DAT.md`)

---

## 0.5.2 — Multi-signal env + standalone package

- `SIGNALING_URLS` (comma-separated) + `signalingUrls` trong config
- Thư mục `signaling-standalone/` tách bootstrap WebRTC (zero dependency forum)
- Mesh client: `wsUrls` failover

---

## 0.5.1 — Network setup · networkHash · genesis / join

- Trang setup lần đầu: **Tạo mạng** (genesis, tự sinh hash) hoặc **Join** (dán hash)
- `data/network-identity.sealed` (HMAC)
- Signaling lọc peer theo `networkHash`
- Mesh hello gửi `networkHash`
- Tài liệu `SETUP-MANG.md`

---

## 0.5.0 — Install CLI · login ví · bảo mật node-meta

- Sign in / Sign up ví Stellar, Buy XLM
- `node-meta.sealed` HMAC, roles super/admin/mod/user
- CLI `npm run install-node`

---

## 0.4.0 — UI phpBB · category lồng nhau · sticky · tag · Markdown

## 0.3.0 — Admin console · moderator toàn mạng

## 0.2.5 — Roles · ký bài P2P

## 0.2.0 — Hard-block + LocalMod

## 0.1.0 — Nền tảng Express + disk + stake + WebRTC

---

## Bản đồ tính năng hiện tại (0.5.3)

| Khu vực | Có |
|---------|----|
| Login / tạo ví Stellar / mua XLM | ✓ |
| Setup genesis / join networkHash | ✓ |
| **Multi signaling URL + admin list** | ✓ |
| **Tải signaling-standalone.zip** | ✓ |
| Forum categories lồng nhau | ✓ |
| Topic + Markdown an toàn + tag + sticky | ✓ |
| Like / view / ranking | ✓ |
| Hard-block + LocalMod | ✓ |
| Roles super/admin/mod/user | ✓ |
| Admin console (mod, bài, category, signal) | ✓ |
| P2P sync có chữ ký | ✓ |
| Stake XLM on-chain | ✓ |
| CLI cài node | ✓ |
| Footer hướng dẫn hash/signal/lệnh | ✓ |
| Chạy trên host **chỉ PHP** | ✗ (cần Node 18+) |