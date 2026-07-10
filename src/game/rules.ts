import type { MedalLevel, RewardHit } from './types';

export const MEDALS: MedalLevel[] = [
  { name: '跳跳新星', minXp: 0, bonus: 0, color: '#a7d8ff' },
  { name: '青铜之星', minXp: 300, bonus: 0.02, color: '#d8956f' },
  { name: '白银之星', minXp: 1200, bonus: 0.04, color: '#dbe5f0' },
  { name: '黄金之星', minXp: 3500, bonus: 0.06, color: '#ffd35a' },
  { name: '铂金之星', minXp: 8000, bonus: 0.08, color: '#75ead7' },
  { name: '钻石之星', minXp: 18000, bonus: 0.10, color: '#9ec6ff' },
  { name: '荣耀之星', minXp: 40000, bonus: 0.12, color: '#ff8be6' },
];

export const EXTENSION_PRICES: Record<number, number> = {
  10: 0.10, 20: 0.18, 30: 0.25, 40: 0.32, 50: 0.38,
  60: 0.44, 70: 0.50, 80: 0.56, 90: 0.62, 100: 0.68,
};

export function medalForXp(xp: number) {
  return [...MEDALS].reverse().find((level) => xp >= level.minXp) ?? MEDALS[0];
}

export function defaultReward(block: number): RewardHit | null {
  if (block <= 0 || block > 100 || block % 10 !== 0) return null;
  const value = block / 100;
  return { block, kind: 'usdt', value, label: `${value.toFixed(2)} USDT` };
}

export function surpriseReward(block: number, seed: number): RewardHit | null {
  if (block <= 100 || block % 10 !== 0) return null;
  const roll = Math.abs((seed * 9301 + block * 49297) % 100);
  if (roll < 58) {
    const value = [0.18, 0.28, 0.38, 0.58, 0.88][roll % 5];
    return { block, kind: 'usdt', value, label: `惊喜 ${value.toFixed(2)} USDT` };
  }
  if (roll < 76) return { block, kind: 'play', value: 1, label: '惊喜 Play ×1' };
  if (roll < 91) return { block, kind: 'coupon', value: 10, label: '续跳 9 折券' };
  return { block, kind: 'free-extension', value: 10, label: '免费续跳 10 格' };
}

export function practiceReward(block: number, seed: number): RewardHit {
  const roll = Math.abs((seed * 7919 + block * 104729) % 8);
  const rewards: RewardHit[] = [
    { block, kind: 'usdt', value: 0.01, label: '练习惊喜 · 0.01 USDT' },
    { block, kind: 'usdt', value: 0.05, label: '练习暴击 · 0.05 USDT' },
    { block, kind: 'play', value: 1, label: '幸运 Play ×1' },
    { block, kind: 'coupon', value: 10, label: '续跳 9 折券' },
    { block, kind: 'free-extension', value: 10, label: '免费续跳 10 格' },
    { block, kind: 'usdt', value: 0.08, label: '星光宝箱 · 0.08 USDT' },
    { block, kind: 'coupon', value: 20, label: '稀有续跳 8 折券' },
    { block, kind: 'play', value: 2, label: '超级幸运 Play ×2' },
  ];
  return { ...rewards[roll], block };
}

export function calculateXp(block: number, rewards: RewardHit[]) {
  const rewardXp = rewards.reduce((sum, reward) => {
    if (reward.kind === 'usdt') return sum + Math.round(reward.value * 100);
    if (reward.kind === 'play') return sum + reward.value * 10;
    if (reward.kind === 'free-extension') return sum + reward.value;
    return sum;
  }, 0);
  return block + rewardXp;
}
