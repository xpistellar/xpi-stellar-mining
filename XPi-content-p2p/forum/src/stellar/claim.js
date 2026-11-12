export function dailyReward({ xlm, diskGb }) {
  const base = Number(xlm || 0) * 0.001;
  const diskBonus = Math.floor(Number(diskGb || 0) / 10) * 0.00001;
  return {
    amount: Number((base + diskBonus).toFixed(7)),
    note: "off-chain estimate; submit once/day via contract claim",
  };
}
