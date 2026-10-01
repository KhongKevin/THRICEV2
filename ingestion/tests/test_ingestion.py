"""Synthetic fixtures match the public form structure without copying source questions."""

import copy
import datetime as dt
import html
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from ingestion.thrice_client import (
    CollectionError, TemporarySourceError, SOURCE_URL, allowed_url, check_response_date,
    crawl_once, crawl_today, parse_clue, parse_reveal, source_date,
)
from ingestion.update_quiz import atomic_write, read_quiz, update_quiz

EXAMPLE = json.loads((Path(__file__).resolve().parents[1] / "example_quiz.json").read_text(encoding="utf-8"))
DATE = "2026-10-01"
SERVER_DATE = "Thu, 01 Oct 2026 12:00:00 GMT"


def quiz(date=DATE, number=100):
    result = copy.deepcopy(EXAMPLE)
    result["date"] = date
    result["source"] = {"url": SOURCE_URL, "quizNumber": number, "dailyId": str(number),
                        "retrievedAt": f"{date}T12:00:00+00:00"}
    return result


def wrap(content, turbo=True):
    if turbo:
        return f'<turbo-stream action="replace" target="main"><template><turbo-frame id="main">{content}</turbo-frame></template></turbo-stream>'
    return f'<html><div class="orange-bar">How to play</div><turbo-frame id="main">{content}</turbo-frame></html>'


def clue_page(round_number, clue_number, turbo=True):
    item = EXAMPLE["rounds"][round_number - 1]
    return wrap(f'''
      <div class="orange-bar"><span>Category:</span> {html.escape(item['category'])}</div>
      <div class="card-body"><span class="question-heading">Question {round_number}</span>
      <span>For {4 - clue_number} points</span>
      <div class="clue-text">{html.escape(item['clues'][clue_number - 1]['question'])}</div>
      <form action="/user-guess" method="post" data-skip-preloader-target="skipForm">
        <input type="hidden" name="authenticity_token" value="synthetic-csrf-token">
        <input type="hidden" name="current_question" value="{round_number}">
        <input type="hidden" name="current_clue" value="{clue_number}">
      </form></div>''', turbo)


def reveal_page(round_number):
    item = EXAMPLE["rounds"][round_number - 1]
    return wrap(f'''
      <div class="orange-bar">Category: {item['category']}</div>
      <div class="question-heading">Question {round_number}</div>
      <div class="clue-text"><div class="clue-text-intro">Skipped</div>
        <div>The answer is <span class="font-bold">{html.escape(item['answer'])}</span></div>
      </div><a href="/next?dqs_id=100">Next Question</a>''')


def results_page():
    values = [value for item in EXAMPLE['rounds'] for value in [item['answer'], *[clue['question'] for clue in item['clues']]]]
    return wrap('<div class="orange-bar">Results</div><button data-mobile-share-text="Thrice Game #100 → 0 points">Share</button>'
                + '<p>' + html.escape(' '.join(values)) + '</p>')


class FakeSession:
    def __init__(self):
        self.pages = []
        for number in range(1, 6):
            self.pages.extend([clue_page(number, clue, turbo=not(number == clue == 1)) for clue in range(1, 4)])
            self.pages.append(reveal_page(number))
        self.pages.append(results_page())
        self.requests = []
        self.robots_checked = False

    def check_robots(self):
        self.robots_checked = True

    def request(self, path, fields=None):
        self.requests.append((path, fields))
        return self.pages.pop(0), SERVER_DATE


class ParserTests(unittest.TestCase):
    def test_full_html_and_turbo_templates_preserve_question_and_hidden_fields(self):
        for turbo in (False, True):
            clue = parse_clue(clue_page(1, 2, turbo))
            self.assertEqual((clue.round_number, clue.clue_number), (1, 2))
            self.assertEqual(clue.question, EXAMPLE['rounds'][0]['clues'][1]['question'])
            self.assertEqual(clue.fields['authenticity_token'], 'synthetic-csrf-token')

    def test_reveal_requires_canonical_answer_and_same_round(self):
        answer, url, identifier = parse_reveal(reveal_page(1), 1, 'History')
        self.assertEqual(answer, 'George Washington')
        self.assertEqual(identifier, '100')
        self.assertTrue(url.startswith(SOURCE_URL))
        with self.assertRaises(CollectionError):
            parse_reveal(reveal_page(1), 2, 'History')

    def test_source_markup_changes_fail_closed(self):
        for before, after in [('name="current_clue"', 'name="changed"'), ('For 3 points', 'For 2 points'),
                              ('class="clue-text"', 'class="changed"'), ('/user-guess', 'https://example.com/steal')]:
            with self.assertRaises(CollectionError):
                parse_clue(clue_page(1, 1).replace(before, after))

    def test_navigation_cannot_leak_session_data_to_other_hosts(self):
        for url in ('https://example.com/', '//example.com/user-guess', '/login', 'http://thrice.geekswhodrink.com/'):
            with self.assertRaises(CollectionError):
                allowed_url(url)

    def test_crawl_collects_exactly_five_rounds_and_checks_final_recap(self):
        session = FakeSession()
        result = crawl_once(DATE, session)
        expected = copy.deepcopy(EXAMPLE['rounds'])
        for item in expected:
            item['aliases'] = []  # Public reveals do not expose accepted-answer aliases.
        self.assertEqual(result['rounds'], expected)
        self.assertEqual(result['source']['quizNumber'], 100)
        self.assertEqual(len(session.requests), 21)
        self.assertEqual(sum(fields is not None for _, fields in session.requests), 15)
        self.assertTrue(session.robots_checked)

    def test_crawl_rejects_repeated_clue_mixed_quiz_and_missing_recap(self):
        for index, replacement in [(1, clue_page(1, 1)), (7, reveal_page(2).replace('dqs_id=100', 'dqs_id=101')),
                                   (20, results_page().replace('George Washington', 'missing'))]:
            session = FakeSession()
            session.pages[index] = replacement
            with self.assertRaises(CollectionError):
                crawl_once(DATE, session)

    def test_source_date_uses_eastern_and_rejects_midnight_rollover(self):
        self.assertEqual(source_date(dt.datetime(2026, 10, 1, 3, 30, tzinfo=dt.timezone.utc)), '2026-09-30')
        self.assertEqual(source_date(dt.datetime(2026, 10, 1, 4, 30, tzinfo=dt.timezone.utc)), DATE)
        self.assertEqual(source_date(dt.datetime(2026, 12, 1, 4, 30, tzinfo=dt.timezone.utc)), '2026-11-30')
        with self.assertRaises(TemporarySourceError):
            check_response_date(SERVER_DATE, '2026-09-30')

    def test_retry_restarts_collection_and_respects_backoff(self):
        calls, waits = [], []
        def collector(date):
            calls.append(date)
            if len(calls) < 3:
                raise TemporarySourceError('temporary error', 12)
            return quiz()
        result = crawl_today(collector=collector, sleeper=waits.append)
        self.assertEqual(result['date'], DATE)
        self.assertEqual(waits, [12, 30])
        self.assertEqual(len(calls), 3)

    def test_layout_errors_are_not_retried_in_a_tight_loop(self):
        def collector(date):
            raise CollectionError('layout changed')
        with self.assertRaises(CollectionError):
            crawl_today(collector=collector, sleeper=lambda seconds: self.fail('should not retry'))


class UpdateTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.data = Path(self.temporary.name)

    def test_update_archives_previous_and_new_quiz(self):
        atomic_write(self.data / 'today.json', EXAMPLE)
        result, changed = update_quiz(self.data, collector=quiz, date=DATE)
        self.assertTrue(changed)
        self.assertEqual(read_quiz(self.data / 'today.json'), result)
        self.assertEqual(read_quiz(self.data / 'archive' / '2026-09-30.json'), EXAMPLE)
        self.assertEqual(read_quiz(self.data / 'archive' / f'{DATE}.json'), result)

    def test_successful_rerun_does_not_crawl_or_rewrite_today(self):
        update_quiz(self.data, collector=quiz, date=DATE)
        before = (self.data / 'today.json').stat().st_mtime_ns
        _, changed = update_quiz(self.data, collector=lambda: self.fail('should not crawl'), date=DATE)
        self.assertFalse(changed)
        self.assertEqual((self.data / 'today.json').stat().st_mtime_ns, before)

    def test_invalid_or_failed_collection_preserves_the_previous_file(self):
        atomic_write(self.data / 'today.json', EXAMPLE)
        original = (self.data / 'today.json').read_bytes()
        invalid = quiz()
        invalid['rounds'].pop()
        with self.assertRaises(ValueError):
            update_quiz(self.data, collector=lambda: invalid, date=DATE)
        self.assertEqual((self.data / 'today.json').read_bytes(), original)
        def fail():
            raise TemporarySourceError('offline')
        with self.assertRaises(TemporarySourceError):
            update_quiz(self.data, collector=fail, date=DATE)
        self.assertEqual((self.data / 'today.json').read_bytes(), original)

    def test_interrupted_write_recovers_from_completed_archive(self):
        atomic_write(self.data / 'today.json', EXAMPLE)
        from ingestion.update_quiz import os
        real_replace = os.replace
        def interrupt(source, target):
            if Path(target).name == 'today.json':
                raise OSError('simulated interrupted replacement')
            real_replace(source, target)
        with patch('ingestion.update_quiz.os.replace', side_effect=interrupt):
            with self.assertRaises(OSError):
                update_quiz(self.data, collector=quiz, date=DATE)
        self.assertEqual(read_quiz(self.data / 'today.json'), EXAMPLE)
        result, changed = update_quiz(self.data, collector=lambda: self.fail('should recover without network'), date=DATE)
        self.assertTrue(changed)
        self.assertEqual(result['date'], DATE)
        self.assertEqual(list(self.data.glob('.quiz-*.tmp')), [])

    def test_yesterdays_source_quiz_cannot_be_relabeled_as_today(self):
        yesterday = quiz('2026-09-30', 99)
        atomic_write(self.data / 'today.json', yesterday)
        with self.assertRaises(CollectionError):
            update_quiz(self.data, collector=quiz, date=DATE)
        self.assertEqual(read_quiz(self.data / 'today.json'), yesterday)

    def test_corrupt_file_can_be_recovered_but_newer_quiz_cannot_be_overwritten(self):
        (self.data / 'today.json').write_text('{ broken', encoding='utf-8')
        update_quiz(self.data, collector=quiz, date=DATE)
        with self.assertRaises(CollectionError):
            update_quiz(self.data, collector=quiz, date='2026-09-30')


if __name__ == '__main__':
    unittest.main()
