/**
 * Format late minutes into a human-readable string with hours and minutes.
 */
export function formatLateDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0min";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}
