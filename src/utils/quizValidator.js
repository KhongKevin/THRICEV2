const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

export function validateQuiz(quiz) {
  const fail = (message) => { throw new Error(`Invalid quiz: ${message}`); };
  if (!quiz || typeof quiz !== 'object') fail('expected a JSON object.');
  if (typeof quiz.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(quiz.date)) {
    fail('date must use YYYY-MM-DD.');
  }
  const date = new Date(`${quiz.date}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== quiz.date) {
    fail('date must be a real calendar date.');
  }
  if (!hasText(quiz.title)) fail('title is required.');
  if (!Array.isArray(quiz.rounds) || quiz.rounds.length !== 5) fail('exactly 5 rounds are required.');
  const ids = new Set();
  quiz.rounds.forEach((round, index) => {
    const label = `round ${index + 1}`;
    if (!round || typeof round !== 'object') fail(`${label} must be an object.`);
    if (!(hasText(round.id) || (Number.isInteger(round.id) && round.id > 0))) fail(`${label} needs an id.`);
    if (ids.has(String(round.id))) fail('round ids must be unique.');
    ids.add(String(round.id));
    if (!hasText(round.category) || !hasText(round.answer)) fail(`${label} needs a category and answer.`);
    if (!Array.isArray(round.aliases) || !round.aliases.every(hasText)) fail(`${label} aliases must be an array of nonempty strings.`);
    if (!Array.isArray(round.clues) || round.clues.length !== 3) fail(`${label} needs exactly 3 clues.`);
    round.clues.forEach((clue, clueIndex) => {
      if (!clue || clue.points !== 3 - clueIndex || !hasText(clue.question)) {
        fail(`${label} clues must have question text and points in the order 3, 2, 1.`);
      }
    });
  });
  return quiz;
}
