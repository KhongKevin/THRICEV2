import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnswer, levenshteinDistance, similarity, isAnswerCorrect } from '../src/utils/answerMatcher.js';

const washington = { answer: 'George Washington', aliases: ['Washington'] };

test('normalization removes punctuation, diacritics, capitalization and excess spaces', () => {
  assert.equal(normalizeAnswer('  Géorge   WASHINGTON! '), 'george washington');
  assert.equal(normalizeAnswer('São Paulo'), 'sao paulo');
  assert.equal(normalizeAnswer('U.S.A.'), 'usa');
});

test('canonical answers, aliases, and small typos are accepted', () => {
  for (const guess of ['George Washington', 'george washington', 'George Washinton', ' WASHINGTON! ', 'Washinton']) {
    assert.equal(isAnswerCorrect(guess, washington), true, guess);
  }
});

test('empty, unrelated, very short, and non-aliased shortened answers fail', () => {
  for (const guess of ['', '!!!', 'George', 'cat', 'The moon']) assert.equal(isAnswerCorrect(guess, washington), false);
  assert.equal(isAnswerCorrect('Oklahoma', { answer: 'University of Oklahoma', aliases: [] }), false);
  assert.equal(isAnswerCorrect('Washington', { answer: 'George Washington', aliases: [] }), false);
  assert.equal(isAnswerCorrect('York City', { answer: 'New York City', aliases: [] }), false);
  assert.equal(isAnswerCorrect('Oklahoma', { answer: 'University of Oklahoma', aliases: ['Oklahoma'] }), true);
  assert.equal(isAnswerCorrect('U.K.', { answer: 'United Kingdom', aliases: ['UK'] }), true);
  assert.equal(isAnswerCorrect('UK', { answer: 'USA', aliases: [] }), false);
  assert.equal(isAnswerCorrect('Cats', { answer: 'Cat', aliases: [] }), false);
});

test('Levenshtein distance and normalized similarity handle boundary cases', () => {
  assert.equal(levenshteinDistance('kitten', 'sitting'), 3);
  assert.equal(levenshteinDistance('', 'hello'), 5);
  assert.equal(similarity('', ''), 1);
  assert.equal(similarity('abcde', 'abcdx'), 0.8);
});
