"""Validate a local quiz file using only the Python standard library. No network access."""

import datetime
import json
import re
import sys


def has_text(value):
    return isinstance(value, str) and bool(value.strip())


def validate(quiz):
    if not isinstance(quiz, dict):
        raise ValueError("Quiz must be an object.")
    date = quiz.get("date")
    if not isinstance(date, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        raise ValueError("Date must use YYYY-MM-DD.")
    datetime.date.fromisoformat(date)
    if not has_text(quiz.get("title")):
        raise ValueError("Title is required.")
    rounds = quiz.get("rounds")
    if not isinstance(rounds, list) or len(rounds) != 5:
        raise ValueError("Exactly 5 rounds are required.")
    ids = set()
    for index, round_data in enumerate(rounds, 1):
        if not isinstance(round_data, dict):
            raise ValueError(f"Round {index} must be an object.")
        round_id = round_data.get("id")
        if not (has_text(round_id) or (type(round_id) is int and round_id > 0)):
            raise ValueError(f"Round {index} needs an id.")
        if str(round_id) in ids:
            raise ValueError("Round ids must be unique.")
        ids.add(str(round_id))
        if not has_text(round_data.get("category")) or not has_text(round_data.get("answer")):
            raise ValueError(f"Round {index} needs a category and answer.")
        aliases = round_data.get("aliases")
        if not isinstance(aliases, list) or not all(has_text(alias) for alias in aliases):
            raise ValueError(f"Round {index} aliases must be an array of nonempty strings.")
        clues = round_data.get("clues")
        if not isinstance(clues, list) or len(clues) != 3:
            raise ValueError(f"Round {index} needs exactly 3 clues.")
        for clue_index, clue in enumerate(clues):
            if (not isinstance(clue, dict) or type(clue.get("points")) is not int
                    or clue.get("points") != 3 - clue_index or not has_text(clue.get("question"))):
                raise ValueError(f"Round {index} needs question text and clue points ordered 3, 2, 1.")


def main():
    if len(sys.argv) != 2:
        print("Usage: python ingestion/validate_quiz.py path/to/quiz.json", file=sys.stderr)
        return 1
    try:
        with open(sys.argv[1], encoding="utf-8") as source:
            quiz = json.load(source)
        validate(quiz)
        print(f"Valid quiz: {quiz['date']}, 5 rounds, 15 possible points.")
        return 0
    except (ValueError, OSError) as error:
        print(f"Invalid quiz: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
