export default function RoundScores({ quiz, state }) {
  return <ol className="round-scoreboard" aria-label="Points earned each round">{quiz.rounds.map((round, index) => {
    const result = state.roundResults[index];
    const current = index === state.currentRoundIndex;
    return <li key={round.id} className={result ? `scored score-${result.points}` : current ? 'current' : ''} aria-current={current ? 'step' : undefined} aria-label={`Round ${index + 1}: ${result ? `${result.points} of 3 points` : current ? 'current round' : 'not started'}`}>
      <span className="scoreboard-round">Round {index + 1}</span>
      <span className="scoreboard-dots" aria-hidden="true">{[1, 2, 3].map((point) => <i key={point} className={result && point <= result.points ? 'earned' : ''} />)}</span>
      {result && <span className="scoreboard-value">{result.points} / 3</span>}
    </li>;
  })}</ol>;
}
