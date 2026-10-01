export function AttemptLabel({ attempt }) {
  if (!attempt) return <p className="attempt-label">Not needed — you already had it.</p>;
  if (attempt.status === 'skipped') return <p className="attempt-label">You passed on this clue.</p>;
  if (attempt.guess === null) return <p className="attempt-label">{attempt.status === 'correct' ? 'Correct. ' : ''}Guess not recorded in the earlier version.</p>;
  return <p className={`attempt-label ${attempt.status}`}><span>{attempt.status === 'correct' ? 'Correct guess' : 'Your guess'}:</span> <strong>{attempt.guess}</strong>{attempt.status === 'incorrect' && <span> · Not quite</span>}</p>;
}

export default function ClueHistory({ round, attempts, full = false }) {
  const shownClues = round.clues.map((clue, clueIndex) => ({
    ...clue, clueIndex, attempt: attempts.find((item) => item.roundId === round.id && item.clueIndex === clueIndex),
  })).filter((clue) => full || clue.attempt);
  if (!shownClues.length) return null;
  return (
    <section className={full ? 'review-clues' : 'previous-clues'} aria-label={full ? `${round.category} clues and guesses` : 'Earlier clues and guesses'}>
      {!full && <h2>Earlier clues & guesses</h2>}
      <ol>{shownClues.map((clue) => <li key={clue.clueIndex}>
        <span className="history-clue-value">Clue {clue.clueIndex + 1} · {clue.points} {clue.points === 1 ? 'point' : 'points'}</span>
        <p className="history-question">{clue.question}</p>
        <AttemptLabel attempt={clue.attempt} />
      </li>)}</ol>
    </section>
  );
}
