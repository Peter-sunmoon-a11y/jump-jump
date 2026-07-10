import { describe, expect, it } from 'vitest';
import { getLandingZone, isSafeLanding } from './landing';

describe('landing zone', () => {
  it('accepts every point inside the platform excluding edge bands', () => {
    const zone = getLandingZone(100, 60);
    for (let x = Math.ceil(zone.left); x <= Math.floor(zone.right); x++) {
      expect(isSafeLanding(x, 100, 60)).toBe(true);
    }
  });

  it('rejects only the edges and points outside the platform', () => {
    expect(isSafeLanding(70, 100, 60)).toBe(false);
    expect(isSafeLanding(70.5, 100, 60)).toBe(false);
    expect(isSafeLanding(71, 100, 60)).toBe(true);
    expect(isSafeLanding(75, 100, 60)).toBe(true);
    expect(isSafeLanding(100, 100, 60)).toBe(true);
    expect(isSafeLanding(125, 100, 60)).toBe(true);
    expect(isSafeLanding(129, 100, 60)).toBe(true);
    expect(isSafeLanding(129.5, 100, 60)).toBe(false);
    expect(isSafeLanding(130, 100, 60)).toBe(false);
  });
});
