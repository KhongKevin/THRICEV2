import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, gameReducer } from '../src/utils/gameState.js';
import { loadGame, saveGame, saveHistory, clearToday, STATE_KEY, HISTORY_KEY } from '../src/utils/storage.js';

const quiz = JSON.parse(readFileSync(new URL('../ingestion/example_quiz.json', import.meta.url), 'utf8'));
beforeEach(() => {
  const data = new Map();
  globalThis.localStorage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
});

test('active progress restores on refresh', () => {
  const active = { ...createInitialState(quiz), gameStarted: true, currentClueIndex: 1, feedback: 'Not quite.' };
  assert.equal(saveGame(active), true);
  assert.deepEqual(loadGame(quiz), active);
});

test('completed results restore and history keeps past dates', () => {
  let state = { ...createInitialState(quiz), gameStarted: true };
  for (let index = 0; index < 5; index += 1) {
    state = gameReducer(state, { type: 'GUESS', roundIndex: index, clueIndex: 0, guess: quiz.rounds[index].answer }, quiz);
    state = gameReducer(state, { type: 'CONTINUE', roundIndex: index, clueIndex: 0, completedAt: '2026-09-30T18:00:00.000Z' }, quiz);
  }
  const previous = { score: 10, maxScore: 15, completedAt: '2026-09-29T18:00:00.000Z' };
  localStorage.setItem(HISTORY_KEY, JSON.stringify({ '2026-09-29': previous }));
  saveGame(state);
  saveHistory(state);
  assert.deepEqual(loadGame(quiz), state);
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY));
  assert.deepEqual(history['2026-09-29'], previous);
  assert.equal(history[quiz.date].score, 15);
  assert.equal(history[quiz.date].completedAt, state.completedAt);
  saveHistory(state);
  assert.deepEqual(JSON.parse(localStorage.getItem(HISTORY_KEY)), history);
  clearToday(quiz.date);
  assert.equal(localStorage.getItem(STATE_KEY), null);
  assert.deepEqual(JSON.parse(localStorage.getItem(HISTORY_KEY)), { '2026-09-29': previous });
  assert.deepEqual(loadGame(quiz), createInitialState(quiz));
});

test('a new quiz date discards old progress, while malformed saves recover cleanly', () => {
  saveGame({ ...createInitialState(quiz), gameStarted: true, quizDate: '2026-09-29' });
  assert.deepEqual(loadGame(quiz), createInitialState(quiz));
  assert.equal(localStorage.getItem(STATE_KEY), null);
  localStorage.setItem(STATE_KEY, '{ broken');
  assert.deepEqual(loadGame(quiz), createInitialState(quiz));
});

test('unavailable storage never crashes gameplay and reports save failures', () => {
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('blocked'); } };
  const active = { ...createInitialState(quiz), gameStarted: true };
  assert.deepEqual(loadGame(quiz), createInitialState(quiz));
  assert.equal(saveGame(active), false);
  assert.equal(saveHistory({ ...active, gameComplete: true }), false);
  assert.equal(clearToday(quiz.date), false);
});
