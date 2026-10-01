import { validateQuiz } from '../utils/quizValidator.js';

export async function loadTodayQuiz({ signal } = {}) {
  let response;
  try {
    response = await fetch(`${import.meta.env.BASE_URL}data/today.json`, {
      signal,
      cache: 'no-cache',
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('The quiz could not be downloaded. Check your connection and try again.');
  }
  if (!response.ok) throw new Error(`The quiz file could not be loaded (HTTP ${response.status}).`);
  let quiz;
  try {
    quiz = await response.json();
  } catch {
    throw new Error('The quiz file is not valid JSON. Please try again later.');
  }
  return validateQuiz(quiz);
}
