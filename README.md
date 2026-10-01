# Third Time — daily trivia

A complete, static React + Vite trivia game. Five rounds, three clues per round, and up to 15 points. The original design uses a navy background, warm paper cards, green feedback, and self-hosted typography. A scheduled GitHub Actions job imports the daily Thrice quiz and deploys the site automatically. No gameplay backend, database, accounts, or API keys are required.

## Local development

Use Node.js **22.12+** (Node 24 LTS is recommended and used by the deployment workflow).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173/`.

## Production test

```sh
npm test
npm run build
npm run preview
```

Preview normally runs at `http://localhost:4173/`. The production output is entirely contained in `dist/`. The build validates the current quiz before compiling. There are only four direct dependencies: React, React DOM, Vite, and Vite's React plugin. Node is a development/build tool, not a gameplay server.

`npm test` uses Node's built-in test runner. It checks answer normalization and matching, invalid quizzes, save recovery, restart, history, duplicate actions, and all 1,024 possible five-round score combinations.

## How the game works

- Correct on clue 1: **3 points**; clue 2: **2 points**; clue 3: **1 point**.
- A wrong answer or **I don’t know** advances to the next clue. The answer stays hidden until the round ends.
- Three misses earn **0 points** and reveal the answer.
- Use **Continue** after each round and **See results** after round five.
- Submit with Enter or the button. Empty guesses do nothing. Transitions briefly disable controls and stale actions are ignored to prevent duplicate submissions.
- Progress saves automatically in this browser. **Restart Game** and **Play Again** require confirmation before erasing today's attempt and today's history entry; earlier history is kept.
- After a miss or pass, previous clues and your guesses stay visible below the answer form. Each round's points appear in the five-round dot scoreboard.
- The final recap includes all 15 clues, canonical answers, your guesses and passes, and clues you did not need. Guess history is saved locally from this version onward. Older attempts retain their scores and show when a guess was not recorded.

## Quiz data

`public/data/today.json` is the only frontend content contract. It is updated automatically from the public Thrice game. The original sample dated **2026-09-30** remains in `ingestion/example_quiz.json` for testing. The date in the published JSON is authoritative: the app shows that quiz even if the computer's current date is different. Source metadata records attribution, quiz identifiers, and retrieval time.

Each quiz is an object with a real `YYYY-MM-DD` date, a title, and exactly five rounds. Each round has a unique positive integer or nonempty string `id`, a nonempty `category`, a canonical `answer`, an `aliases` array (which may be empty), and exactly three clues ordered by point values **3, 2, 1**. Every clue has nonempty `question` text.

Example of one round (the full quiz must have five):

```json
{
  "id": 1,
  "category": "History",
  "answer": "George Washington",
  "aliases": ["Washington"],
  "clues": [
    { "points": 3, "question": "Hard clue here." },
    { "points": 2, "question": "Medium clue here." },
    { "points": 1, "question": "Easy clue here." }
  ]
}
```

See `ingestion/example_quiz.json` for a complete example.

### Answer matching

`src/utils/answerMatcher.js` lowercases, strips punctuation and diacritics, and collapses whitespace. It checks the canonical answer and aliases, then accepts meaningful whole-word subsets of multi-word answers in any order. For `Patrick Star Jane`, `Patrick`, `Star Jane`, and `Patrick Jane` all work. At least one guessed word must have three characters; filler-only guesses such as `the` do not count, unrelated extra words are rejected, and arbitrary character substrings do not match. Typo tolerance uses normalized Levenshtein similarity with adjustable `SIMILARITY_THRESHOLD = 0.72`; fuzzy token matching requires five-character words. Very short answers and numeric differences remain conservative. This intentionally generous matching may accept more answers than Thrice itself.

## Automatic daily updates

The **Update daily quiz and deploy** GitHub Actions workflow collects the daily quiz at **6:17 a.m. America/Chicago**, with recovery runs at **6:47, 7:17, 8:17, 9:17 a.m., and 12:17 p.m.** Times follow Central daylight saving changes. Your computer does not need to be on.

The collector follows the normal skip/reveal forms, captures all five categories, 15 clues, and five answers, checks the final recap, and validates the complete quiz. It then archives prior content, replaces `today.json`, runs a production build, commits the data, and deploys Pages. Once a day's quiz is saved, recovery runs skip collection and retry deployment. A failed scrape leaves the last published quiz available.

### Noon average-score snapshot

At **12:00 p.m. America/Chicago**, the workflow also reads Thrice's published daily average from its global weekly chart, using the quiz's date to select the correct value out of 15. Recovery runs at **12:17, 12:47 and 1:17 p.m.** retry missing stats. The first valid snapshot of the day is saved to `public/data/stats.json` and `public/data/stats-archive/YYYY-MM-DD.json`. Central time follows daylight saving changes.

The stats step is optional and cannot fail the gameplay deployment. Before noon, the interface says stats are pending; missing, failed, malformed, or wrong-date stats show an unavailable message. Gameplay never waits for them. Open tabs recheck every five minutes while a snapshot is missing and when becoming visible. Available stats show the source, capture time, and your final score relative to the Thrice average. This is a snapshot of Thrice players, not a live average of this app's players.

Thrice resets at midnight Eastern, so source dates use `America/New_York`. No daily manual input or personal-access-token setup is needed. GitHub can delay scheduled jobs, and source layout changes can require parser maintenance; recovery runs reduce transient failures but cannot promise exact timing or zero failures. See [ingestion/README.md](ingestion/README.md) for details and optional local commands.

### Manual content maintenance

1. Optionally copy the current quiz to `public/data/archive/YYYY-MM-DD.json`.
2. Replace `public/data/today.json`, including its date, with the next five-round quiz.
3. Validate, commit, and push to `main`.

The workflow imports the current source quiz before deploying; manual replacement content without current source metadata is replaced by that import. To switch sources, change or remove the collection step and schedule deliberately. Players receive updates on their next page load. A changed quiz date resets active progress; historical scores remain. The page does not change quizzes halfway through an active session.

There is no archive UI yet. Date-based archive files and the history store are ready for that future feature. The ingestion process is documented separately in [ingestion/README.md](ingestion/README.md).

## Validate quiz

The JavaScript validator shares the browser's schema checks and runs automatically during `npm run build`:

```sh
npm run validate
node ingestion/validate-quiz.js ingestion/example_quiz.json
```

An optional Python 3 validator uses only the standard library and reads local files:

```sh
python ingestion/validate_quiz.py public/data/today.json
```

On Windows, `py ingestion/validate_quiz.py public/data/today.json` also works when the Python launcher is installed. Python is never required to develop, build, deploy, or play the frontend. Both validators return a nonzero exit code for invalid content.

## Persistence and future history

- `thriceTriviaState:v1`: the active quiz date, round/clue indexes, score, round results, guess/pass records, completion flags, feedback, and completion timestamp. Older saves are migrated without changing scores or inventing past guesses.
- `thriceTriviaHistory:v1`: results indexed by quiz date, each containing `score`, `maxScore`, and `completedAt`.

Saved state is validated before restoration. Incorrect dates, impossible indexes/scores, and malformed saves are discarded. Browser storage failures are nonfatal and display an in-game notice. Replaying removes today's history entry after confirmation; completing the replay writes the replacement. History is local to the browser/origin, does not synchronize between devices, and can be lost when browser data is cleared.

## GitHub Pages deployment

1. On GitHub, create an **empty public repository**, for example `ThriceV2`. GitHub Free supports Pages from public repositories. Leave the initialization options (README, license, and .gitignore) unchecked because the local project already contains its own files.
2. In this project directory, run the following, replacing `USERNAME` and `REPOSITORY_NAME`:

   ```sh
   git init -b main
   git add .
   git commit -m "Build Third Time daily trivia"
   git remote add origin https://github.com/USERNAME/REPOSITORY_NAME.git
   git push -u origin main
   ```

   Authenticate to GitHub if Git requests it. If the folder is already a Git repository, skip `git init`; use its existing remote or update it deliberately.

3. In the GitHub repository, open **Settings → Pages**.
4. Under **Build and deployment → Source**, choose **GitHub Actions**.
5. Go to **Actions → Update daily quiz and deploy → Run workflow**, select `main`, and run it. Future pushes and the daily schedule update/deploy automatically. If the first push failed because Pages was not enabled yet, rerun the workflow after selecting the source.
6. The deployment job links to:

   ```text
   https://USERNAME.github.io/REPOSITORY_NAME/
   ```

The [official Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) approach uses checkout, setup-node, configure-pages, upload-pages-artifact, and deploy-pages. This project's workflow uses stable majors **v7, v7, v6, v5, v5**, respectively, and **setup-python v7** for ingestion. It installs with `npm ci`, tests the frontend and collector, imports/validates/builds, commits quiz updates, uploads `dist`, and deploys the artifact. Build permissions are `contents: write` (quiz commits) and `pages: read`; the deployment job has `pages: write` and `id-token: write`. GitHub supplies `GITHUB_TOKEN` automatically; no personal access token or added repository secrets are needed.

### Project URL support

Vite's `base: './'` keeps generated JS, CSS, icons, and fonts relative to the page. `loadTodayQuiz()` fetches `${import.meta.env.BASE_URL}data/today.json`, so it resolves to `/REPOSITORY_NAME/data/today.json` under a project site. No repository-name configuration is needed. The app deliberately has no client-side routes or React Router; use the Pages directory URL with its trailing slash. If routes are added later, revisit this strategy.

## Project structure

```text
ThriceV2/
├── .github/workflows/deploy.yml
├── .gitignore
├── .nvmrc
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── README.md
├── public/
│   ├── favicon.svg
│   ├── fonts/                      # Self-hosted fonts + OFL licenses
│   └── data/
│       ├── today.json
│       ├── stats.json
│       ├── stats-archive/             # Created after the first noon snapshot
│       └── archive/.gitkeep
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── styles.css
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── StartScreen.jsx
│   │   ├── Game.jsx
│   │   ├── ClueCard.jsx
│   │   ├── AnswerInput.jsx
│   │   ├── ScoreDisplay.jsx
│   │   ├── RoundResult.jsx
│   │   ├── Results.jsx
│   │   ├── ClueHistory.jsx
│   │   ├── RoundScores.jsx
│   │   ├── DailyAverage.jsx
│   │   ├── Modal.jsx
│   │   └── Icon.jsx
│   ├── services/                     # quizService.js, statsService.js
│   └── utils/
│       ├── answerMatcher.js
│       ├── gameState.js
│       ├── stats.js
│       ├── quizValidator.js
│       └── storage.js
├── ingestion/
│   ├── README.md
│   ├── example_quiz.json
│   ├── __init__.py
│   ├── requirements.txt
│   ├── thrice_client.py
│   ├── update_quiz.py
│   ├── update_stats.py
│   ├── tests/test_ingestion.py
│   ├── tests/test_stats.py
│   ├── validate-quiz.js
│   └── validate_quiz.py
└── tests/
    ├── answerMatcher.test.js
    ├── game.test.js
    ├── stats.test.js
    └── storage.test.js
```

## Accessibility and manual checks

The app includes labeled inputs, native buttons, Enter submission, visible keyboard focus, a skip link, live clue feedback, focus on new clues and round results, native modal dialogs, reduced-motion support, and text accompanying success/miss colors. The centered layout is capped at 760px and adapts to narrow screens.

For a release, use the production preview to check:

- A correct first, second, and third clue earns 3, 2, and 1 respectively; three misses earn 0.
- Skipping advances clues. A wrong guess clears and refocuses the input without revealing the answer.
- Aliases, capitalization, punctuation, and a minor typo work. Blank and unrelated short answers fail.
- Refresh during a round and on the results screen restores the attempt. A new quiz date starts fresh.
- Restart can be canceled; confirmation returns to the start and clears today's score.
- All five rounds finish at a score between 0 and 15.
- The production site loads at its repository path, with no missing assets or runtime errors.
- At 320–390px widths and at 200% zoom, clues, controls, results, and dialogs remain usable. Check keyboard-only navigation and the system's reduced-motion setting.

## Static-site security and design notes

Answers are delivered in public JSON and can be inspected using developer tools or by opening the JSON URL. This is acceptable for a casual trivia game. There is no fake encryption or claim of secure answer hiding. Local scores are also client-controlled and are not suitable for competitive leaderboards.

The font files are DM Sans and Libre Caslon Display, distributed under their included SIL Open Font Licenses. All game assets are self-hosted; frontend gameplay makes no third-party requests. Interface branding is original. Daily imported questions and answers come from Thrice by Geeks Who Drink, as recorded in source metadata; the bundled example questions are original sample content.
