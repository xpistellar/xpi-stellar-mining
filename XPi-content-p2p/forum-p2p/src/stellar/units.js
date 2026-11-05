const SCALE = 10_000_000n;

export function decimalToI128(value) {
  const raw = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error(`bad amount ${value}`);
  const [whole, frac = ""] = raw.split(".");
  const padded = (frac + "0000000").slice(0, 7);
  return BigInt(whole) * SCALE + BigInt(padded);
}

export function i128ToDecimal(value) {
  const n = BigInt(value);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const whole = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(7, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toString()}${frac ? `.${frac}` : ""}`;
}
