import { randomUUID } from "node:crypto";

export const config = {
  port: Number(process.env.PORT || 3000),
  signalingUrl: process.env.SIGNALING_URL || "http://127.0.0.1:4000",
  nodeId: process.env.NODE_ID || `node-${randomUUID().slice(0, 8)}`,
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
};

export function signalingWsUrl() {
  const url = new URL(config.signalingUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString().replace(/\/$/, "");
}
