import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

export default function RoundResult({ result, isLast, onContinue, disabled }) {
  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  return (
    <section className={`round-result ${result.correct ? 'is-correct' : 'is-missed'}`} aria-labelledby="round-result-heading">
      <span className="result-symbol"><Icon name={result.correct ? 'check' : 'help'} /></span>
      <p className="eyebrow">{result.correct ? 'THAT’S THE ONE' : 'A LITTLE DISCOVERY'}</p>
      <h1 ref={headingRef} tabIndex={-1} id="round-result-heading">{result.correct ? 'Correct!' : 'Now you know.'}</h1>
      <p className="answer-reveal-label">The answer was</p>
      <h2 className="answer-reveal">{result.answer}</h2>
      <span className="earned-points">{result.correct ? '+' : ''}{result.points} {result.points === 1 ? 'point' : 'points'}</span>
      <p className="result-copy">{result.correct ? 'A little knowledge goes a long way.' : 'One more thing to keep in your back pocket.'}</p>
      <button className="button button-primary" onClick={onContinue} disabled={disabled}>{isLast ? 'See results' : 'Continue'}<Icon name="arrow" /></button>
    </section>
  );
}
