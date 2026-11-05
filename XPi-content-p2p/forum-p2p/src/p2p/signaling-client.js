import { log } from "../utils/logger.js";

export async function announce(signalingUrl, hello) {
  try {
    const res = await fetch(`${signalingUrl}/announce`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(hello),
    });
    if (!res.ok) throw new Error(`signaling ${res.status}`);
    const body = await res.json();
    return body.peers || [];
  } catch (err) {
    log("signaling", `bootstrap skipped: ${err.message}`);
    return [];
  }
}
