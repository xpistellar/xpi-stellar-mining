import {
  Contract,
  Horizon,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import { createHash } from "node:crypto";
import { config } from "../utils/config.js";
import { decimalToI128, i128ToDecimal } from "./units.js";

const MIN_STAKE = 314_000_000n;
const MIN_XPI_NODE = 314_000n; // 0.0314 XPi

function horizonServer() {
  return new Horizon.Server(config.horizonUrl, { allowHttp: config.horizonUrl.startsWith("http://") });
}

function soroban() {
  return new rpc.Server(config.rpcUrl, { allowHttp: config.rpcUrl.startsWith("http://") });
}

export function keypairFrom(secret) {
  return Keypair.fromSecret(String(secret || "").trim());
}

/** Generate a new Stellar keypair on this device (sign-up). Secret shown once to the user. */
export function createWallet() {
  const kp = Keypair.random();
  return { publicKey: kp.publicKey(), secretKey: kp.secret() };
}

export function scAddress(publicKey) {
  return nativeToScVal(publicKey, { type: "address" });
}

export function scI128(n) {
  return nativeToScVal(typeof n === "bigint" ? n : BigInt(n), { type: "i128" });
}

export function scU64(n) {
  return nativeToScVal(typeof n === "bigint" ? n : BigInt(n), { type: "u64" });
}

export function scBytesN32(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (b.length !== 32) throw new Error("BytesN must be 32 bytes");
  return nativeToScVal(b, { type: "bytes" });
}

/**
 * Invoke a contract function.
 * @param {string} secretKey
 * @param {string} contractId
 * @param {string} functionName
 * @param {any[]} args
 * @param {boolean} readOnly
 */
export async function invokeContract(secretKey, contractId, functionName, args = [], readOnly = false) {
  const keypair = keypairFrom(secretKey);
  const account = await horizonServer().loadAccount(keypair.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: config.fee,
    networkPassphrase: Networks.PUBLIC,
  })
    .addOperation(new Contract(contractId).call(functionName, ...args))
    .setTimeout(120)
    .build();

  const sim = await soroban().simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${JSON.stringify(sim.error || sim)}`);
  }
  if (readOnly) return sim;

  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(keypair);
  const sent = await soroban().sendTransaction(prepared);
  if (sent.status === "ERROR") throw new Error(`${functionName} rejected`);

  let status;
  for (let i = 0; i < 30; i += 1) {
    await new Promise((r) => setTimeout(r, 2000));
    status = await soroban().getTransaction(sent.hash);
    if (status.status !== "NOT_FOUND" && status.status !== "PENDING") break;
  }
  if (status?.status !== "SUCCESS") {
    throw new Error(`${functionName} failed: ${status?.status || "timeout"} ${sent.hash}`);
  }
  return { hash: sent.hash, status: "SUCCESS", result: status };
}

function retvalToDecimal(sim) {
  const retval = sim.result?.retval;
  if (!retval) return "0";
  const native = scValToNative(retval);
  if (typeof native === "bigint") return i128ToDecimal(native);
  if (typeof native === "number") return i128ToDecimal(BigInt(Math.trunc(native)));
  return String(native ?? "0");
}

function retvalToBool(sim) {
  const retval = sim.result?.retval;
  if (!retval) return false;
  const native = scValToNative(retval);
  return Boolean(native);
}

function retvalToNumber(sim) {
  const retval = sim.result?.retval;
  if (!retval) return 0;
  const native = scValToNative(retval);
  if (typeof native === "bigint") return Number(native);
  return Number(native) || 0;
}

export async function readOnChain(secretKey) {
  const keypair = keypairFrom(secretKey);
  const publicKey = keypair.publicKey();
  const account = await horizonServer().loadAccount(publicKey);
  const native = account.balances.find((row) => row.asset_type === "native");
  const xlm = native?.balance || "0";
  const addr = scAddress(publicKey);

  // Staking views
  const stakeSim = await invokeContract(secretKey, config.stakingId, "get_stake", [addr], true);
  const pendingSim = await invokeContract(secretKey, config.stakingId, "pending", [addr], true);
  const hasMinSim = await invokeContract(secretKey, config.stakingId, "has_min_stake", [addr], true);
  const eligibleSim = await invokeContract(secretKey, config.stakingId, "is_player_eligible", [addr], true);
  const xpiStakedSim = await invokeContract(secretKey, config.stakingId, "get_xpi_staked", [addr], true);

  // Optional XPi SAC balance
  let xpiBalance = "0";
  try {
    const xpiSim = await invokeContract(secretKey, config.xpiSac, "balance", [addr], true);
    xpiBalance = retvalToDecimal(xpiSim);
  } catch {
    /* SAC may not be reachable or no balance */
  }

  return {
    publicKey,
    xlm,
    stake: retvalToDecimal(stakeSim),
    pending: retvalToDecimal(pendingSim),
    hasMinStake: retvalToBool(hasMinSim),
    isPlayerEligible: retvalToBool(eligibleSim),
    xpiStaked: retvalToDecimal(xpiStakedSim),
    xpiBalance,
    stakeSource: "staking",
  };
}

export async function stakeXlm(secretKey, xlmAmount) {
  const amount = decimalToI128(xlmAmount);
  if (amount < MIN_STAKE) throw new Error("Minimum 31.4 XLM");
  return invokeContract(
    secretKey,
    config.stakingId,
    "stake",
    [scAddress(keypairFrom(secretKey).publicKey()), scI128(amount)]
  );
}

export async function unstakeXlm(secretKey, xlmAmount) {
  const raw = String(xlmAmount ?? "").trim();
  const amount = raw === "" || raw === "0" ? 0n : decimalToI128(raw);
  return invokeContract(
    secretKey,
    config.stakingId,
    "unstake",
    [scAddress(keypairFrom(secretKey).publicKey()), scI128(amount)]
  );
}

export async function claimReward(secretKey) {
  return invokeContract(secretKey, config.stakingId, "claim", [scAddress(keypairFrom(secretKey).publicKey())]);
}

export async function stakeXpi(secretKey, xpiAmount) {
  const amount = decimalToI128(xpiAmount);
  if (amount < MIN_XPI_NODE) throw new Error("Minimum 0.0314 XPi to stake for node");
  return invokeContract(
    secretKey,
    config.stakingId,
    "stake_xpi",
    [scAddress(keypairFrom(secretKey).publicKey()), scI128(amount)]
  );
}

export async function unstakeXpi(secretKey, xpiAmount) {
  const amount = decimalToI128(xpiAmount);
  return invokeContract(
    secretKey,
    config.stakingId,
    "unstake_xpi",
    [scAddress(keypairFrom(secretKey).publicKey()), scI128(amount)]
  );
}

export async function hasMinStake(secretKey) {
  const addr = scAddress(keypairFrom(secretKey).publicKey());
  const sim = await invokeContract(secretKey, config.stakingId, "has_min_stake", [addr], true);
  return retvalToBool(sim);
}

export async function isPlayerEligible(secretKey) {
  const addr = scAddress(keypairFrom(secretKey).publicKey());
  const sim = await invokeContract(secretKey, config.stakingId, "is_player_eligible", [addr], true);
  return retvalToBool(sim);
}

export async function getXpiStaked(secretKey) {
  const addr = scAddress(keypairFrom(secretKey).publicKey());
  const sim = await invokeContract(secretKey, config.stakingId, "get_xpi_staked", [addr], true);
  return retvalToDecimal(sim);
}

/**
 * Pay topic fee on Content contract.
 * @param {string} secretKey
 * @param {bigint|number|string} postId u64
 * @param {Buffer|Uint8Array} contentHash 32 bytes
 */
export async function payForTopic(secretKey, postId, contentHash) {
  const addr = scAddress(keypairFrom(secretKey).publicKey());
  const pid = scU64(postId);
  const hash = scBytesN32(contentHash);
  return invokeContract(secretKey, config.contentId, "pay_for_topic", [addr, pid, hash]);
}

export async function likePost(secretKey, postId) {
  const addr = scAddress(keypairFrom(secretKey).publicKey());
  const pid = scU64(postId);
  return invokeContract(secretKey, config.contentId, "like_post", [addr, pid]);
}

export async function claimNode(secretKey) {
  return invokeContract(secretKey, config.contentId, "claim_node", [
    scAddress(keypairFrom(secretKey).publicKey()),
  ]);
}

export async function triggerDaily(secretKey) {
  return invokeContract(secretKey, config.distId, "trigger_daily", [
    scAddress(keypairFrom(secretKey).publicKey()),
  ]);
}

export async function canTriggerToday(secretKey) {
  const sim = await invokeContract(secretKey, config.distId, "can_trigger_today", [], true);
  return retvalToBool(sim);
}

export function makeContentHash(title, body) {
  return createHash("sha256").update(`${title}\n${body}`).digest();
}

/** Generate a reasonably unique u64 post id from timestamp + random */
export function makePostId() {
  const ts = BigInt(Date.now());
  const rand = BigInt(Math.floor(Math.random() * 1_000_000));
  return ts * 1000000n + rand;
}

export function canAfford(balance, fee) {
  try {
    return decimalToI128(balance) >= decimalToI128(fee);
  } catch {
    return false;
  }
}

export const MIN_STAKE_XLM = "31.4";
export const MIN_NODE_XPI = "0.0314";
