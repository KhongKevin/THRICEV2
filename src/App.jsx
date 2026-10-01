import { useEffect, useState } from 'react';
import { loadTodayQuiz } from './services/quizService.js';
import Header from './components/Header.jsx';
import Game from './components/Game.jsx';
import Modal from './components/Modal.jsx';
import Icon from './components/Icon.jsx';

function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

export default function App() {
  const [quiz, setQuiz] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    loadTodayQuiz({ signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setQuiz(data);
    }).catch((reason) => {
      if (!controller.signal.aborted) setError(reason.message);
    });
    return () => controller.abort();
  }, [attempt]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to game</a>
      <Header onHelp={() => setShowHelp(true)} />
      <main id="main-content" tabIndex={-1}>
        <div className="edition-line"><span>DAILY TRIVIA</span><span className="edition-rule" />{quiz ? <time dateTime={quiz.date}>{formatDate(quiz.date)}</time> : <span>FIVE ROUNDS. THREE CHANCES.</span>}</div>
        {error ? <section className="paper error-card" role="alert"><span className="eyebrow">A SMALL HICCUP</span><h1>Unable to load today’s quiz.</h1><p>{error}</p><button className="button button-primary" onClick={() => setAttempt((value) => value + 1)}>Retry<Icon name="restart" /></button></section> : quiz ? <Game key={quiz.date} quiz={quiz} /> : <section className="paper loading-card" role="status"><span className="loading-dots" aria-hidden="true"><i /><i /><i /></span><p>Getting your daily five ready…</p></section>}
      </main>
      <footer className="site-footer"><span>FIVE ROUNDS. A LITTLE WISER.</span><span>Take your time. There’s no timer.</span></footer>
      {showHelp && <Modal title="Three clues. One answer." onClose={() => setShowHelp(false)}><p>Each day has 5 rounds. In every round, all three clues point to the same answer.</p><ol className="rules-list"><li><strong>Start with the tricky one.</strong> A correct answer on clue 1 earns 3 points, clue 2 earns 2, and clue 3 earns 1.</li><li><strong>Keep moving.</strong> A wrong answer or “I don’t know” reveals the next clue. Miss all three and the answer is revealed for 0 points.</li><li><strong>Make your fifteen.</strong> Finish all five rounds to see your score out of 15.</li></ol><p>Capitalization and punctuation don’t matter, and small typos are usually fine. Progress saves in this browser.</p><button className="button button-primary" onClick={() => setShowHelp(false)}>Got it<Icon name="check" /></button></Modal>}
    </div>
  );
}
