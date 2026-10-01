import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';
import ClueHistory from './ClueHistory.jsx';

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
      <ol className="results-list">{state.roundResults.map((result, index) => <li key={result.roundId}><span className="result-index">0{index + 1}</span><div className="result-details"><strong>{result.category}</strong><span>{result.answer}</span></div><span className="result-dots" aria-hidden="true">{[1, 2, 3].map((point) => <i className={point <= result.points ? 'filled' : ''} key={point} />)}</span><span className="round-score"><strong>{result.points}</strong> / 3</span></li>)}</ol>
      <button className="button button-outline" onClick={onRestart}><Icon name="restart" /> Play Again</button>
      <p className="save-note">Playing again erases today’s attempt and score.</p>
      <section className="full-recap" aria-labelledby="recap-heading">
        <h2 id="recap-heading">Your full recap</h2>
        {quiz.rounds.map((round, index) => <article key={round.id} className="recap-round">
          <div className="recap-heading"><h3>Round {index + 1} · {round.category}</h3><span>{state.roundResults[index].points} / 3</span></div>
          <p className="recap-answer"><span>Answer:</span> <strong>{round.answer}</strong></p>
          <ClueHistory round={round} attempts={state.attempts} full />
        </article>)}
      </section>
    </section>
  );
}
