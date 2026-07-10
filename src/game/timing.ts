export const DEFAULT_CHALLENGE_MS = 10 * 60 * 1000;

export function extensionChallengeMs(blocks: number) {
  return Math.max(90, blocks * 6) * 1000;
}

export function formatRemainingTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
