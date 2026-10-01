export const SIMILARITY_THRESHOLD = 0.72;
const FILLER_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'from', 'with']);

function wordsMatch(guess, accepted) {
  if (guess === accepted) return true;
  // Short words and numbers need an exact token match.
  if (Math.min(guess.length, accepted.length) < 5 || /\d/.test(guess + accepted)) return false;
  return similarity(guess, accepted) >= SIMILARITY_THRESHOLD;
}

function matchesAnswerWords(guess, accepted) {
  const answerWords = accepted.split(' ').filter((word) => !FILLER_WORDS.has(word));
  const guessWords = guess.split(' ').filter((word) => !FILLER_WORDS.has(word));
  if (!accepted.includes(' ') || !guessWords.length || !guessWords.some((word) => word.length >= 3)) return false;
  const remaining = [...answerWords];
  return guessWords.every((word) => {
    let index = remaining.findIndex((answerWord) => word === answerWord);
    if (index < 0) index = remaining.findIndex((answerWord) => wordsMatch(word, answerWord));
    if (index < 0) return false;
    remaining.splice(index, 1);
    return true;
  });
}

export function normalizeAnswer(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function levenshteinDistance(left, right) {
  const a = Array.from(left);
  const b = Array.from(right);
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

export function similarity(left, right) {
  const longest = Math.max(Array.from(left).length, Array.from(right).length);
  return longest === 0 ? 1 : 1 - levenshteinDistance(left, right) / longest;
}

export function isAnswerCorrect(guess, round) {
  const normalized = normalizeAnswer(guess);
  if (!normalized) return false;
  return [round.answer, ...round.aliases].some((candidate) => {
    const accepted = normalizeAnswer(candidate);
    if (normalized === accepted) return true;
    // Keep numeric guesses precise even while accepting partial names/titles.
    const answerNumbers = accepted.match(/\d+/g) ?? [];
    if ((normalized.match(/\d+/g) ?? []).some((number) => !answerNumbers.includes(number))) return false;
    if (matchesAnswerWords(normalized, accepted)) return true;
    if (Math.min(Array.from(normalized).length, Array.from(accepted).length) < 4) return false;
    return similarity(normalized, accepted) >= SIMILARITY_THRESHOLD;
  });
}
