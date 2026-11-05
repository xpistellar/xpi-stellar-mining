export function publicHint(secret) {
  if (!secret || secret.length < 8) return null;
  return `${secret.slice(0, 4)}…${secret.slice(-4)}`;
}

export function canPay(balance, fee) {
  return Number(balance) + 1e-12 >= Number(fee);
}
