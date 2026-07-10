import type { ActiveRound, GameSnapshot, PlayerProfile, RemoteGameConfig, RoundResult, WeeklyRankEntry } from '../game/types';
import { EXTENSION_PRICES, MEDALS } from '../game/rules';
import type { PlatformAdapter } from './PlatformAdapter';

const PROFILE_KEY = 'jump-star-profile-v1';
const RECORDS_KEY = 'jump-star-records-v1';
const ACTIVE_ROUND_KEY = 'jump-star-active-round-v1';

const initialProfile: PlayerProfile = {
  name: '星星玩家', plays: 6, balance: 8.88, xp: 860,
  totalReward: 2.4, highestBlock: 36,
};

function read<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? '') as T; } catch { return structuredClone(fallback); }
}

function write<T>(key: string, value: T) { localStorage.setItem(key, JSON.stringify(value)); }
const delay = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

export const MOCK_GAME_CONFIG: RemoteGameConfig = {
  version: 'demo-2026.07.10', defaultBlocks: 100, rewardEvery: 10,
  defaultRewards: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [(index + 1) * 10, (index + 1) / 10])),
  extensionPrices: EXTENSION_PRICES,
  medalBonuses: MEDALS.map((medal) => medal.bonus),
};

export function createSeedProof(roundId: string, seed: number, configVersion: string) {
  let hash = 2166136261;
  for (const char of `${roundId}:${seed}:${configVersion}:mock-platform-secret`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `mock_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export const mockPlatform: PlatformAdapter & { resetDemo(): void } = {
  async getProfile() { await delay(80); return read(PROFILE_KEY, initialProfile); },
  async getGameConfig() { await delay(60); return structuredClone(MOCK_GAME_CONFIG); },
  async getWeeklyRanking() {
    await delay(100);
    const profile = read(PROFILE_KEY, initialProfile);
    const entries: WeeklyRankEntry[] = [
      { rank: 0, playerName: '像素旅人', reward: 18.82 }, { rank: 0, playerName: '云端小跳蛙', reward: 14.56 },
      { rank: 0, playerName: '夜航星', reward: 11.28 }, { rank: 0, playerName: profile.name, reward: profile.totalReward, isCurrentUser: true },
      { rank: 0, playerName: '慢慢来', reward: 3.42 },
    ];
    return entries.sort((a, b) => b.reward - a.reward).map((entry, index) => ({ ...entry, rank: index + 1 }));
  },
  async recharge(amount: number) {
    await delay(260);
    if (![1, 5, 10, 20].includes(amount)) throw new Error('无效充值档位');
    const profile = read(PROFILE_KEY, initialProfile);
    profile.balance = Number((profile.balance + amount).toFixed(2));
    profile.plays += Math.floor(amount / 5);
    write(PROFILE_KEY, profile);
    return profile;
  },
  async purchasePlays(count: number) {
    await delay(220);
    if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('无效购买数量');
    const profile = read(PROFILE_KEY, initialProfile);
    const total = count * 5;
    if (profile.balance < total) throw new Error('平台余额不足');
    profile.balance = Number((profile.balance - total).toFixed(2));
    profile.plays += count;
    write(PROFILE_KEY, profile);
    return profile;
  },
  async getActiveRound() { await delay(30); return read<ActiveRound | null>(ACTIVE_ROUND_KEY, null); },
  async startRound(practice = false) {
    await delay();
    const active = read<ActiveRound | null>(ACTIVE_ROUND_KEY, null);
    if (active) throw new Error('已有一局正在处理中');
    const profile = read(PROFILE_KEY, initialProfile);
    if (!practice) {
      if (profile.plays < 1) throw new Error('Play 次数不足');
      profile.plays -= 1;
      write(PROFILE_KEY, profile);
    }
    const roundId = crypto.randomUUID();
    const seed = Math.floor(Math.random() * 1_000_000);
    write<ActiveRound>(ACTIVE_ROUND_KEY, {
      roundId, seed, practice, startedAt: Date.now(),
      snapshot: { block: 0, rewards: [], stable: true, extending: false },
      extensionPurchases: [],
      configVersion: MOCK_GAME_CONFIG.version,
      seedProof: createSeedProof(roundId, seed, MOCK_GAME_CONFIG.version),
    });
    return { roundId, seed, profile };
  },
  async updateRound(roundId: string, snapshot: GameSnapshot) {
    const active = read<ActiveRound | null>(ACTIVE_ROUND_KEY, null);
    if (!active || active.roundId !== roundId) throw new Error('局次已失效');
    active.snapshot = snapshot;
    write(ACTIVE_ROUND_KEY, active);
  },
  async discardRound(roundId: string) {
    const active = read<ActiveRound | null>(ACTIVE_ROUND_KEY, null);
    if (active?.roundId === roundId) localStorage.removeItem(ACTIVE_ROUND_KEY);
  },
  async purchaseExtension(roundId: string, blocks: number) {
    await delay();
    const active = read<ActiveRound | null>(ACTIVE_ROUND_KEY, null);
    if (!active || active.roundId !== roundId) throw new Error('局次已失效');
    const profile = read(PROFILE_KEY, initialProfile);
    const price = EXTENSION_PRICES[blocks];
    if (!price || profile.balance < price) throw new Error('平台余额不足');
    profile.balance = Number((profile.balance - price).toFixed(2));
    active.extensionPurchases.push({ blocks, price, at: Date.now() });
    write(PROFILE_KEY, profile);
    write(ACTIVE_ROUND_KEY, active);
    return profile;
  },
  async settle(result: RoundResult) {
    await delay(350);
    const records = read<RoundResult[]>(RECORDS_KEY, []);
    const alreadySettled = records.some((item) => item.roundId === result.roundId);
    if (!alreadySettled) records.unshift(result);
    write(RECORDS_KEY, records.slice(0, 50));
    const profile = read(PROFILE_KEY, initialProfile);
    if (!alreadySettled) {
      profile.balance = Number((profile.balance + result.baseUsdt + result.bonusUsdt).toFixed(2));
      profile.totalReward = Number((profile.totalReward + result.baseUsdt + result.bonusUsdt).toFixed(2));
      profile.xp += result.xpEarned;
      profile.highestBlock = Math.max(profile.highestBlock, result.block);
      result.rewards.filter((r) => r.kind === 'play').forEach((r) => { profile.plays += r.value; });
    }
    write(PROFILE_KEY, profile);
    const active = read<ActiveRound | null>(ACTIVE_ROUND_KEY, null);
    if (active?.roundId === result.roundId) localStorage.removeItem(ACTIVE_ROUND_KEY);
    return profile;
  },
  async getRecords() { return read<RoundResult[]>(RECORDS_KEY, []); },
  resetDemo() { localStorage.removeItem(PROFILE_KEY); localStorage.removeItem(RECORDS_KEY); localStorage.removeItem(ACTIVE_ROUND_KEY); },
};
