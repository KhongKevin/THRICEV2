import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

export default function AnswerInput({ onGuess, onSkip, disabled }) {
  const [answer, setAnswer] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { if (!disabled) inputRef.current?.focus(); }, [disabled]);

  function submit(event) {
    event.preventDefault();
    if (disabled || !answer.trim()) return;
    onGuess(answer.trim());
    setAnswer('');
  }

  return (
    <form className="answer-form" onSubmit={submit}>
      <label htmlFor="answer">Your answer</label>
      <input ref={inputRef} id="answer" name="answer" type="text" value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && (event.repeat || event.nativeEvent.isComposing)) event.preventDefault(); }} placeholder="Take a guess…" autoComplete="off" autoCapitalize="none" spellCheck="false" maxLength={200} disabled={disabled} aria-describedby="clue-question answer-hint" />
      <p id="answer-hint" className="input-hint">Small typos are okay. Trust your instinct.</p>
      <div className="answer-actions"><button className="button button-primary" type="submit" disabled={disabled || !answer.trim()}>Submit Answer <Icon name="arrow" /></button><button className="button button-quiet" type="button" onClick={onSkip} disabled={disabled}>I don’t know</button></div>
    </form>
  );
}
