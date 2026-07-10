import { beforeEach, describe, expect, it } from 'vitest';
import { createSeedProof, mockPlatform, MOCK_GAME_CONFIG } from './mockPlatform';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('mock platform round lifecycle', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
  });

  it('blocks a second active round and persists snapshots', async () => {
    const started = await mockPlatform.startRound(false);
    expect(started.profile.plays).toBe(5);
    await expect(mockPlatform.startRound(false)).rejects.toThrow('已有一局');
    await mockPlatform.updateRound(started.roundId, { block: 10, stable: true, extending: false, rewards: [{ block: 10, kind: 'usdt', value: 0.1, label: '0.10 USDT' }] });
    expect((await mockPlatform.getActiveRound())?.snapshot.block).toBe(10);
  });

  it('settles a round idempotently', async () => {
    const started = await mockPlatform.startRound(false);
    const result = { roundId: started.roundId, block: 10, reason: 'quit' as const, rewards: [{ block: 10, kind: 'usdt' as const, value: 0.1, label: '0.10 USDT' }], baseUsdt: 0.1, bonusUsdt: 0, xpEarned: 20, startedAt: Date.now() };
    const first = await mockPlatform.settle(result);
    const second = await mockPlatform.settle(result);
    expect(first.balance).toBe(8.98);
    expect(second.balance).toBe(8.98);
    expect(await mockPlatform.getRecords()).toHaveLength(1);
    expect(await mockPlatform.getActiveRound()).toBeNull();
  });

  it('provides verifiable seed metadata and remote configuration', async () => {
    const started = await mockPlatform.startRound(false);
    const active = await mockPlatform.getActiveRound();
    expect(active?.configVersion).toBe(MOCK_GAME_CONFIG.version);
    expect(active?.seedProof).toBe(createSeedProof(started.roundId, started.seed, MOCK_GAME_CONFIG.version));
    expect((await mockPlatform.getGameConfig()).extensionPrices[100]).toBe(0.68);
  });

  it('simulates recharge and a server-provided weekly ranking', async () => {
    const profile = await mockPlatform.recharge(5);
    expect(profile.balance).toBe(13.88);
    expect(profile.plays).toBe(7);
    const ranking = await mockPlatform.getWeeklyRanking();
    expect(ranking[0].rank).toBe(1);
    expect(ranking.some((entry) => entry.isCurrentUser)).toBe(true);
  });

  it('gifts one Play for every 5 USDT in a single recharge', async () => {
    expect((await mockPlatform.recharge(1)).plays).toBe(6);
    expect((await mockPlatform.recharge(10)).plays).toBe(8);
    expect((await mockPlatform.recharge(20)).plays).toBe(12);
  });

  it('sells Play for 5 USDT each from platform balance', async () => {
    const purchased = await mockPlatform.purchasePlays(1);
    expect(purchased.plays).toBe(7);
    expect(purchased.balance).toBe(3.88);
    await expect(mockPlatform.purchasePlays(1)).rejects.toThrow('平台余额不足');
  });
});
