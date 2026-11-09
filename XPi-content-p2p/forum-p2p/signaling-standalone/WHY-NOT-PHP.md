# Vì sao không làm signaling bằng PHP shared?

1. WebRTC cần trao SDP/ICE **hai chiều, gần realtime** → WebSocket (hoặc SSE + POST phức tạp và kém).
2. PHP trên shared host thường **request-response**, hết request là hết process — không giữ hàng nghìn kết nối WS.
3. Cần extension/`Ratchet` + quyền chạy daemon — đa số host shared không cho.

**Giải pháp:** `server.mjs` (Node, 1 file) trên VPS 1GB hoặc Cloudflare Tunnel về máy local.
