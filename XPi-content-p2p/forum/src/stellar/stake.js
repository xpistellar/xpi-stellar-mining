import { canAfford } from "./chain.js";
import { decimalToI128 } from "./units.js";

/** Min XLM staked on Soroban to comment / post / create private mesh */
export const MIN_STAKE_XLM = "31.4";
const MIN_STAKE = 314_000_000n; // 31.4 XLM in stroops-scale (7 decimals)

/** Min XPi staked on Staking to count as node operator (claim_node) */
export const MIN_NODE_XPI = "0.0314";
const MIN_NODE = 314_000n; // 0.0314 with 7 decimal places

/** Daily node reward — 31 units = 0.0000031 XPi */
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
 * - canPost / canComment: has_min_stake (>= 31.4 XLM, no 48h required)
 * - canRunNode: get_xpi_staked >= 0.0314 AND has_min_stake
 * - canCreateNetwork: has_min_stake
 */
export function stakeSnapshot({ address, xlm, staked, pending, xpi, xpiStaked, hasMinStake, isPlayerEligible, topicFee }) {
  const stakedEnough = hasMinStake != null ? Boolean(hasMinStake) : gteStaked(staked);
  const xpiVal = xpiStaked != null ? xpiStaked : (xpi != null && String(xpi) !== "" ? xpi : pending);
  const nodeEnough = gteNodeXpi(xpiVal);
  const canPost = stakedEnough;

  return {
    address,
    xlm: String(xlm || "0"),
    staked: String(staked || "0"),
    pending: String(pending || "0"),
    xpi: String(xpiVal || "0"),
    xpiStaked: String(xpiVal || "0"),
    hasMinStake: stakedEnough,
    isPlayerEligible: Boolean(isPlayerEligible),
    diskGb: 0,
    canPost,
    canComment: stakedEnough,
    canRunNode: nodeEnough && stakedEnough,
    canCreateNetwork: stakedEnough,
    minStakeXlm: MIN_STAKE_XLM,
    minNodeXpi: MIN_NODE_XPI,
    nodeClaimXpi: NODE_CLAIM_XPI,
    nodeEligibleHours: NODE_ELIGIBLE_HOURS,
    at: Date.now(),
  };
}
