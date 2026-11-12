export function createPeerManager(self) {
  const peers = new Map();

  function upsert(peer) {
    if (!peer?.id || peer.id === self.id) return;
    peers.set(peer.id, {
      id: peer.id,
      stakeXlm: Number(peer.stakeXlm || 0),
      diskGb: Number(peer.diskGb || 0),
      seenAt: Date.now(),
    });
  }

  function ranked() {
    return [...peers.values()].sort((a, b) => {
      const sa = a.stakeXlm * 10 + a.diskGb;
      const sb = b.stakeXlm * 10 + b.diskGb;
      return sb - sa;
    });
  }

  function superPeers(limit = 3) {
    return ranked().slice(0, limit);
  }

  return { upsert, ranked, superPeers, self };
}
