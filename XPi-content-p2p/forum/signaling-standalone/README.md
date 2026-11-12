# Signaling standalone — trung gian bắt tay WebRTC

Chỉ làm **giới thiệu peer** (SDP/ICE). Không lưu bài, không cần Stellar.

## Chạy

```bash
cd signaling-standalone
npm install
npm start
# hoặc SIGNAL_PORT=4000 npm start
```

Public: mở port, hoặc Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:4000
```

Forum node / setup điền Signaling URL = URL public đó (http→ws, https→wss tự đổi phía client).

Health: `GET /health` → `{"ok":true,"role":"signaling-standalone",...}`

## Nhiều signaling URL?

- **Cùng một mesh:** mọi node nên trỏ **cùng một** bootstrap đang online (hoặc danh sách fallback — client thử lần lượt).
- Chạy **nhiều server signaling** = dự phòng; peer A chỉ thấy peer B nếu cả hai đang kết nối **cùng một** server (bản này không bridge liên server).
- **Khác networkHash** trên cùng server = phòng khác, không gặp nhau.

Admin forum (v0.5.3+) có form liệt kê multi-URL và nút tải zip gói này.

## PHP / shared host?

Shared hosting PHP thường **không** có WebSocket process lâu dài. Dùng:

- VPS + file này, hoặc
- cPanel Node App trỏ `server.mjs`, hoặc
- Tunnel về máy nhà chạy `npm start`

Xem `WHY-NOT-PHP.md`.
