export const LANDING_EDGE_MARGIN = 7;

export function getLandingZone(platformX: number, platformWidth: number, edgeMargin = LANDING_EDGE_MARGIN) {
  const margin = Math.min(edgeMargin, Math.max(0, platformWidth / 2 - 1));
  return {
    left: platformX - platformWidth / 2 + margin,
    right: platformX + platformWidth / 2 - margin,
  };
}

export function isSafeLanding(heroX: number, platformX: number, platformWidth: number) {
  const zone = getLandingZone(platformX, platformWidth);
  return heroX >= zone.left && heroX <= zone.right;
}
