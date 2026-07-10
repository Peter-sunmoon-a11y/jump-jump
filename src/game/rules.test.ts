import { describe, expect, it } from 'vitest';
import { calculateXp, defaultReward, medalForXp, practiceReward, surpriseReward } from './rules';

describe('reward rules', () => {
  it('only rewards every tenth default block', () => {
    expect(defaultReward(9)).toBeNull();
    expect(defaultReward(10)?.value).toBe(0.1);
    expect(defaultReward(100)?.value).toBe(1);
    expect(defaultReward(110)).toBeNull();
  });

  it('only reveals surprises after block 100 at 10x positions', () => {
    expect(surpriseReward(100, 42)).toBeNull();
    expect(surpriseReward(109, 42)).toBeNull();
    expect(surpriseReward(110, 42)).not.toBeNull();
  });

  it('uses base rewards for XP', () => {
    expect(calculateXp(25, [{ block: 10, kind: 'usdt', value: 0.1, label: '' }, { block: 20, kind: 'usdt', value: 0.2, label: '' }])).toBe(55);
  });

  it('uses stable medal boundaries', () => {
    expect(medalForXp(299).name).toBe('跳跳新星');
    expect(medalForXp(300).name).toBe('青铜之星');
    expect(medalForXp(40000).bonus).toBe(0.12);
  });

  it('pays 5.50 USDT across all ten default checkpoints', () => {
    const total = Array.from({ length: 100 }, (_, index) => defaultReward(index + 1))
      .filter((reward) => reward !== null)
      .reduce((sum, reward) => sum + reward.value, 0);
    expect(total).toBeCloseTo(5.5);
  });

  it('keeps surprise generation deterministic for server replay', () => {
    expect(surpriseReward(110, 98765)).toEqual(surpriseReward(110, 98765));
    expect(surpriseReward(120, 98765)).toEqual(surpriseReward(120, 98765));
  });

  it('gives a deterministic preview reward on every practice block', () => {
    const rewards = Array.from({ length: 20 }, (_, index) => practiceReward(index + 1, 1234));
    expect(rewards).toHaveLength(20);
    expect(rewards.every((reward, index) => reward.block === index + 1)).toBe(true);
    expect(practiceReward(7, 1234)).toEqual(practiceReward(7, 1234));
  });
});
