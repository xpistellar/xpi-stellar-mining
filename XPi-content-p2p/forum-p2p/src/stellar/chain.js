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
import { config } from "../utils/config.js";
import { decimalToI128, i128ToDecimal } from "./units.js";

const MIN_STAKE = 314_000_000n;

function horizonServer() {
  return new Horizon.Server(config.horizonUrl, { allowHttp: config.horizonUrl.startsWith("http://") });
}

function soroban() {
  return new rpc.Server(config.rpcUrl, { allowHttp: config.rpcUrl.startsWith("http://") });
}

export function keypairFrom(secret) {
  return Keypair.fromSecret(String(secret || "").trim());
}

export function scAddress(publicKey) {
  return nativeToScVal(publicKey, { type: "address" });
}

export function scI128(n) {
  return nativeToScVal(typeof n === "bigint" ? n : BigInt(n), { type: "i128" });
}

export async function invokeContract(secretKey, functionName, args = [], readOnly = false) {
  const keypair = keypairFrom(secretKey);
  const account = await horizonServer().loadAccount(keypair.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: config.fee,
    networkPassphrase: Networks.PUBLIC,
  })
    .addOperation(new Contract(config.contractId).call(functionName, ...args))
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
  return { hash: sent.hash, status: "SUCCESS" };
}

function retvalToDecimal(sim) {
  const retval = sim.result?.retval;
  if (!retval) return "0";
  const native = scValToNative(retval);
  if (typeof native === "bigint") return i128ToDecimal(native);
  if (typeof native === "number") return i128ToDecimal(BigInt(Math.trunc(native)));
  return String(native ?? "0");
}

export async function readOnChain(secretKey) {
  const keypair = keypairFrom(secretKey);
  const publicKey = keypair.publicKey();
  const account = await horizonServer().loadAccount(publicKey);
  const native = account.balances.find((row) => row.asset_type === "native");
  const xlm = native?.balance || "0";
  const addr = scAddress(publicKey);
  const stakeSim = await invokeContract(secretKey, "get_stake", [addr], true);
  const pendingSim = await invokeContract(secretKey, "pending", [addr], true);
  return {
    publicKey,
    xlm,
    stake: retvalToDecimal(stakeSim),
    pending: retvalToDecimal(pendingSim),
    stakeSource: "get_stake",
  };
}

export async function stakeXlm(secretKey, xlmAmount) {
  const amount = decimalToI128(xlmAmount);
  if (amount < MIN_STAKE) throw new Error("Tối thiểu 31.4 XLM");
  return invokeContract(secretKey, "stake", [scAddress(keypairFrom(secretKey).publicKey()), scI128(amount)]);
}

export async function unstakeXlm(secretKey, xlmAmount) {
  const raw = String(xlmAmount ?? "").trim();
  const amount = raw === "" || raw === "0" ? 0n : decimalToI128(raw);
  return invokeContract(secretKey, "unstake", [scAddress(keypairFrom(secretKey).publicKey()), scI128(amount)]);
}

export async function claimReward(secretKey) {
  return invokeContract(secretKey, "claim", [scAddress(keypairFrom(secretKey).publicKey())]);
}

export function canAfford(balance, fee) {
  try {
    return decimalToI128(balance) >= decimalToI128(fee);
  } catch {
    return false;
  }
}

export const MIN_STAKE_XLM = "31.4";
