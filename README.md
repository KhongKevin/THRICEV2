# Third Time — daily trivia

A complete, static React + Vite trivia game. Five rounds, three clues per round, and up to 15 points. The original design uses a navy background, warm paper cards, green feedback, and self-hosted typography. No backend, database, accounts, or API keys are required.

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

## Quiz data

`public/data/today.json` is the only content contract. It contains five original sample rounds dated **2026-09-30**. The date in this file is authoritative: the app shows the published quiz even if the computer's current date is different. There is no automatic daily content generator.

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

`src/utils/answerMatcher.js` lowercases, strips punctuation and diacritics, and collapses whitespace. It checks the canonical answer and every explicit alias, then uses normalized Levenshtein similarity at the adjustable `SIMILARITY_THRESHOLD = 0.80`. Strings shorter than four characters require a normalized exact match. Dropping whole words is rejected unless that shorter answer is an alias; arbitrary substring matching is not used. Fuzzy matching is deliberately lightweight and may accept some near-matches; aliases remain the preferred way to author accepted variants.

## Updating today's quiz

1. Optionally copy the current quiz to `public/data/archive/YYYY-MM-DD.json`.
2. Replace `public/data/today.json`, including its date, with the next five-round quiz.
3. Validate, commit, and push to `main`.

The workflow rebuilds and publishes the site. Players receive the new quiz on their next page load. A changed quiz date resets active progress; historical scores remain. The page does not change quizzes halfway through an active session. If you are revising clues on the same date, keep ids and canonical answers stable; changed result metadata can invalidate an existing save.

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

- `thriceTriviaState:v1`: the active quiz date, round/clue indexes, score, round results, completion flags, feedback, and completion timestamp.
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
5. Go to **Actions → Deploy to GitHub Pages → Run workflow**, select `main`, and run it. Future pushes to `main` deploy automatically. If the first push failed because Pages was not enabled yet, rerun the workflow after selecting the source.
6. The deployment job links to:

   ```text
   https://USERNAME.github.io/REPOSITORY_NAME/
   ```

The [official Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) approach uses checkout, setup-node, configure-pages, upload-pages-artifact, and deploy-pages. This project's workflow uses the current stable majors verified at implementation: **v7, v7, v6, v5, v5**, respectively. It installs with `npm ci`, runs tests, validates/builds, uploads `dist`, and deploys the artifact. Build permissions are `contents: read` and `pages: read`; the deployment job has `pages: write` and `id-token: write`. No personal access token or secrets are needed for deployment.

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
│   │   ├── Modal.jsx
│   │   └── Icon.jsx
│   ├── services/quizService.js
│   └── utils/
│       ├── answerMatcher.js
│       ├── gameState.js
│       ├── quizValidator.js
│       └── storage.js
├── ingestion/
│   ├── README.md
│   ├── example_quiz.json
│   ├── validate-quiz.js
│   └── validate_quiz.py
└── tests/
    ├── answerMatcher.test.js
    ├── game.test.js
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

The font files are DM Sans and Libre Caslon Display, distributed under their included SIL Open Font Licenses. All game assets are self-hosted; gameplay makes no third-party requests. Questions and branding are original sample content and do not reproduce another game's assets or question bank.
