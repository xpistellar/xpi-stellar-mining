import { randomUUID } from "node:crypto";
import { readNetworkIdentity } from "../network/identity.js";

const net = (() => {
  try {
    return readNetworkIdentity();
  } catch {
    return null;
  }
})();

function mergeSignalList(envList, idList, primary) {
  const out = [];
  const seen = new Set();
  const push = (u) => {
    const s = String(u || "")
      .trim()
      .replace(/\/$/, "");
    if (!s) return;
    const k = s.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(s);
  };
  push(primary);
  for (const u of idList || []) push(u);
  for (const u of envList || []) push(u);
  return out.slice(0, 12);
}

const envSignals = (process.env.SIGNALING_URLS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const primarySignal =
  process.env.SIGNALING_URL ||
  net?.signalingUrl ||
  "https://signal.xgoldmining.com";

export const config = {
  port: Number(process.env.PORT || 3000),
  signalingUrl: primarySignal.replace(/\/$/, ""),
  /** Multi bootstrap — client tries in order (failover). */
  signalingUrls: mergeSignalList(envSignals, net?.signalingUrls, primarySignal),
  nodeId: process.env.NODE_ID || net?.nodeName || `node-${randomUUID().slice(0, 8)}`,
  diskPath: process.env.DISK_PATH || "./data/network-data.disk",
  minDiskGb: Number(process.env.MIN_DISK_GB || 100),
  topicFee: process.env.TOPIC_FEE || "0.0000021",
  likeFee: process.env.LIKE_FEE || "0.0000001",
  viewMilestone: Number(process.env.VIEW_MILESTONE || 1_000_000),
  contractId: process.env.CONTRACT_ID || "CDQ4OO3FU3CBNVWZX2GDU4BQQNQFAHBITTXULTVIECY4OMJGTM33M73H",
  horizonUrl: process.env.HORIZON_URL || "https://horizon.stellar.org",
  rpcUrl: process.env.SOROBAN_RPC_URL || "https://mainnet.sorobanrpc.com",
  fee: process.env.TX_FEE || "500000",
  network: "PUBLIC",
  localmodUrl: process.env.LOCALMOD_URL || "",
  buyXlmUrl:
    process.env.BUY_XLM_URL ||
    "https://stellarterm.com/buy-crypto?crypto=xlm&network=stellar",
  networkHash: net?.networkHash || process.env.NETWORK_HASH || "",
  networkShort: net?.networkShort || "",
  networkLabel: net?.networkLabel || "",
  isGenesis: Boolean(net?.genesis),
};

export function signalingWsUrl(httpUrl) {
  const url = new URL(httpUrl || config.signalingUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString().replace(/\/$/, "");
}

export function signalingWsUrls() {
  const list = config.signalingUrls?.length ? config.signalingUrls : [config.signalingUrl];
  return list.map((u) => signalingWsUrl(u));
}

/** Reload identity into config after setup / admin update (same process) */
export function applyNetworkIdentity(id) {
  if (!id) return;
  config.networkHash = id.networkHash || "";
  config.networkShort = id.networkShort || "";
  config.networkLabel = id.networkLabel || "";
  config.isGenesis = Boolean(id.genesis);
  if (id.signalingUrl) config.signalingUrl = String(id.signalingUrl).replace(/\/$/, "");
  if (id.signalingUrls?.length) {
    config.signalingUrls = mergeSignalList(envSignals, id.signalingUrls, id.signalingUrl || config.signalingUrl);
  } else if (id.signalingUrl) {
    config.signalingUrls = mergeSignalList(envSignals, [], id.signalingUrl);
  }
  if (id.nodeName) config.nodeId = id.nodeName;
}
