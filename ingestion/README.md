# Automatic daily Thrice ingestion

The GitHub Actions workflow in `.github/workflows/deploy.yml` collects the current [Thrice by Geeks Who Drink](https://thrice.geekswhodrink.com/) quiz, validates it, commits the JSON and archives, builds the frontend, and deploys GitHub Pages. This runs on GitHub's servers, so your PC may be off, asleep, disconnected, or restarting. There is no daily manual input and no personal access token stored in the repository.

## Schedule

All times use `America/Chicago`, including daylight-saving changes:

| Run | Time |
| --- | --- |
| Primary morning update | 6:17 a.m. |
| First recovery run | 6:47 a.m. |
| Additional recovery runs | 7:17, 8:17, 9:17 a.m., and 12:17 p.m. |
| Daily-average snapshot | Noon |
| Stats recovery runs | 12:17, 12:47, and 1:17 p.m. |

An additional UTC schedule checks hourly at **11:37–20:37 UTC**, or **6:37 a.m.–3:37 p.m. CDT / 5:37 a.m.–2:37 p.m. CST**. This adds recovery opportunities after missed primary triggers, but shares GitHub's scheduler and its availability limits. Stats collection still waits until noon Central.

The workflow also runs on pushes to `main`; `workflow_dispatch` is available for optional maintenance. Once today's validated quiz is saved, recovery runs do not contact Thrice again. They still rebuild and deploy, allowing recovery from a previous deployment failure. The workflow name is **Update daily quiz and deploy**.

Thrice's countdown uses `America/New_York`. The collector uses that timezone for the quiz date, checks HTTP response dates throughout collection, and aborts if the source day changes midway. The schedule uses Central time; these are deliberately separate.

GitHub documents that [scheduled runs can be delayed or dropped under heavy load](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). The off-hour-minute start and multiple independent scheduled runs reduce that risk; this is not an exact-time guarantee. Public repositories can have schedules disabled after 60 days without repository activity. Normal daily quiz commits maintain activity, but a prolonged source outage, disabled Actions, or account/repository restrictions still require attention.

## How collection works

1. Open a new anonymous HTTP session with an in-memory cookie jar. Read and respect the site's `robots.txt`.
2. Read the category, clue text, round number, point value, and hidden fields from the public HTML skip form.
3. Submit the normal **I don't know** form for each clue using the same Turbo response format as the site.
4. Capture the displayed canonical answer after the third clue and follow **Next Question**.
5. Repeat for five rounds, then verify that the final recap contains every collected clue and answer.
6. Validate the complete JSON schema and source identifiers before writing published content.

A full run uses one robots request and 21 gameplay requests, spaced at least one second apart. No browser installation, keyboard automation, JavaScript execution, login, CAPTCHA solving, proxy rotation, access-control bypass, or extraction of hidden future quizzes is used. Anonymous skip submissions may be counted in the source's gameplay statistics.

Public answer reveals do not expose accepted-answer aliases, so imported rounds use empty alias arrays and the frontend's existing normalization/fuzzy matcher. The collector preserves source text rather than inferring alternate answers or generating replacement questions. JSON includes source attribution, daily identifiers, and retrieval time. The original sample remains in `example_quiz.json` for stable frontend tests.

## Reliability and failure behavior

- Timeouts, connection errors, HTTP 429, and server errors get up to three whole-session attempts with increasing backoff. `Retry-After` is respected; long rate limits are left to a later scheduled run.
- A fresh session after ambiguous request failures avoids duplicate progression in an existing game.
- Missing selectors, incorrect clue order, switched quiz IDs, missing answers, stale source content, unexpected destinations, and incomplete recaps fail closed.
- Failed collection leaves the last good `today.json` and deployed site intact. It never relabels yesterday's quiz with today's date.
- New and previous quizzes are archived under `public/data/archive/YYYY-MM-DD.json`.
- Files are written to temporary sibling files, flushed, and replaced atomically. A run interrupted after archiving can resume from that validated archive without another crawl.
- Successful reruns are idempotent: no new quiz commit and no extra crawl for the same date.
- The workflow tests, validates, and builds before committing. It uses a normal non-force push. A concurrent user push may safely reject that push; the next run uses the latest `main`.
- Deployments share a concurrency group and do not cancel in-progress runs.
- The same workflow deploys its artifact. It does not depend on its bot commit triggering another workflow; ordinary `GITHUB_TOKEN` pushes do not trigger push workflows.
- Failures and successful deployments are visible in Actions. Notification delivery depends on GitHub notification settings.

An upstream markup change or site shutdown can still require parser maintenance. No scraper can guarantee an independently operated site's structure or availability.

## Optional noon stats

`python -m ingestion.update_stats` runs after quiz collection. It only collects after noon in `America/Chicago`, and only for that local day's published quiz. It requests `/stats/week?week=YYYY-MM-DD` with the quiz week's Sunday, reads the `data-global-stats` daily averages, and selects the index relative to `data-sunday`. This also handles Sunday rollovers and avoids the source's not-yet-available daily recap. Personal scores and all-time category averages are not used. The parser checks the date range, missing values, and a finite score between 0 and 15.

The first valid daily snapshot is preserved on subsequent runs. It is written atomically to `public/data/stats.json` and archived separately under `public/data/stats-archive/`. The file contains the quiz date, source, score out of 15, and capture timestamp. A recovery run may capture later than noon; the UI shows the actual capture time. No estimated average is substituted for unavailable source data.

The workflow marks this step `continue-on-error: true`, so even an unexpected stats failure does not prevent building, committing, or deploying the game. The frontend loads stats independently, ignores wrong-date snapshots, and remains playable before noon or when stats are missing. A request timeout or missing file cannot block the answer controls.

To test the optional updater locally, after installing the same ingestion requirements:

```sh
python -m ingestion.update_stats
```

Before noon this exits successfully without requesting source stats. Unit tests exercise noon eligibility in both standard/daylight time, date-to-chart alignment, missing/malformed values, retry behavior, idempotence, and preservation of quiz files on failure.

## Local maintenance (optional)

GitHub installs everything automatically. React still consumes only static JSON and needs no Python runtime. To run ingestion locally with Python 3.11+:

```sh
python -m pip install -r ingestion/requirements.txt
python -m unittest discover -s ingestion/tests -v
python -m ingestion.update_quiz
```

On Windows, use `py` in place of `python` if that is your launcher. To check live collection without changing the site's data:

```sh
python -m ingestion.update_quiz --data-dir .qa/live-data
```

Synthetic parser tests cover full HTML/Turbo templates, all five rounds, changed markup, cross-host links, repeated clues, midnight rollover, retries, stale quizzes, idempotence, corrupt files, and interrupted writes. They do not contact the live site.

## Validation only

These offline commands do not collect anything:

```sh
npm run validate
node ingestion/validate-quiz.js ingestion/example_quiz.json
python ingestion/validate_quiz.py public/data/today.json
```

Both validators require a real ISO date, a title, five rounds with unique ids, categories, canonical answers, alias arrays, and three questions worth `3, 2, 1` points. They exit nonzero on invalid input.
