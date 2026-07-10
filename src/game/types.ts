export type Quality = 'auto' | 'smooth' | 'balanced' | 'high';
export type Screen = 'home' | 'game' | 'results' | 'ranking' | 'records';

export interface Settings {
  quality: Quality;
  music: boolean;
  sound: boolean;
  vibration: boolean;
  reducedMotion: boolean;
}

export interface PlayerProfile {
  name: string;
  plays: number;
  balance: number;
  xp: number;
  totalReward: number;
  highestBlock: number;
}

export interface MedalLevel {
  name: string;
  minXp: number;
  bonus: number;
  color: string;
}

export interface RewardHit {
  block: number;
  kind: 'usdt' | 'play' | 'coupon' | 'free-extension';
  label: string;
  value: number;
}

export interface RoundResult {
  roundId: string;
  block: number;
  reason: 'fell' | 'cashout' | 'completed' | 'quit';
  rewards: RewardHit[];
  baseUsdt: number;
  bonusUsdt: number;
  xpEarned: number;
  startedAt: number;
}

export interface GameSnapshot {
  block: number;
  rewards: RewardHit[];
  stable: boolean;
  extending: boolean;
}

export interface ActiveRound {
  roundId: string;
  seed: number;
  startedAt: number;
  practice: boolean;
  snapshot: GameSnapshot;
  extensionPurchases: Array<{ blocks: number; price: number; at: number }>;
  configVersion: string;
  seedProof: string;
}

export interface WeeklyRankEntry { rank: number; playerName: string; reward: number; isCurrentUser?: boolean; }

export interface RemoteGameConfig {
  version: string;
  defaultBlocks: number;
  rewardEvery: number;
  defaultRewards: Record<number, number>;
  extensionPrices: Record<number, number>;
  medalBonuses: number[];
}

export interface GameBridgeEvents {
  onSnapshot(snapshot: GameSnapshot): void;
  onReward(reward: RewardHit): void;
  onFell(block: number): void;
  onExtensionGate(block: number): void;
}
