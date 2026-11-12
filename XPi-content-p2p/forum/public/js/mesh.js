const channels = new Map();
const pcs = new Map();

function toWsUrl(httpUrl) {
  const url = new URL(httpUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString().replace(/\/$/, "");
}

/**
 * @param {object} opts
 * @param {string} [opts.wsUrl]
 * @param {string[]} [opts.wsUrls]
 * @param {(s: object) => void} [opts.onStatus]
 */
export function startMesh({
  wsUrl,
  wsUrls,
  nodeId,
  stakeXlm,
  diskGb,
  networkHash,
  onPosts,
  onStatus,
  onNeedPosts,
}) {
  const urls = (wsUrls && wsUrls.length ? wsUrls : [wsUrl])
    .filter(Boolean)
    .map((u) => (u.startsWith("ws") ? u.replace(/\/$/, "") : toWsUrl(u)));

  let socket = null;
  let urlIndex = 0;
  const pending = [];
  let closed = false;
  let signalState = "idle";
  let currentUrl = urls[0] || "";
  let lastPeerCount = 0;
  let lastSyncAt = null;
  let lastError = null;
  let openChannels = 0;

  function emitStatus() {
    openChannels = [...channels.values()].filter((c) => c.readyState === "open").length;
    const status = {
      signalState,
      currentUrl,
      peerSlots: pcs.size,
      openChannels,
      lastPeerCount,
      lastSyncAt,
      lastError,
      networkHash: networkHash || "",
      urls,
    };
    try {
      onStatus?.(status);
    } catch {
      /* */
    }
    return status;
  }

  function connectSocket() {
    if (closed || !urls.length) {
      signalState = urls.length ? "closed" : "no-url";
      emitStatus();
      return;
    }
    const target = urls[urlIndex % urls.length];
    currentUrl = target;
    signalState = "connecting";
    emitStatus();
    try {
      socket = new WebSocket(target);
    } catch (e) {
      lastError = String(e?.message || e);
      signalState = "error";
      emitStatus();
      urlIndex += 1;
      setTimeout(connectSocket, 1500);
      return;
    }
    socket.addEventListener("open", () => {
      signalState = "connected";
      lastError = null;
      emitStatus();
      socket.send(
        JSON.stringify({
          type: "hello",
          id: nodeId,
          stakeXlm: stakeXlm || 0,
          diskGb: diskGb || 0,
          networkHash: networkHash || "",
        })
      );
      for (const packet of pending.splice(0)) socket.send(packet);
    });
    socket.addEventListener("message", async (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "peers") {
        const ranked = (msg.peers || []).slice(0, 4);
        lastPeerCount = ranked.length;
        emitStatus();
        for (const peer of ranked) connect(peer.id, nodeId > peer.id);
        return;
      }
      if (msg.type === "signal") await onSignal(msg.from, msg.data);
    });
    socket.addEventListener("close", () => {
      signalState = "closed";
      emitStatus();
      if (closed) return;
      urlIndex += 1;
      setTimeout(connectSocket, 2000);
    });
    socket.addEventListener("error", () => {
      lastError = "websocket error";
      signalState = "error";
      emitStatus();
      try {
        socket.close();
      } catch {
        /* */
      }
    });
  }

  function sendSignal(to, data) {
    const packet = JSON.stringify({ type: "signal", to, data });
    if (socket?.readyState === WebSocket.OPEN) socket.send(packet);
    else pending.push(packet);
  }

  function connect(peerId, polite) {
    if (pcs.has(peerId) || peerId === nodeId) return;
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcs.set(peerId, { pc, polite, making: false });
    emitStatus();
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
    channel.onopen = () => emitStatus();
    channel.onclose = () => emitStatus();
    channel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "sync-request") {
          // Peer asked us to push our board
          Promise.resolve(onNeedPosts?.())
            .then((payload) => {
              if (!payload) return;
              const body = JSON.stringify({
                type: "posts",
                posts: payload.posts || [],
                modActions: payload.modActions || [],
                roleGrants: payload.roleGrants || [],
              });
              if (channel.readyState === "open") channel.send(body);
            })
            .catch(() => {});
          return;
        }
        if (msg.type === "posts") {
          lastSyncAt = Date.now();
          emitStatus();
          onPosts?.({
            posts: msg.posts || [],
            modActions: msg.modActions || [],
            roleGrants: msg.roleGrants || [],
          });
        }
      } catch {
        /* */
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
      const offerCollision =
        data.description.type === "offer" &&
        (row.making || row.pc.signalingState !== "stable");
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
        /* */
      }
    }
  }

  function publish(posts, modActions = [], roleGrants = []) {
    const body = JSON.stringify({ type: "posts", posts, modActions, roleGrants });
    for (const channel of channels.values()) {
      if (channel.readyState === "open") channel.send(body);
    }
  }

  /** Ask every open peer to push their posts; also push ours. */
  async function forceSync() {
    const req = JSON.stringify({ type: "sync-request", at: Date.now() });
    let asked = 0;
    for (const channel of channels.values()) {
      if (channel.readyState === "open") {
        channel.send(req);
        asked += 1;
      }
    }
    // Push our snapshot too
    try {
      const payload = await onNeedPosts?.();
      if (payload?.posts?.length) {
        publish(payload.posts, payload.modActions || [], payload.roleGrants || []);
      }
    } catch {
      /* */
    }
    // Nudge signaling: re-hello if socket open
    if (socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(
          JSON.stringify({
            type: "hello",
            id: nodeId,
            stakeXlm: stakeXlm || 0,
            diskGb: diskGb || 0,
            networkHash: networkHash || "",
          })
        );
      } catch {
        /* */
      }
    } else if (!closed) {
      // force reconnect cycle
      urlIndex += 1;
      try {
        socket?.close();
      } catch {
        /* */
      }
    }
    return { asked, status: emitStatus() };
  }

  function stop() {
    closed = true;
    try {
      socket?.close();
    } catch {
      /* */
    }
  }

  function getStatus() {
    return emitStatus();
  }

  connectSocket();
  return { publish, stop, getStatus, forceSync };
}
