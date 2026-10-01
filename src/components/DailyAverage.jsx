import { useEffect, useState } from 'react';
import { loadDailyStats } from '../services/statsService.js';
import { statsPending } from '../utils/stats.js';

export default function DailyAverage({ quizDate, score }) {
  const [stats, setStats] = useState(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let active = true;
    let inFlight = false;
    let timer;
    let controller;
    setStats(null);
    async function refresh() {
      if (!active || inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const value = await loadDailyStats(quizDate, { signal: controller.signal });
      clearTimeout(timeout);
      inFlight = false;
      if (!active) return;
      setStats(value);
      setNow(new Date());
      if (value) clearInterval(timer);
    }
    timer = setInterval(refresh, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', refresh);
    refresh();
    return () => {
      active = false;
      clearInterval(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [quizDate]);

  const captured = stats && new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit',
  }).format(new Date(stats.retrievedAt));
  const difference = stats && score !== null ? score - stats.averageScore : null;
  return <aside className="daily-average" aria-label="Thrice average score" aria-live="polite">
    <div><span className="average-label">Thrice daily average</span>
      <p>{stats ? <><strong>{stats.averageScore.toFixed(2)}</strong><span> / 15</span></> : <span className="average-pending">{statsPending(quizDate, now) ? 'Available after noon Central' : 'Average not available yet'}</span>}</p>
    </div>
    <div className="average-note">{stats ? <>
      <span><a href="https://thrice.geekswhodrink.com/stats" target="_blank" rel="noreferrer">Thrice players</a> · Snapshot at {captured} Central</span>
      {difference !== null && <span>{Math.abs(difference) < 0.005 ? 'You matched the average.' : `You finished ${Math.abs(difference).toFixed(2)} points ${difference > 0 ? 'above' : 'below'} the average.`}</span>}
    </> : <span>Play anytime. Stats will appear when available.</span>}</div>
  </aside>;
}
