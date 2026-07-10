export type GapBand = 'short' | 'medium' | 'long';

export function generateGap(index: number, bandRoll: number, detailRoll: number, previousWidth: number, nextWidth: number) {
  let band: GapBand;
  let rawGap: number;
  if (bandRoll < 0.3) {
    band = 'short';
    rawGap = 16 + detailRoll * 24;
  } else if (bandRoll < 0.74) {
    band = 'medium';
    rawGap = 48 + detailRoll * 42;
  } else {
    band = 'long';
    rawGap = 102 + detailRoll * 58;
  }
  const difficulty = Math.min(14, index * 0.08);
  const maximumReachableGap = Math.max(45, 238 - previousWidth / 2 - nextWidth / 2);
  return { band, gap: Math.round(Math.min(rawGap + difficulty, maximumReachableGap)) };
}
