export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const UTC_PLUS_7_MS = 7 * 60 * 60 * 1000;

export function getUtcPlus7WeekStart(now = Date.now()) {
  const local = new Date(now + UTC_PLUS_7_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  local.setUTCHours(0, 0, 0, 0);
  return local.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000 - UTC_PLUS_7_MS;
}
