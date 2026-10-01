"""Import a dated Thrice daily-average snapshot after noon Central; never needed to play."""

import argparse
import datetime as dt
import json
import math
import os
from pathlib import Path
import sys
import time
from zoneinfo import ZoneInfo

from .thrice_client import (
    CollectionError, TemporarySourceError, Session, check_response_date, page_document, required,
)
from .update_quiz import atomic_write, read_quiz

CENTRAL = ZoneInfo("America/Chicago")
STATS_URL = "https://thrice.geekswhodrink.com/stats"


def noon_reached(quiz_date, now):
    local = now.astimezone(CENTRAL)
    return local.date().isoformat() == quiz_date and local.hour >= 12


def parse_stats(html, quiz_date):
    document = page_document(html)
    chart = required(document, '[data-controller~="stats-chart"][data-sunday][data-global-stats]')
    try:
        sunday = dt.date.fromisoformat(chart["data-sunday"])
        target = dt.date.fromisoformat(quiz_date)
        averages = json.loads(chart["data-global-stats"])
    except (ValueError, TypeError) as error:
        raise CollectionError("Thrice's daily-average chart data is invalid.") from error
    offset = (target - sunday).days
    if sunday.weekday() != 6 or not 0 <= offset < 7:
        raise CollectionError("Thrice's stats chart does not cover this quiz date.")
    if not isinstance(averages, list) or len(averages) > 7 or offset >= len(averages):
        raise CollectionError("Thrice has not published an average for this quiz date.")
    average = averages[offset]
    if type(average) not in (int, float) or not math.isfinite(average) or not 0 <= average <= 15:
        raise CollectionError("Thrice's daily average is missing or outside 0–15.")
    return float(average)


def collect_stats(quiz_date, attempts=3, session_factory=Session, sleeper=time.sleep):
    target = dt.date.fromisoformat(quiz_date)
    sunday = target - dt.timedelta(days=(target.weekday() + 1) % 7)
    for attempt in range(1, attempts + 1):
        try:
            session = session_factory()
            session.check_robots()
            # The daily recap may not exist yet. The weekly chart includes today's average.
            html, server_date = session.request(f"/stats/week?week={sunday.isoformat()}")
            check_response_date(server_date, quiz_date)
            return parse_stats(html, quiz_date)
        except TemporarySourceError as error:
            if attempt == attempts or error.retry_after > 180:
                raise
            delay = max(10 * 3 ** (attempt - 1), error.retry_after)
            print(f"Stats request failed; retrying in {delay:g}s.", flush=True)
            sleeper(delay)
    raise CollectionError("Stats collection did not complete.")


def valid_snapshot(stats, quiz_date):
    if not isinstance(stats, dict) or stats.get("status") != "available" or stats.get("date") != quiz_date:
        return False
    average = stats.get("averageScore")
    if type(average) not in (float, int) or not math.isfinite(average) or not 0 <= average <= 15:
        return False
    source = stats.get("source")
    if stats.get("maxScore") != 15 or not isinstance(source, dict) or source.get("url") != STATS_URL:
        return False
    try:
        captured = dt.datetime.fromisoformat(stats["retrievedAt"])
        return captured.tzinfo is not None and noon_reached(quiz_date, captured)
    except (ValueError, TypeError, KeyError):
        return False


def update_stats(data_dir, now=None, collector=collect_stats):
    now = now or dt.datetime.now(dt.timezone.utc)
    quiz = read_quiz(data_dir / "today.json")
    if not quiz:
        raise CollectionError("A valid quiz is required before matching its stats.")
    if not noon_reached(quiz["date"], now):
        print("Stats deferred until noon America/Chicago for the published quiz date.", flush=True)
        return False
    target = data_dir / "stats.json"
    try:
        previous = json.loads(target.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        previous = None
    if valid_snapshot(previous, quiz["date"]):
        print(f"The noon stats snapshot for {quiz['date']} is already saved.", flush=True)
        return False
    average = collector(quiz["date"])
    snapshot = {
        "status": "available", "date": quiz["date"], "averageScore": average, "maxScore": 15,
        "retrievedAt": now.isoformat(),
        "source": {"name": "Thrice by Geeks Who Drink", "url": STATS_URL},
    }
    if not valid_snapshot(snapshot, quiz["date"]):
        raise CollectionError("The collected stats snapshot failed validation.")
    atomic_write(data_dir / "stats-archive" / f"{quiz['date']}.json", snapshot)
    atomic_write(target, snapshot)
    print(f"Saved Thrice average for {quiz['date']}: {average:.2f}/15.", flush=True)
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path("public/data"))
    args = parser.parse_args()
    try:
        changed = update_stats(args.data_dir)
        message = "Thrice daily-average snapshot saved." if changed else "Stats are already saved or it is not yet noon Central."
        code = 0
    except (CollectionError, ValueError, OSError) as error:
        message = f"Optional stats unavailable: {error} Gameplay and quiz publishing remain available."
        print(message, file=sys.stderr)
        code = 1
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as output:
            output.write(f"\n### Optional noon stats\n\n{message}\n")
    return code


if __name__ == "__main__":
    sys.exit(main())
