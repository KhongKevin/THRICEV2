import datetime as dt
import json
from pathlib import Path
import tempfile
import unittest

from ingestion.thrice_client import CollectionError, TemporarySourceError
from ingestion.update_quiz import atomic_write
from ingestion.update_stats import collect_stats, noon_reached, parse_stats, update_stats

DATE = '2026-10-01'
NOON = dt.datetime(2026, 10, 1, 17, tzinfo=dt.timezone.utc)
EXAMPLE = json.loads((Path(__file__).resolve().parents[1] / 'example_quiz.json').read_text(encoding='utf-8'))


def chart(values='[8, 9, 10, 11, 9.47]', sunday='2026-09-27'):
    return f'''<div data-controller="stats-chart" data-sunday="{sunday}"
      data-user-stats="[15,15,15,15,15]" data-global-stats="{values}"></div>'''


class StatsTests(unittest.TestCase):
    def test_chart_uses_the_correct_date_and_global_not_personal_average(self):
        self.assertEqual(parse_stats(chart(), DATE), 9.47)
        self.assertEqual(parse_stats(chart(), '2026-09-27'), 8)
        self.assertEqual(parse_stats(chart('[0,0,0,0,0]'), DATE), 0)

    def test_missing_stale_and_invalid_source_stats_fail_closed(self):
        for content in [chart('[8,9]'), chart('[8,9,10,11,null]'), chart('[8,9,10,11,16]'),
                        chart('[8,9,10,11,true]'), chart(sunday='2026-09-20'), '<html>Unavailable</html>']:
            with self.assertRaises(CollectionError):
                parse_stats(content, DATE)

    def test_noon_clock_follows_central_daylight_saving(self):
        self.assertFalse(noon_reached(DATE, NOON - dt.timedelta(seconds=1)))
        self.assertTrue(noon_reached(DATE, NOON))
        self.assertFalse(noon_reached('2026-12-01', dt.datetime(2026, 12, 1, 17, 59, tzinfo=dt.timezone.utc)))
        self.assertTrue(noon_reached('2026-12-01', dt.datetime(2026, 12, 1, 18, tzinfo=dt.timezone.utc)))

    def test_optional_snapshot_skips_early_runs_and_is_idempotent_after_noon(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            quiz = {**EXAMPLE, 'date': DATE}
            atomic_write(root / 'today.json', quiz)
            original = (root / 'today.json').read_bytes()
            self.assertFalse(update_stats(root, NOON - dt.timedelta(seconds=1), collector=lambda date: self.fail('too early')))
            self.assertFalse((root / 'stats.json').exists())
            self.assertTrue(update_stats(root, NOON, collector=lambda date: 9.47))
            saved = json.loads((root / 'stats.json').read_text())
            self.assertEqual(saved['averageScore'], 9.47)
            self.assertEqual(saved['date'], DATE)
            self.assertTrue((root / 'stats-archive' / f'{DATE}.json').exists())
            self.assertFalse(update_stats(root, NOON, collector=lambda date: self.fail('already saved')))
            self.assertEqual((root / 'today.json').read_bytes(), original)

    def test_failed_stats_request_preserves_quiz_and_existing_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            atomic_write(root / 'today.json', {**EXAMPLE, 'date': DATE})
            atomic_write(root / 'stats.json', {'status': 'pending'})
            before = {file.name: file.read_bytes() for file in root.glob('*.json')}
            def fail(date):
                raise TemporarySourceError('offline')
            with self.assertRaises(TemporarySourceError):
                update_stats(root, NOON, collector=fail)
            self.assertEqual({file.name: file.read_bytes() for file in root.glob('*.json')}, before)

    def test_network_retries_use_fresh_sessions(self):
        calls, waits = [], []
        class FakeSession:
            def check_robots(self): pass
            def request(self, path):
                calls.append(path)
                if len(calls) == 1: raise TemporarySourceError('offline', 12)
                return chart(), 'Thu, 01 Oct 2026 17:00:00 GMT'
        self.assertEqual(collect_stats(DATE, session_factory=FakeSession, sleeper=waits.append), 9.47)
        self.assertEqual(waits, [12])
        self.assertEqual(calls, ['/stats/week?week=2026-09-27', '/stats/week?week=2026-09-27'])

    def test_sunday_fetches_the_new_week_instead_of_yesterdays_week(self):
        calls = []
        class FakeSession:
            def check_robots(self): pass
            def request(self, path):
                calls.append(path)
                return chart('[7.5]', sunday='2026-10-04'), 'Sun, 04 Oct 2026 17:00:00 GMT'
        self.assertEqual(collect_stats('2026-10-04', session_factory=FakeSession), 7.5)
        self.assertEqual(calls, ['/stats/week?week=2026-10-04'])


if __name__ == '__main__':
    unittest.main()
