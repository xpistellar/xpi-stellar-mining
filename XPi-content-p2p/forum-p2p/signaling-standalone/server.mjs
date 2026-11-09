#!/usr/bin/env node
/**
 * Forum P2P — standalone signaling (WebSocket + HTTP)
 * Zero dependency on the rest of the forum. Only needs: npm i ws
 *
 *   cd signaling-standalone && npm install && npm start
 *   SIGNAL_PORT=4000 node server.mjs
 *
 * Role: introduce peers that share the same networkHash.
 * Does NOT store posts. After WebRTC connects, data flows peer-to-peer.
 */

import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.SIGNAL_PORT || process.env.PORT || 4000);
const peers = new Map(); // id -> { id, stakeXlm, diskGb, networkHash, socket }

function sameNet(a, b) {
  if (!a || !b) return false;
  a = String(a).toLowerCase();
  b = String(b).toLowerCase();
  return a === b || a.startsWith(b.slice(0, 12)) || b.startsWith(a.slice(0, 12));
}

function list(exceptId, networkHash) {
  return [...peers.values()]
    .filter((p) => p.id !== exceptId)
    .filter((p) => sameNet(p.networkHash, networkHash))
    .map((p) => ({
      id: p.id,
      stakeXlm: p.stakeXlm,
      diskGb: p.diskGb,
      networkShort: (p.networkHash || "").slice(0, 12),
    }))
    .sort((a, b) => b.stakeXlm * 10 + b.diskGb - (a.stakeXlm * 10 + a.diskGb));
}

function broadcast() {
  for (const peer of peers.values()) {
    if (peer.socket.readyState === 1) {
      peer.socket.send(
        JSON.stringify({ type: "peers", peers: list(peer.id, peer.networkHash) })
      );
    }
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  res.setHeader("access-control-allow-origin", "*");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (url.pathname === "/health" || url.pathname === "/") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        role: "signaling-standalone",
        peers: peers.size,
        port: PORT,
      })
    );
    return;
  }
  if (url.pathname === "/peers") {
    const nh = url.searchParams.get("networkHash") || "";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ peers: list(null, nh || undefined) }));
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
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
      broadcast();
      return;
    }
    if (msg.type === "signal" && msg.to && peers.has(msg.to) && id) {
      const from = peers.get(id);
      const to = peers.get(msg.to);
      if (!from || !to) return;
      if (from.networkHash && to.networkHash && !sameNet(from.networkHash, to.networkHash)) {
        return;
      }
      if (to.socket.readyState === 1) {
        to.socket.send(JSON.stringify({ type: "signal", from: id, data: msg.data }));
      }
    }
  });
  socket.on("close", () => {
    if (id && peers.get(id)?.socket === socket) {
      peers.delete(id);
      broadcast();
    }
  });
  socket.on("error", () => {});
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[signaling-standalone] http+ws on 0.0.0.0:${PORT}`);
  console.log(`[signaling-standalone] health: http://127.0.0.1:${PORT}/health`);
});
