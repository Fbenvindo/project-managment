/**
 * Formats a number of hours to a display string, e.g. 1.5 → "1.5h"
 */
export function formatHoras(horas) {
  if (horas == null || isNaN(horas)) return '—';
  return `${Number(horas).toFixed(1)}h`;
}