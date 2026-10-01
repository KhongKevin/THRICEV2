import { createInitialState, isValidSavedState } from './gameState.js';

export const STATE_KEY = 'thriceTriviaState:v1';
export const HISTORY_KEY = 'thriceTriviaHistory:v1';

export function loadGame(quiz) {
  try {
    const saved = JSON.parse(localStorage.getItem(STATE_KEY));
    if (isValidSavedState(saved, quiz)) return saved;
    localStorage.removeItem(STATE_KEY);
  } catch {
    // Unavailable storage and malformed saves must never prevent a game.
  }
  return createInitialState(quiz);
}

export function saveGame(state) {
  try {
    if (state.gameStarted) localStorage.setItem(STATE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STATE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function saveHistory(state) {
  if (!state.gameComplete) return true;
  try {
    let history;
    try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)); } catch { history = {}; }
    if (!history || typeof history !== 'object' || Array.isArray(history)) history = {};
    history[state.quizDate] = { score: state.score, maxScore: 15, completedAt: state.completedAt };
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return true;
  } catch {
    return false;
  }
}

export function clearToday(quizDate) {
  try {
    localStorage.removeItem(STATE_KEY);
    let history;
    try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)); } catch { return true; }
    if (history && typeof history === 'object' && !Array.isArray(history)) {
      delete history[quizDate];
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }
    return true;
  } catch {
    return false;
  }
}
