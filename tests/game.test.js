import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, gameReducer, isValidSavedState } from '../src/utils/gameState.js';
import { validateQuiz } from '../src/utils/quizValidator.js';

const quiz = JSON.parse(readFileSync(new URL('../public/data/today.json', import.meta.url), 'utf8'));
const started = () => gameReducer(createInitialState(quiz), { type: 'START' }, quiz);
const act = (state, type, extra = {}) => gameReducer(state, { type, roundIndex: state.currentRoundIndex, clueIndex: state.currentClueIndex, ...extra }, quiz);
const continueRound = (state) => act(state, 'CONTINUE', { completedAt: '2026-09-30T18:00:00.000Z' });

test('correct answers award 3, 2 or 1 based on the current clue', () => {
  for (let misses = 0; misses < 3; misses += 1) {
    let state = started();
    for (let i = 0; i < misses; i += 1) state = act(state, 'GUESS', { guess: 'incorrect answer' });
    state = act(state, 'GUESS', { guess: 'George Washinton' });
    assert.equal(state.score, 3 - misses);
    assert.equal(state.roundComplete, true);
    assert.equal(state.roundResults[0].answer, 'George Washington');
    assert.equal(isValidSavedState(state, quiz), true);
  }
});

test('skipping and three wrong answers end the round with zero points', () => {
  for (const type of ['GUESS', 'SKIP']) {
    let state = started();
    for (let index = 0; index < 3; index += 1) state = act(state, type, { guess: 'wrong' });
    assert.equal(state.roundComplete, true);
    assert.equal(state.score, 0);
    assert.equal(state.roundResults[0].correct, false);
  }
});

test('misses keep answers hidden and stale/duplicate actions cannot add points or skip clues', () => {
  let state = started();
  const oldAction = { type: 'GUESS', roundIndex: 0, clueIndex: 0, guess: 'wrong' };
  state = gameReducer(state, oldAction, quiz);
  assert.equal(state.currentClueIndex, 1);
  assert.equal(state.roundResults.length, 0);
  assert.match(state.feedback, /Not quite/);
  assert.equal(gameReducer(state, oldAction, quiz), state);
  const correctAction = { type: 'GUESS', roundIndex: 0, clueIndex: 1, guess: 'Washington' };
  state = gameReducer(state, correctAction, quiz);
  assert.equal(gameReducer(state, correctAction, quiz), state);
  const next = continueRound(state);
  assert.equal(next.currentRoundIndex, 1);
  assert.equal(act(next, 'CONTINUE'), next);
  assert.equal(act(next, 'GUESS', { guess: '  ' }), next);
});

test('all 1,024 possible five-round score combinations finish within 0–15 and restore validly', () => {
  for (let combination = 0; combination < 4 ** 5; combination += 1) {
    let state = started();
    let expectedScore = 0;
    for (let index = 0; index < 5; index += 1) {
      const points = Math.floor(combination / 4 ** index) % 4;
      for (let miss = 0; miss < 3 - points; miss += 1) {
        state = act(state, 'SKIP');
        assert.equal(isValidSavedState(state, quiz), true);
      }
      if (points > 0) state = act(state, 'GUESS', { guess: quiz.rounds[index].answer });
      expectedScore += points;
      assert.equal(state.score, expectedScore);
      assert.ok(state.score <= 15);
      assert.equal(isValidSavedState(JSON.parse(JSON.stringify(state)), quiz), true);
      state = continueRound(state);
    }
    assert.equal(state.gameComplete, true);
    assert.equal(state.roundResults.length, 5);
    assert.equal(isValidSavedState(state, quiz), true);
    assert.equal(act(state, 'GUESS', { guess: 'Iceland' }), state);
  }
});

test('invalid saves, stale dates, out-of-range indexes and inconsistent scores are rejected', () => {
  const state = started();
  for (const bad of [null, {}, { ...state, quizDate: '2026-09-29' }, { ...state, score: 16 }, { ...state, currentRoundIndex: 5 }, { ...state, currentClueIndex: 3 }, { ...state, gameComplete: true }, { ...state, roundResults: [null] }, { ...state, gameStarted: 'yes' }]) {
    assert.equal(isValidSavedState(bad, quiz), false);
  }
  assert.deepEqual(act(state, 'RESTART'), createInitialState(quiz));
});

test('quiz validation rejects missing fields, incorrect counts, dates and point ordering', () => {
  assert.equal(validateQuiz(quiz), quiz);
  const mutations = [
    (data) => { data.date = '2026-02-30'; },
    (data) => { data.rounds.pop(); },
    (data) => { data.rounds[0].clues.pop(); },
    (data) => { data.rounds[0].clues[0].points = 2; },
    (data) => { data.rounds[0].clues[0].question = ''; },
    (data) => { data.rounds[0].aliases = null; },
    (data) => { data.rounds[1].id = data.rounds[0].id; },
    (data) => { data.rounds[0].answer = ''; },
    (data) => { data.rounds[0].category = ''; },
  ];
  for (const mutate of mutations) {
    const data = structuredClone(quiz);
    mutate(data);
    assert.throws(() => validateQuiz(data), /Invalid quiz/);
  }
});
