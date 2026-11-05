import { canPay } from "./wallet.js";

export function applyLike({ likerBalance, creatorBalance, fee }) {
  if (!canPay(likerBalance, fee)) {
    return { ok: false, error: "insufficient XPi" };
  }
  return {
    ok: true,
    likerBalance: Number(likerBalance) - Number(fee),
    creatorBalance: Number(creatorBalance) + Number(fee),
    fee: String(fee),
  };
}
