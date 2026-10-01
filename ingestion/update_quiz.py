"""Validate a complete source quiz before atomically replacing published content."""

import argparse
import json
import os
from pathlib import Path
import sys
import tempfile

from .thrice_client import CollectionError, SOURCE_URL, crawl_today, source_date
from .validate_quiz import validate


def read_quiz(path):
    try:
        quiz = json.loads(path.read_text(encoding="utf-8"))
        validate(quiz)
        return quiz
    except (OSError, ValueError):
        return None


def fresh(quiz, date):
    if not quiz or quiz["date"] != date:
        return False
    source = quiz.get("source")
    return (isinstance(source, dict) and source.get("url") == SOURCE_URL
            and type(source.get("quizNumber")) is int and source["quizNumber"] > 0
            and bool(source.get("dailyId")) and bool(source.get("retrievedAt")))


def atomic_write(path, quiz):
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(quiz, ensure_ascii=False, indent=2) + "\n"
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n",
                                         dir=path.parent, prefix=".quiz-", suffix=".tmp", delete=False) as output:
            temporary = Path(output.name)
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def update_quiz(data_dir, collector=crawl_today, date=None):
    date = date or source_date()
    today_path = data_dir / "today.json"
    archive_dir = data_dir / "archive"
    previous = read_quiz(today_path)
    if previous and previous["date"] > date:
        raise CollectionError("Refusing to replace a newer quiz with an older source day.")
    if fresh(previous, date):
        archive_path = archive_dir / f"{date}.json"
        if not archive_path.exists():
            atomic_write(archive_path, previous)
        print(f"Quiz {date} is already current; no source requests needed.", flush=True)
        return previous, False

    # Recover a prior run that stopped after archiving but before replacing today.json.
    candidate = read_quiz(archive_dir / f"{date}.json")
    if not fresh(candidate, date):
        candidate = collector()
    validate(candidate)
    if not fresh(candidate, date):
        raise CollectionError("Collected quiz date or source metadata is not current.")
    previous_source = previous.get("source") if previous else None
    if previous and previous["date"] < date and isinstance(previous_source, dict) and previous_source.get("url") == SOURCE_URL:
        old_number = previous["source"].get("quizNumber", 0)
        old_ids = [item["id"] for item in previous["rounds"]]
        if candidate["source"]["quizNumber"] <= old_number or old_ids == [item["id"] for item in candidate["rounds"]]:
            raise CollectionError("The source is still serving the previous quiz; keeping the last good file.")
    if previous and previous["date"] != date:
        old_archive = archive_dir / f"{previous['date']}.json"
        if not old_archive.exists():
            atomic_write(old_archive, previous)
    atomic_write(archive_dir / f"{date}.json", candidate)
    atomic_write(today_path, candidate)
    print(f"Updated {date}: five rounds, 15 clues, five answers. Previous quizzes are archived.", flush=True)
    return candidate, True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path("public/data"))
    args = parser.parse_args()
    try:
        quiz, changed = update_quiz(args.data_dir)
        summary = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary:
            with open(summary, "a", encoding="utf-8") as output:
                output.write(f"### Daily quiz\n\n{quiz['date']}: {'updated' if changed else 'already current'}. "
                             "Validated 5 rounds, 15 clues and 5 answers.\n\n"
                             "Morning schedule: 06:17 and 06:47 America/Chicago; "
                             "recovery runs at 07:17, 08:17, 09:17 and 12:17.\n")
        return 0
    except (CollectionError, OSError, ValueError) as error:
        print(f"Quiz update failed; last published quiz is retained. {error}", file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
