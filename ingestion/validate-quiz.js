import { readFile } from 'node:fs/promises';
import { validateQuiz } from '../src/utils/quizValidator.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node ingestion/validate-quiz.js path/to/quiz.json');
  process.exitCode = 1;
} else {
  try {
    const quiz = validateQuiz(JSON.parse(await readFile(file, 'utf8')));
    console.log(`Valid quiz: ${quiz.date}, ${quiz.rounds.length} rounds, 15 possible points.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
