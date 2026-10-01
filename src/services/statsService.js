import { validateStats } from '../utils/stats.js';

export async function loadDailyStats(quizDate, { signal, fetcher = fetch, baseUrl = import.meta.env?.BASE_URL ?? './' } = {}) {
  try {
    const response = await fetcher(`${baseUrl}data/stats.json`, { signal, cache: 'no-cache' });
    if (!response.ok) return null;
    return validateStats(await response.json(), quizDate);
  } catch {
    // Stats are optional: unavailable, invalid and stale files never block gameplay.
    return null;
  }
}
