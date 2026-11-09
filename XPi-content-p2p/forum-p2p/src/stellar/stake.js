import { canAfford } from "./chain.js";
import { decimalToI128 } from "./units.js";

/** Min XLM staked on Soroban to comment / post / create private mesh */
export const MIN_STAKE_XLM = "31.4";
const MIN_STAKE = 314_000_000n; // 31.4 XLM in stroops-scale (7 decimals)

/** Min XPi held/staked to count as node operator (claim_node) */
export const MIN_NODE_XPI = "0.0314";
const MIN_NODE = 314000n; // 0.0314 with 7 decimal places

/** Daily node reward (display / local claim until on-contract) — 31 lamports = 0.0000031 XPi */
export const NODE_CLAIM_XPI = "0.0000031";
export const NODE_CLAIM_LAMPORTS = 31;
export const NODE_ELIGIBLE_HOURS = 48;

function gteStaked(staked) {
  try {
    return decimalToI128(staked || "0") >= MIN_STAKE;
  } catch {
    return false;
  }
}

function gteNodeXpi(xpi) {
  try {
    return decimalToI128(xpi || "0") >= MIN_NODE;
  } catch {
    return false;
  }
}

/**
 * Rights from on-chain stake only — local disk GB is NOT required.
 * - canComment / canPost: staked XLM >= 31.4
 * - canRunNode: XPi >= 0.00314 OR staked XLM >= 31.4
 * - canCreateNetwork: staked XLM >= 31.4
 */
export function stakeSnapshot({ address, xlm, staked, pending, xpi, topicFee }) {
  const stakedEnough = gteStaked(staked);
  const xpiVal = xpi != null && String(xpi) !== "" ? xpi : pending;
  const nodeEnough = gteNodeXpi(xpiVal) && stakedEnough; // 0.0314 XPi AND 31.4 XLM
  const canPost = stakedEnough; // topic fee checked separately when posting

  return {
    address,
    xlm: String(xlm || "0"),
    staked: String(staked || "0"),
    pending: String(pending || "0"),
    xpi: String(xpiVal || "0"),
    diskGb: 0,
    canPost,
    canComment: stakedEnough,
    canRunNode: nodeEnough && stakedEnough, // both 31.4 XLM + 0.0314 XPi preferred
    canCreateNetwork: stakedEnough,
    minStakeXlm: MIN_STAKE_XLM,
    minNodeXpi: MIN_NODE_XPI,
    nodeClaimXpi: "0.0000031",
    nodeEligibleHours: 48,
    at: Date.now(),
  };
}
