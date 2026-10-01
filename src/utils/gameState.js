import { isAnswerCorrect } from './answerMatcher.js';

export const MAX_SCORE = 15;

export function createInitialState(quiz) {
  return {
    quizDate: quiz.date,
    gameStarted: false,
    currentRoundIndex: 0,
    currentClueIndex: 0,
    score: 0,
    roundResults: [],
    roundComplete: false,
    gameComplete: false,
    completedAt: null,
    feedback: '',
  };
}

export function gameReducer(state, action, quiz) {
  if (action.type === 'RESTART') return createInitialState(quiz);
  if (action.type === 'START') return state.gameStarted ? state : { ...state, gameStarted: true };
  if (!state.gameStarted || state.gameComplete) return state;
  // A queued/double submission can only affect the clue it originated from.
  if (action.roundIndex !== state.currentRoundIndex || action.clueIndex !== state.currentClueIndex) return state;
  if (action.type === 'CONTINUE' && state.roundComplete) {
    if (state.currentRoundIndex === quiz.rounds.length - 1) {
      return { ...state, gameComplete: true, completedAt: action.completedAt, feedback: '' };
    }
    return { ...state, currentRoundIndex: state.currentRoundIndex + 1, currentClueIndex: 0, roundComplete: false, feedback: '' };
  }
  if (!['GUESS', 'SKIP'].includes(action.type) || state.roundComplete) return state;
  if (action.type === 'GUESS' && !String(action.guess ?? '').trim()) return state;
  const round = quiz.rounds[state.currentRoundIndex];
  const correct = action.type === 'GUESS' && isAnswerCorrect(action.guess, round);
  if (correct || state.currentClueIndex === 2) {
    const points = correct ? round.clues[state.currentClueIndex].points : 0;
    const result = { roundId: round.id, category: round.category, points, correct, answer: round.answer };
    return { ...state, score: state.score + points, roundResults: [...state.roundResults, result], roundComplete: true, feedback: '' };
  }
  const nextPoints = round.clues[state.currentClueIndex + 1].points;
  return {
    ...state,
    currentClueIndex: state.currentClueIndex + 1,
    feedback: action.type === 'GUESS' ? `Not quite. Try the ${nextPoints}-point clue.` : `Showing the ${nextPoints}-point clue.`,
  };
}

export function isValidSavedState(state, quiz) {
  if (!state || state.quizDate !== quiz.date) return false;
  if (!['gameStarted', 'roundComplete', 'gameComplete'].every((key) => typeof state[key] === 'boolean')) return false;
  if (!Number.isInteger(state.currentRoundIndex) || state.currentRoundIndex < 0 || state.currentRoundIndex >= 5) return false;
  if (!Number.isInteger(state.currentClueIndex) || state.currentClueIndex < 0 || state.currentClueIndex >= 3) return false;
  const expectedResults = state.currentRoundIndex + (state.roundComplete ? 1 : 0);
  if (!Array.isArray(state.roundResults) || state.roundResults.length !== expectedResults) return false;
  if (!state.roundResults.every((result, index) => {
    const round = quiz.rounds[index];
    return result && result.roundId === round.id && result.category === round.category && result.answer === round.answer
      && Number.isInteger(result.points) && result.points >= 0 && result.points <= 3 && result.correct === (result.points > 0);
  })) return false;
  if (!Number.isInteger(state.score) || state.score !== state.roundResults.reduce((sum, result) => sum + result.points, 0)) return false;
  if (!state.gameStarted && (state.currentRoundIndex !== 0 || state.currentClueIndex !== 0 || state.roundComplete || state.gameComplete)) return false;
  if (state.gameComplete && (!state.roundComplete || state.currentRoundIndex !== 4 || typeof state.completedAt !== 'string' || !Number.isFinite(Date.parse(state.completedAt)))) return false;
  if (!state.gameComplete && state.completedAt !== null) return false;
  if (state.roundComplete) {
    const points = state.roundResults.at(-1).points;
    if (points > 0 ? points !== 3 - state.currentClueIndex : state.currentClueIndex !== 2) return false;
  }
  return typeof state.feedback === 'string';
}
