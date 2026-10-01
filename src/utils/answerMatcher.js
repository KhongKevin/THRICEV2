export const SIMILARITY_THRESHOLD = 0.80;

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
    if (Math.min(Array.from(normalized).length, Array.from(accepted).length) < 4) return false;
    // Dropping entire words is intentional shortening, and belongs in aliases.
    const guessWords = normalized.split(' ');
    const answerWords = accepted.split(' ');
    if (guessWords.length < answerWords.length && guessWords.every((word) => answerWords.includes(word))) return false;
    return similarity(normalized, accepted) >= SIMILARITY_THRESHOLD;
  });
}
