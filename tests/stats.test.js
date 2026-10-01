import test from 'node:test';
import assert from 'node:assert/strict';
import { statsPending, validateStats } from '../src/utils/stats.js';
import { loadDailyStats } from '../src/services/statsService.js';

const snapshot = {
  status: 'available', date: '2026-10-01', averageScore: 9.47, maxScore: 15,
  retrievedAt: '2026-10-01T17:00:00Z', source: { url: 'https://thrice.geekswhodrink.com/stats' },
};

test('noon Central handles daylight saving and standard time', () => {
  assert.equal(statsPending('2026-10-01', new Date('2026-10-01T16:59:59Z')), true);
  assert.equal(statsPending('2026-10-01', new Date('2026-10-01T17:00:00Z')), false);
  assert.equal(statsPending('2026-12-01', new Date('2026-12-01T17:59:59Z')), true);
  assert.equal(statsPending('2026-12-01', new Date('2026-12-01T18:00:00Z')), false);
});

test('only matching dated snapshots taken after noon with valid averages are displayed', () => {
  assert.equal(validateStats(snapshot, snapshot.date), snapshot);
  assert.ok(validateStats({ ...snapshot, averageScore: 0 }, snapshot.date));
  for (const value of [null, { status: 'pending' }, { ...snapshot, date: '2026-09-30' },
    { ...snapshot, averageScore: null }, { ...snapshot, averageScore: 16 },
    { ...snapshot, retrievedAt: '2026-10-01T16:00:00Z' }, { ...snapshot, averageScore: NaN }]) {
    assert.equal(validateStats(value, snapshot.date), null);
  }
});

test('optional stats handle missing files, bad JSON and network failures without throwing', async () => {
  for (const fetcher of [async () => { throw new Error('offline'); }, async () => ({ ok: false }),
    async () => ({ ok: true, json() { throw new Error('bad json'); } })]) {
    assert.equal(await loadDailyStats(snapshot.date, { fetcher }), null);
  }
  let requested;
  const actual = await loadDailyStats(snapshot.date, {
    baseUrl: '/THRICEV2/', fetcher: async (url) => { requested = url; return { ok: true, json: async () => snapshot }; },
  });
  assert.equal(requested, '/THRICEV2/data/stats.json');
  assert.deepEqual(actual, snapshot);
});
