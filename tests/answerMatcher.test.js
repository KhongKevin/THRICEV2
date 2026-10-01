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

test('meaningful words and subsets of multi-word answers are accepted', () => {
  const name = { answer: 'Patrick Star Jane', aliases: [] };
  for (const guess of ['Patrick', 'Star Jane', 'Patrick Jane', 'Jane Patrick', 'Patrik', 'Star']) {
    assert.equal(isAnswerCorrect(guess, name), true, guess);
  }
  assert.equal(isAnswerCorrect('George', washington), true);
  assert.equal(isAnswerCorrect('Oklahoma', { answer: 'University of Oklahoma', aliases: [] }), true);
  assert.equal(isAnswerCorrect('Washington', { answer: 'George Washington', aliases: [] }), true);
  assert.equal(isAnswerCorrect('York City', { answer: 'New York City', aliases: [] }), true);
  assert.equal(isAnswerCorrect('Tom', { answer: 'Tom Hanks', aliases: [] }), true);
});

test('blank, filler-only, arbitrary substrings, unrelated words and wrong numbers fail', () => {
  for (const guess of ['', '!!!', 'cat', 'The moon', 'wash', 'and']) assert.equal(isAnswerCorrect(guess, washington), false);
  assert.equal(isAnswerCorrect('Patrick Batman', { answer: 'Patrick Star Jane', aliases: [] }), false);
  assert.equal(isAnswerCorrect('the', { answer: 'The Golden Girls', aliases: [] }), false);
  assert.equal(isAnswerCorrect('1913', { answer: '1912', aliases: [] }), false);
  assert.equal(isAnswerCorrect('Apollo 12', { answer: 'Apollo 11', aliases: [] }), false);
  assert.equal(isAnswerCorrect('Oklahoma', { answer: 'University of Oklahoma', aliases: ['Oklahoma'] }), true);
  assert.equal(isAnswerCorrect('U.K.', { answer: 'United Kingdom', aliases: ['UK'] }), true);
  assert.equal(isAnswerCorrect('UK', { answer: 'USA', aliases: [] }), false);
  assert.equal(isAnswerCorrect('Cats', { answer: 'Cat', aliases: [] }), false);
});

test('a lower similarity threshold tolerates more spelling mistakes', () => {
  assert.equal(isAnswerCorrect('badmintan', { answer: 'Badminton', aliases: [] }), true);
  assert.equal(isAnswerCorrect('Washngtn', washington), true);
});

test('Levenshtein distance and normalized similarity handle boundary cases', () => {
  assert.equal(levenshteinDistance('kitten', 'sitting'), 3);
  assert.equal(levenshteinDistance('', 'hello'), 5);
  assert.equal(similarity('', ''), 1);
  assert.equal(similarity('abcde', 'abcdx'), 0.8);
});
