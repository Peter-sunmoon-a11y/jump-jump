import { describe, expect, it } from 'vitest';
import { generateGap } from './levelGeneration';

describe('platform gap generation', () => {
  it('creates clearly separated short, medium and long ranges', () => {
    const short = generateGap(1, 0.1, 0.5, 70, 70);
    const medium = generateGap(1, 0.5, 0.5, 70, 70);
    const long = generateGap(1, 0.9, 0.5, 70, 70);
    expect(short.band).toBe('short');
    expect(medium.band).toBe('medium');
    expect(long.band).toBe('long');
    expect(medium.gap - short.gap).toBeGreaterThan(20);
    expect(long.gap - medium.gap).toBeGreaterThan(35);
  });

  it('caps long gaps so their centers remain reachable', () => {
    const result = generateGap(180, 0.99, 1, 120, 120);
    expect(result.gap + 60 + 60).toBeLessThanOrEqual(238);
  });
});
