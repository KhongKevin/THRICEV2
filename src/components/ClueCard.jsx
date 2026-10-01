export default function ClueCard({ round, clueIndex }) {
  const clue = round.clues[clueIndex];
  return (
    <div className="clue-content">
      <div className="clue-topline"><span className="category-label">{round.category}</span><span className="clue-position">CLUE {clueIndex + 1} OF 3</span></div>
      <div className="clue-value"><span className="clue-value-number">{clue.points}</span><span>POINT<br />CLUE</span><div className="clue-steps" aria-hidden="true">{[0, 1, 2].map((index) => <i className={index <= clueIndex ? 'reached' : ''} key={index} />)}</div></div>
      <h1 className="clue-question" id="clue-question">{clue.question}</h1>
    </div>
  );
}
