import { describe, expect, it } from 'vitest';
import { DEFAULT_CHALLENGE_MS, extensionChallengeMs, formatRemainingTime } from './timing';

describe('challenge timing', () => {
  it('allows ten minutes for the default 100 blocks', () => {
    expect(DEFAULT_CHALLENGE_MS).toBe(600_000);
  });

  it('uses a 90-second minimum and six seconds per extension block', () => {
    expect(extensionChallengeMs(10)).toBe(90_000);
    expect(extensionChallengeMs(20)).toBe(120_000);
    expect(extensionChallengeMs(100)).toBe(600_000);
  });

  it('formats and clamps remaining time', () => {
    expect(formatRemainingTime(61_000)).toBe('01:01');
    expect(formatRemainingTime(-1)).toBe('00:00');
  });
});
