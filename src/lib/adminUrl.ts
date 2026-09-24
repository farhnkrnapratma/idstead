const OBSOLETE_PARAMS = ['timeZone', 'range', 'from', 'to'] as const;

export function cleanAdminParams(
  params: URLSearchParams,
  currentYear = new Date().getFullYear()
) {
  const next = new URLSearchParams(params);
  for (const key of OBSOLETE_PARAMS) next.delete(key);
  if (next.get('tab') === 'home') next.delete('tab');
  if (Number(next.get('calendarYear')) === currentYear)
    next.delete('calendarYear');
  return next;
}
