const channels = new Map();
const pcs = new Map();

export function startMesh({ wsUrl, nodeId, stakeXlm, diskGb, onPosts }) {
  const socket = new WebSocket(wsUrl);
  const pending = [];

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "hello", id: nodeId, stakeXlm, diskGb }));
  });

  socket.addEventListener("message", async (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "peers") {
      const ranked = (msg.peers || []).slice(0, 4);
      for (const peer of ranked) connect(peer.id, nodeId > peer.id);
      return;
    }
    if (msg.type === "signal") await onSignal(msg.from, msg.data);
  });

  function sendSignal(to, data) {
    const packet = JSON.stringify({ type: "signal", to, data });
    if (socket.readyState === WebSocket.OPEN) socket.send(packet);
    else pending.push(packet);
  }

  socket.addEventListener("open", () => {
    for (const packet of pending.splice(0)) socket.send(packet);
  });

  function connect(peerId, polite) {
    if (pcs.has(peerId) || peerId === nodeId) return;
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcs.set(peerId, { pc, polite, making: false });
    pc.onicecandidate = (event) => {
      if (event.candidate) sendSignal(peerId, { candidate: event.candidate });
    };
    pc.ondatachannel = (event) => bindChannel(peerId, event.channel);
    const outbound = pc.createDataChannel("forum");
    bindChannel(peerId, outbound);
    negotiate(peerId);
    return pc;
  }

  function bindChannel(peerId, channel) {
    channels.set(peerId, channel);
    channel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "posts" && Array.isArray(msg.posts)) onPosts(msg.posts);
      } catch {
        /* ignore malformed peer payload */
      }
    };
  }

  async function negotiate(peerId) {
    const row = pcs.get(peerId);
    if (!row || row.making) return;
    row.making = true;
    const offer = await row.pc.createOffer();
    await row.pc.setLocalDescription(offer);
    sendSignal(peerId, { description: row.pc.localDescription });
    row.making = false;
  }

  async function onSignal(peerId, data) {
    if (!pcs.has(peerId)) connect(peerId, nodeId > peerId);
    const row = pcs.get(peerId);
    if (data.description) {
      const offerCollision = data.description.type === "offer" && (row.making || row.pc.signalingState !== "stable");
      if (offerCollision && !row.polite) return;
      await row.pc.setRemoteDescription(data.description);
      if (data.description.type === "offer") {
        await row.pc.setLocalDescription(await row.pc.createAnswer());
        sendSignal(peerId, { description: row.pc.localDescription });
      }
    }
    if (data.candidate) {
      try {
        await row.pc.addIceCandidate(data.candidate);
      } catch {
        /* candidate arrived early */
      }
    }
  }

  function publish(posts) {
    const body = JSON.stringify({ type: "posts", posts });
    for (const channel of channels.values()) {
      if (channel.readyState === "open") channel.send(body);
    }
  }

  return { publish, socket };
}
