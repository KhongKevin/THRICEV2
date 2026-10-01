export default function ScoreDisplay({ score }) {
  return <div className="score-display" aria-label={`Current score: ${score} out of 15`}><span>SCORE</span><strong>{score}<small> / 15</small></strong></div>;
}
