export function handleApiError(err: any, nextSync?: Date): string {
  if (!err) return 'Unknown error.';
  if (err.status === 503) {
    console.warn('[WarmaneAPI] Service unavailable');
    const when = nextSync ? ` Next sync at ${nextSync.toLocaleTimeString()}.` : '';
    return `Warmane Armory is down for maintenance.${when}`;
  }
  console.error('[WarmaneAPI] API error:', err);
  return 'Failed to contact Warmane API. Please try again later.';
}
