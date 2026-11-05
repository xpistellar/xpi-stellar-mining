import { canAfford } from "./chain.js";
import { decimalToI128 } from "./units.js";

const MIN_STAKE = 314_000_000n;

export function stakeSnapshot({ address, xlm, staked, pending, diskGb, minDiskGb, topicFee }) {
  const disk = Number(diskGb || 0);
  let stakedEnough = false;
  try {
    stakedEnough = decimalToI128(staked || "0") >= MIN_STAKE;
  } catch {
    stakedEnough = false;
  }
  return {
    address,
    xlm: String(xlm || "0"),
    xpi: String(xlm || "0"),
    staked: String(staked || "0"),
    pending: String(pending || "0"),
    diskGb: disk,
    canPost: disk >= minDiskGb && stakedEnough && canAfford(xlm || "0", topicFee),
    at: Date.now(),
  };
}
