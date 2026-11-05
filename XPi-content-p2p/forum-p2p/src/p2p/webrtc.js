import { log } from "../utils/logger.js";

/**
 * Minimal peer channel.
 * Swap `send` / `onMessage` for a real RTCDataChannel (wrtc / node-datachannel)
 * once offer/answer/ICE are exchanged through signaling.
 */
export function createChannel({ nodeId, onMessage }) {
  const inbox = [];

  function send(peerId, message) {
    const packet = { from: nodeId, to: peerId, message, at: Date.now() };
    inbox.push(packet);
    log("webrtc", `queued ${message.type} -> ${peerId}`);
    if (onMessage) onMessage(packet);
    return packet;
  }

  return { send, inbox };
}
