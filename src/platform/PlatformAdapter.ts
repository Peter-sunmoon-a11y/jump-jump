import type { ActiveRound, GameSnapshot, PlayerProfile, RemoteGameConfig, RoundResult, WeeklyRankEntry } from '../game/types';

export interface StartedRound {
  roundId: string;
  seed: number;
  profile: PlayerProfile;
}

export interface PlatformAdapter {
  getProfile(): Promise<PlayerProfile>;
  getGameConfig(): Promise<RemoteGameConfig>;
  getWeeklyRanking(): Promise<WeeklyRankEntry[]>;
  recharge(amount: number): Promise<PlayerProfile>;
  purchasePlays(count: number): Promise<PlayerProfile>;
  getActiveRound(): Promise<ActiveRound | null>;
  startRound(practice?: boolean): Promise<StartedRound>;
  updateRound(roundId: string, snapshot: GameSnapshot): Promise<void>;
  discardRound(roundId: string): Promise<void>;
  purchaseExtension(roundId: string, blocks: number): Promise<PlayerProfile>;
  settle(result: RoundResult): Promise<PlayerProfile>;
  getRecords(): Promise<RoundResult[]>;
}
