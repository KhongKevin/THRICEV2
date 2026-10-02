import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';
import ClueHistory from './ClueHistory.jsx';
import DailyAverage from './DailyAverage.jsx';

function scoreMessage(score) {
  if (score === 15) return 'Perfect game!';
  if (score >= 12) return 'Excellent run!';
  if (score >= 8) return 'Nice work!';
  return 'There’s always tomorrow.';
}

export default function Results({ quiz, state, onRestart }) {
  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  return (
    <section className="paper results-card" aria-labelledby="results-title">
      <span className="eyebrow"><Icon name="star" /> ALL FIVE ROUNDS, IN THE BOOKS</span>
      <h1 ref={headingRef} tabIndex={-1} id="results-title">Today’s Score</h1>
      <div className="final-score" aria-label={`${state.score} out of 15 points`}>{state.score}<span>/ 15</span></div>
      <p className="score-message">{scoreMessage(state.score)}</p>
      <DailyAverage quizDate={quiz.date} score={state.score} />
      <p className="recap-hint">Open a round to review its clues and your guesses.</p>
      <div className="results-rounds">{quiz.rounds.map((round, index) => {
        const result = state.roundResults[index];
        return <details className="recap-round" key={round.id}>
          <summary>
            <span className="result-index">{index + 1}<span className="sr-only">. Round</span></span>
            <span className="result-details"><strong>{round.category}</strong><span>{round.answer}</span></span>
            <span className="result-dots" aria-hidden="true">{[1, 2, 3].map((point) => <i className={point <= result.points ? 'filled' : ''} key={point} />)}</span>
            <span className="round-score"><strong>{result.points}</strong> / 3</span>
            <span className="recap-chevron" aria-hidden="true" />
          </summary>
          <ClueHistory round={round} attempts={state.attempts} full />
        </details>;
      })}</div>
      <button className="button button-outline" onClick={onRestart}><Icon name="restart" /> Play Again</button>
      <p className="save-note">Playing again erases today’s attempt and score.</p>
    </section>
  );
}
