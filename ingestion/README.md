# Content ingestion boundary

The frontend's only content contract is `public/data/today.json`. It does not depend on Python, a backend, or how the content is obtained. `example_quiz.json` is a complete example with five original sample rounds.

An external, approved process may eventually:

1. Obtain licensed, original, or otherwise approved quiz content.
2. Transform it into this project's JSON schema.
3. Validate the generated file.
4. Write `public/data/today.json`.
5. Optionally archive the previous quiz under `public/data/archive/YYYY-MM-DD.json` before replacing it.
6. Commit and push the changes to trigger the GitHub Pages workflow.

No ingestion, scraping, network restriction bypass, or scheduled content-fetching mechanism is implemented here. These validators only read local files.

## Validation

The JavaScript validator uses the same validation rules as the browser. It is included in every production build:

```sh
npm run validate
node ingestion/validate-quiz.js ingestion/example_quiz.json
```

For a separate Python-based process, the optional standard-library-only validator is also available:

```sh
python ingestion/validate_quiz.py public/data/today.json
```

On Windows with the Python launcher, use `py` instead of `python`. Both scripts exit with a nonzero code for invalid files.

Required fields: a real ISO date, nonempty title, exactly five rounds with unique ids, categories, canonical answers, alias arrays, and exactly three clues with nonempty questions and point values in the order `3, 2, 1`.

Use explicit aliases for intentionally shortened answers. Prefer questions with a clear single answer and clues that decrease in difficulty. Change the date when publishing a new daily quiz; the quiz date determines whether browser progress is reusable. Publishing is manual until an approved external process is added.
