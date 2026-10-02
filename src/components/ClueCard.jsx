export default function ClueCard({ round, clueIndex }) {
  const clue = round.clues[clueIndex];
  return (
    <div className="clue-content">
      <div className="clue-topline"><span className="category-label">{round.category}</span><span className="clue-position">Clue {clueIndex + 1} of 3 <span aria-hidden="true">·</span> <strong>{clue.points} {clue.points === 1 ? 'point' : 'points'}</strong></span></div>
      <h1 className="clue-question" id="clue-question">{clue.question}</h1>
    </div>
  );
}
