import Icon from './Icon.jsx';

export default function StartScreen({ quiz, onStart }) {
  return (
    <section className="paper start-card" aria-labelledby="start-title">
      <span className="eyebrow"><span className="status-dot" /> YOUR DAILY TRIVIA BREAK</span>
      <h1 id="start-title">A little curiosity.<br /><em>Three chances.</em></h1>
      <p className="intro-copy">Five answers to find. Three clues to get there.<br className="desktop-break" /> How early will it click?</p>
      <div className="points-guide" aria-label="Clue 1 earns 3 points, clue 2 earns 2 points, clue 3 earns 1 point">
        {[3, 2, 1].map((points, index) => (
          <div className="points-step" key={points}><span className="mini-label">CLUE {index + 1}</span><div className="point-number">{points}<span>{points === 1 ? 'point' : 'points'}</span></div><span className="point-description">{['A little cryptic', 'Getting warmer', 'The giveaway'][index]}</span></div>
        ))}
      </div>
      <div className="start-stats"><span><strong>5</strong> rounds</span><span className="stat-divider" /><span><strong>15</strong> points possible</span></div>
      <button className="button button-primary start-button" onClick={onStart}>Start Game <Icon name="arrow" /></button>
      <p className="save-note">No timer. Just you and what you know.</p>
      <div className="category-preview"><span className="mini-label">IN THE MIX</span><div>{quiz.rounds.map((round) => <span key={round.id}>{round.category}</span>)}</div></div>
    </section>
  );
}
