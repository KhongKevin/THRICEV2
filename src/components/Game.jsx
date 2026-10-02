import { useEffect, useReducer, useRef, useState } from 'react';
import { gameReducer } from '../utils/gameState.js';
import { clearToday, loadGame, saveGame, saveHistory } from '../utils/storage.js';
import StartScreen from './StartScreen.jsx';
import ScoreDisplay from './ScoreDisplay.jsx';
import ClueCard from './ClueCard.jsx';
import AnswerInput from './AnswerInput.jsx';
import RoundResult from './RoundResult.jsx';
import Results from './Results.jsx';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import ClueHistory from './ClueHistory.jsx';
import RoundScores from './RoundScores.jsx';

export default function Game({ quiz }) {
  const [state, dispatch] = useReducer((previous, action) => gameReducer(previous, action, quiz), quiz, loadGame);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const locked = useRef(false);
  const unlockTimer = useRef(null);

  useEffect(() => {
    const progressSaved = saveGame(state);
    const historySaved = saveHistory(state);
    setStorageAvailable(progressSaved && historySaved);
  }, [state]);
  useEffect(() => () => clearTimeout(unlockTimer.current), []);

  function act(type, extra = {}) {
    if (locked.current) return;
    locked.current = true;
    setTransitioning(true);
    dispatch({ type, roundIndex: state.currentRoundIndex, clueIndex: state.currentClueIndex, ...extra });
    unlockTimer.current = setTimeout(() => { locked.current = false; setTransitioning(false); }, 350);
  }

  function restart() {
    setStorageAvailable(clearToday(quiz.date));
    clearTimeout(unlockTimer.current);
    locked.current = false;
    setTransitioning(false);
    dispatch({ type: 'RESTART' });
    setConfirmRestart(false);
  }

  const round = quiz.rounds[state.currentRoundIndex];
  return (
    <>
      {!storageAvailable && <p className="storage-warning" role="status">Your browser couldn’t save progress. You can keep playing, but this attempt may be lost when you leave.</p>}
      {!state.gameStarted ? <StartScreen quiz={quiz} onStart={() => dispatch({ type: 'START' })} /> : state.gameComplete ? <Results quiz={quiz} state={state} onRestart={() => setConfirmRestart(true)} /> : (
        <>
          <div className="game-status"><p>Round <strong>{state.currentRoundIndex + 1}</strong><span> of 5</span></p><ScoreDisplay score={state.score} /></div>
          <RoundScores quiz={quiz} state={state} />
          <div className="paper game-card">
            {state.roundComplete ? <RoundResult result={state.roundResults.at(-1)} isLast={state.currentRoundIndex === 4} onContinue={() => act('CONTINUE', { completedAt: new Date().toISOString() })} disabled={transitioning} /> : (
              <section aria-labelledby="clue-question">
                <ClueCard round={round} clueIndex={state.currentClueIndex} />
                <div className="clue-feedback" role="status" aria-live="polite" aria-atomic="true">{state.feedback || <span aria-hidden="true">Three clues. One answer. You’ve got this.</span>}</div>
                <AnswerInput key={`${state.currentRoundIndex}-${state.currentClueIndex}`} onGuess={(guess) => act('GUESS', { guess })} onSkip={() => act('SKIP')} disabled={transitioning} />
                <ClueHistory round={round} attempts={state.attempts} />
              </section>
            )}
          </div>
          <div className="game-bottom"><span>Each clue brings you a little closer.</span><button className="text-button" onClick={() => setConfirmRestart(true)}><Icon name="restart" /> Restart Game</button></div>
        </>
      )}
      {confirmRestart && <Modal title="Start fresh?" onClose={() => setConfirmRestart(false)}><p>This will erase today’s progress and saved score, and return you to the start. Previous days are kept.</p><div className="modal-actions"><button className="button button-outline" autoFocus onClick={() => setConfirmRestart(false)}>Keep my attempt</button><button className="button button-primary" onClick={restart}>Erase & restart</button></div></Modal>}
    </>
  );
}
