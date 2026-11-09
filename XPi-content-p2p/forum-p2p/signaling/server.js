import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const peers = new Map();
const PORT = Number(process.env.SIGNAL_PORT || 4000);

function list(except, networkHash) {
  return [...peers.values()]
    .filter((p) => p.id !== except)
    .filter((p) => {
      if (!networkHash) return true;
      const a = String(p.networkHash || "");
      const b = String(networkHash || "");
      if (!a || !b) return false;
      return a === b || a.startsWith(b.slice(0, 12)) || b.startsWith(a.slice(0, 12));
    })
    .map((p) => ({
      id: p.id,
      stakeXlm: p.stakeXlm,
      diskGb: p.diskGb,
      networkShort: (p.networkHash || "").slice(0, 12),
    }))
    .sort((a, b) => b.stakeXlm * 10 + b.diskGb - (a.stakeXlm * 10 + a.diskGb));
}

function broadcastPeers() {
  for (const peer of peers.values()) {
    peer.socket.send(
      JSON.stringify({ type: "peers", peers: list(peer.id, peer.networkHash) })
    );
  }
}

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/peers") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ peers: list() }));
    return;
  }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, role: "signaling", note: "peers filtered by networkHash" }));
});

const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  let id = "";
  socket.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.type === "hello" && msg.id) {
      id = String(msg.id).slice(0, 64);
      peers.set(id, {
        id,
        stakeXlm: Number(msg.stakeXlm || 0),
        diskGb: Number(msg.diskGb || 0),
        networkHash: String(msg.networkHash || "").toLowerCase().slice(0, 64),
        socket,
      });
      broadcastPeers();
      return;
    }
    if (msg.type === "signal" && msg.to && peers.has(msg.to)) {
      const from = peers.get(id);
      const to = peers.get(msg.to);
      // only signal within same network
      if (from?.networkHash && to?.networkHash) {
        const a = from.networkHash;
        const b = to.networkHash;
        if (!(a === b || a.startsWith(b.slice(0, 12)) || b.startsWith(a.slice(0, 12)))) {
          return;
        }
      }
      to.socket.send(JSON.stringify({ type: "signal", from: id, data: msg.data }));
    }
  });
  socket.on("close", () => {
    if (id && peers.get(id)?.socket === socket) {
      peers.delete(id);
      broadcastPeers();
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`signaling http+ws on :${PORT} (networkHash-aware)`);
});
