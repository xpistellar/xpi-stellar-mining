# Mạng node · networkHash · multi-signaling · genesis

## Trả lời thẳng câu hỏi

### 1. Tạo hash lần đầu (không điền hash khác) → node này là gì?

Node đó là **genesis của một mesh riêng** (hard-fork / mạng private):

- Sinh `networkHash` (SHA-256)
- Ghi `data/network-identity.sealed`
- `genesis: true`
- User login đầu tiên trên node vẫn là **admin node** như trước

**Không** có nghĩa node này phải chứa mọi bài mãi mãi. Dữ liệu vẫn sync P2P giữa các peer **cùng hash**. Genesis chỉ là: người tạo id mạng + thường cũng là nơi bạn đặt **bootstrap signaling** cho người khác join.

### 2. Node khác join thế nào?

Trên setup chọn **Join**, điền:

1. **networkHash** đầy đủ (genesis copy cho bạn — kênh tin cậy)
2. **Signaling URL** trùng bootstrap của mạng (vd. `https://signal.domain.com` hoặc `http://IP-VPS:4000`)

Từ v0.5.3 admin có thể lưu **nhiều** signaling URL; client thử lần lượt. Peer chỉ thấy nhau nếu đang nối **cùng một** server signaling (bản này không bridge liên server).

Signaling lọc peer theo `networkHash` → mesh A không thấy mesh B.

### 3. Có bắt buộc config IP / Cloudflare Tunnel?

| Tình huống | Cần gì |
|------------|--------|
| Chỉ máy trong nhà (LAN) | `http://192.168.x.x:4000` là đủ |
| Peer qua internet | **Phải** có địa chỉ signaling **public**: IP VPS + mở port, **hoặc** Cloudflare Tunnel / ngrok |

Hai lớp:

```
[networkHash]     ─── ai được vào “câu lạc bộ”
[signaling URL(s)] ─── làm sao tìm được nhau qua NAT/internet (multi = failover)
[WebRTC data]     ─── sync bài (P2P), không đi qua signaling sau khi nối xong
```

### 4. Multi signaling dùng thế nào?

1. Admin → **Multi Signaling** → mỗi dòng một URL (dòng 1 = primary)  
2. Hoặc env: `SIGNALING_URLS=https://s1.example,https://s2.example`  
3. Client (`mesh.js`) kết nối URL đầu; nếu socket đóng → thử URL kế  

**Lưu ý:** hai peer phải cùng “gặp” trên **một** instance signaling. Chạy 2 server signaling độc lập chỉ là dự phòng — không tự đồng bộ danh sách peer giữa hai server.

### 5. Shared host / PHP?

Signaling cần WebSocket process dài hạn → **không** phù hợp shared PHP thuần. Dùng:

- VPS + `signaling-standalone` (tải từ Admin hoặc `/download/signaling-standalone.zip`)
- cPanel Node App → `server.mjs`
- Tunnel về máy nhà: `cloudflared tunnel --url http://127.0.0.1:4000`

Xem `signaling-standalone/WHY-NOT-PHP.md`.

### 6. “Node chính” có phải 1 máy suốt đời?

- **Bootstrap (signaling):** nên có **ít nhất một** endpoint ổn định, public. Có thể genesis hoặc VPS riêng.
- **Dữ liệu forum:** mỗi node giữ disk riêng; sync ngang hàng. Tắt genesis sau khi peer đã nối → mesh vẫn sống nếu còn peer + còn chỗ signaling cho peer mới.

Khuyến nghị:

1. VPS nhỏ: chạy `signaling-standalone` (+ optional forum genesis)  
2. Máy nhà: join cùng hash, trỏ multi-signal list  
3. Chia sẻ hash qua kênh riêng (không post công khai nếu mesh private)

## Setup UI

Lần đầu mở site → **Thiết lập node**:

- Tab 1: Tạo mạng mới (genesis)
- Tab 2: Join (dán hash + signaling)

Sau setup → login ví Stellar.

Reset mesh trên máy: xóa `data/network-identity.sealed` (và cân nhắc disk nếu muốn mạng sạch).

## Footer public

Footer hiện node id, mesh short, danh sách signal. Mở **Hướng dẫn thiết lập node** để xem lệnh chạy nhanh.


## Official mesh (default after install)

Fresh installs **auto-join** the public XPi Stellar Forum mesh:

- **Signaling:** `https://signal.xgoldmining.com`
- **networkHash:** see `src/network/defaults.js` (`OFFICIAL_MESH`)

No need to Create network unless you want a **private fork**.

| Goal | Action |
|------|--------|
| Join official forum | `npm install` → `npm start` (automatic) |
| Private mesh | Delete `data/network-identity.sealed` → UI **Create network** |
| Skip auto-join | `SKIP_DEFAULT_MESH=1 npm start` |

Override with env: `DEFAULT_NETWORK_HASH`, `DEFAULT_SIGNALING_URL`, `DEFAULT_NETWORK_LABEL`.


## Hash vs signaling (same mesh)

| Piece | Role |
|-------|------|
| **networkHash** | Logical network id. Peers **must share the same hash** or they reject each other’s posts. |
| **Signaling URL** | Bootstrap only (WebRTC peer discovery). |

- **Same hash + same signaling (or overlapping multi-signal list)** → nodes find each other and sync.
- **Same hash + different signaling servers with no overlap** → same “network name” on paper, but **no discovery** → no auto-sync until they share a live signal.
- **Different hash** → different mesh forever, even on the same signaling server.

Multi-signaling: put several URLs in the admin list; clients try each until peers appear.
