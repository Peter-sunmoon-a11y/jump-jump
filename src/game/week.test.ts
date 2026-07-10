import { describe, expect, it } from 'vitest';
import { getUtcPlus7WeekStart, WEEK_MS } from '../../shared/week';

describe('UTC+7 weekly boundary', () => {
  it('starts on Monday at 00:00 in UTC+7', () => {
    const saturday = Date.parse('2026-07-11T12:00:00+07:00');
    expect(new Date(getUtcPlus7WeekStart(saturday)).toISOString()).toBe('2026-07-05T17:00:00.000Z');
  });

  it('moves to the next week exactly seven days later', () => {
    const first = getUtcPlus7WeekStart(Date.parse('2026-07-06T00:00:00+07:00'));
    const second = getUtcPlus7WeekStart(Date.parse('2026-07-13T00:00:00+07:00'));
    expect(second - first).toBe(WEEK_MS);
  });
});
