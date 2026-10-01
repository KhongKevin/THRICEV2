export function centralTimeParts(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export function statsPending(quizDate, now = new Date()) {
  const central = centralTimeParts(now);
  return central.date < quizDate || (central.date === quizDate && central.hour < 12);
}

export function validateStats(stats, quizDate) {
  if (!stats || stats.status !== 'available' || stats.date !== quizDate || stats.maxScore !== 15) return null;
  if (typeof stats.averageScore !== 'number' || !Number.isFinite(stats.averageScore) || stats.averageScore < 0 || stats.averageScore > 15) return null;
  if (typeof stats.retrievedAt !== 'string' || !Number.isFinite(Date.parse(stats.retrievedAt))) return null;
  const captured = centralTimeParts(new Date(stats.retrievedAt));
  if (captured.date !== quizDate || captured.hour < 12) return null;
  if (stats.source?.url !== 'https://thrice.geekswhodrink.com/stats') return null;
  return stats;
}
