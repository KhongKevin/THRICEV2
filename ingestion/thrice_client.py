"""Follow Thrice's public skip/reveal forms without a browser or stored login."""

import datetime as dt
import email.utils
import http.client
import http.cookiejar
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from dataclasses import dataclass
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

from .validate_quiz import validate

SOURCE_URL = "https://thrice.geekswhodrink.com/"
SOURCE_ZONE = ZoneInfo("America/New_York")
USER_AGENT = "ThirdTimeQuizImporter/1.0 (+https://github.com/KhongKevin/THRICEV2)"
MAX_RESPONSE_BYTES = 2_000_000


class CollectionError(Exception):
    """An unexpected page or unsafe/incomplete result; do not publish it."""


class TemporarySourceError(CollectionError):
    def __init__(self, message, retry_after=0):
        super().__init__(message)
        self.retry_after = retry_after


def source_date(now=None):
    return (now or dt.datetime.now(dt.timezone.utc)).astimezone(SOURCE_ZONE).date().isoformat()


def allowed_url(value):
    url = urllib.parse.urljoin(SOURCE_URL, value)
    parsed = urllib.parse.urlsplit(url)
    if (parsed.scheme != "https" or parsed.netloc != "thrice.geekswhodrink.com"
            or parsed.path not in ("/", "/user-guess", "/next", "/robots.txt", "/stats", "/stats/week")):
        raise CollectionError("The source returned an unexpected navigation URL.")
    return url


class SameSiteRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return super().redirect_request(request, fp, code, message, headers, allowed_url(new_url))


class Session:
    def __init__(self, delay=1.0):
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()), SameSiteRedirects()
        )
        self.delay = delay
        self.last_request = 0
        self.robots = None

    def request(self, path, fields=None):
        url = allowed_url(path)
        if self.robots and not self.robots.can_fetch(USER_AGENT, url):
            raise CollectionError("The source robots.txt does not allow this collector's request.")
        time.sleep(max(0, self.delay - (time.monotonic() - self.last_request)))
        self.last_request = time.monotonic()
        headers = {"User-Agent": USER_AGENT, "Accept": "text/html", "Cache-Control": "no-cache"}
        data = None
        if fields is not None:
            data = urllib.parse.urlencode(fields).encode("utf-8")
            headers.update({"Accept": "text/vnd.turbo-stream.html", "Origin": SOURCE_URL.rstrip("/"),
                            "Referer": SOURCE_URL, "Content-Type": "application/x-www-form-urlencoded"})
        try:
            with self.opener.open(urllib.request.Request(url, data=data, headers=headers), timeout=30) as response:
                allowed_url(response.url)
                body = response.read(MAX_RESPONSE_BYTES + 1)
                if len(body) > MAX_RESPONSE_BYTES:
                    raise CollectionError("Source response exceeded the size limit.")
                server_date = response.headers.get("Date")
                return body.decode("utf-8"), server_date
        except urllib.error.HTTPError as error:
            if error.code == 404 and urllib.parse.urlsplit(url).path == "/robots.txt":
                return "", None
            if error.code == 429 or error.code >= 500:
                retry_after = error.headers.get("Retry-After", "0")
                try:
                    retry_after = int(retry_after)
                except ValueError:
                    try:
                        retry_after = (email.utils.parsedate_to_datetime(retry_after)
                                       - dt.datetime.now(dt.timezone.utc)).total_seconds()
                    except (ValueError, TypeError):
                        retry_after = 0
                raise TemporarySourceError(f"Source returned HTTP {error.code}.", max(0, retry_after)) from error
            raise CollectionError(f"Source returned HTTP {error.code}; no access restrictions will be bypassed.") from error
        except (urllib.error.URLError, http.client.HTTPException, TimeoutError, ConnectionError, OSError) as error:
            raise TemporarySourceError(f"Source connection failed: {type(error).__name__}.") from error

    def check_robots(self):
        text, _ = self.request("/robots.txt")
        self.robots = urllib.robotparser.RobotFileParser()
        self.robots.parse(text.splitlines())
        self.delay = max(self.delay, self.robots.crawl_delay(USER_AGENT) or 0)


def page_document(html):
    document = BeautifulSoup(html, "html.parser")
    # Turbo responses contain inert <template> text; parse that content as a document.
    templates = document.select('turbo-stream[target="main"] > template')
    if templates:
        if len(templates) != 1:
            raise CollectionError("Expected exactly one main game update.")
        document = BeautifulSoup(templates[0].decode_contents(), "html.parser")
    main_frames = document.select('turbo-frame#main')
    if main_frames:
        if len(main_frames) != 1:
            raise CollectionError("Expected exactly one main game frame.")
        return main_frames[0]
    return document


def required(document, selector):
    elements = document.select(selector)
    if len(elements) != 1:
        raise CollectionError(f"Source layout changed: expected one {selector}.")
    return elements[0]


def clean_text(element):
    return " ".join(element.get_text(" ", strip=True).split())


def round_heading(document):
    heading = clean_text(required(document, ".question-heading"))
    match = re.fullmatch(r"Question\s+([1-5])", heading)
    if not match:
        raise CollectionError("Source round number was not between 1 and 5.")
    category = clean_text(required(document, ".orange-bar"))
    if not category.startswith("Category:"):
        raise CollectionError("Source category is missing.")
    return int(match[1]), category.removeprefix("Category:").strip()


@dataclass
class Clue:
    round_number: int
    category: str
    question_id: str
    clue_number: int
    question: str
    action: str
    fields: dict


def parse_clue(html):
    document = page_document(html)
    round_number, category = round_heading(document)
    form = required(document, 'form[data-skip-preloader-target="skipForm"]')
    if form.get("method", "").lower() != "post":
        raise CollectionError("Source skip form no longer uses POST.")
    action = allowed_url(form.get("action", ""))
    if urllib.parse.urlsplit(action).path != "/user-guess":
        raise CollectionError("Source skip form changed destination.")
    fields = {field["name"]: field.get("value", "") for field in form.select('input[type="hidden"][name]')}
    if not all(fields.get(key) for key in ("authenticity_token", "current_question", "current_clue")):
        raise CollectionError("Source skip form is incomplete.")
    if not fields["current_question"].isdigit() or fields["current_clue"] not in ("1", "2", "3"):
        raise CollectionError("Source question/clue identifiers are invalid.")
    clue_number = int(fields["current_clue"])
    question = clean_text(required(document, ".clue-text"))
    points = re.search(r"\bFor\s+([1-3])\s+points?\b", clean_text(required(document, ".card-body")))
    if not question or not category or not points or int(points[1]) != 4 - clue_number:
        raise CollectionError("Source clue text, category or point value is invalid.")
    return Clue(round_number, category, fields["current_question"], clue_number, question, action, fields)


def parse_reveal(html, expected_round, category):
    document = page_document(html)
    if round_heading(document) != (expected_round, category):
        raise CollectionError("Source reveal belongs to a different round.")
    content = required(document, ".clue-text")
    if "The answer is" not in clean_text(content):
        raise CollectionError("Source did not reveal the answer.")
    answer = clean_text(required(content, "span.font-bold"))
    if not answer:
        raise CollectionError("Source revealed an empty answer.")
    link = required(document, 'a[href^="/next?"]')
    next_url = allowed_url(link["href"])
    quiz_ids = urllib.parse.parse_qs(urllib.parse.urlsplit(next_url).query).get("dqs_id", [])
    if len(quiz_ids) != 1 or not quiz_ids[0].isdigit():
        raise CollectionError("Source daily quiz identifier is missing.")
    return answer, next_url, quiz_ids[0]


def parse_results(html, rounds):
    document = page_document(html)
    share = required(document, "[data-mobile-share-text]")
    match = re.search(r"Thrice Game #(\d+)", share["data-mobile-share-text"])
    if not match or clean_text(required(document, ".orange-bar")) != "Results":
        raise CollectionError("Source did not reach the daily results screen.")
    text = clean_text(document)
    for item in rounds:
        if item["answer"] not in text or any(clue["question"] not in text for clue in item["clues"]):
            raise CollectionError("Source recap did not confirm all collected clues and answers.")
    return int(match[1])


def check_response_date(server_date, expected_date):
    try:
        actual = source_date(email.utils.parsedate_to_datetime(server_date))
    except (ValueError, TypeError):
        raise CollectionError("Source did not provide a valid response date.") from None
    if actual != expected_date:
        raise TemporarySourceError("The source day changed or its response date is stale; starting over is required.")


def crawl_once(expected_date, session=None):
    session = session or Session()
    session.check_robots()

    def request(path, fields=None):
        html, server_date = session.request(path, fields)
        check_response_date(server_date, expected_date)
        return html

    html = request(SOURCE_URL)
    rounds = []
    daily_id = None
    for round_number in range(1, 6):
        clues = []
        first = None
        for clue_number in range(1, 4):
            clue = parse_clue(html)
            if (clue.round_number, clue.clue_number) != (round_number, clue_number):
                raise CollectionError("Source skipped or repeated a round/clue.")
            if first and (clue.question_id, clue.category) != (first.question_id, first.category):
                raise CollectionError("The source question changed midway through a round.")
            first = first or clue
            clues.append({"points": 4 - clue_number, "question": clue.question})
            html = request(clue.action, clue.fields)
        answer, next_url, quiz_id = parse_reveal(html, round_number, first.category)
        if daily_id is not None and daily_id != quiz_id:
            raise CollectionError("The source daily quiz changed during collection.")
        daily_id = quiz_id
        rounds.append({"id": int(first.question_id), "category": first.category,
                       "answer": answer, "aliases": [], "clues": clues})
        print(f"Validated source round {round_number}/5.", flush=True)
        html = request(next_url)
    quiz_number = parse_results(html, rounds)
    quiz = {
        "date": expected_date, "title": "Today's Trivia", "rounds": rounds,
        "source": {"name": "Thrice by Geeks Who Drink", "url": SOURCE_URL,
                   "quizNumber": quiz_number, "dailyId": daily_id,
                   "retrievedAt": dt.datetime.now(dt.timezone.utc).isoformat()},
    }
    validate(quiz)
    return quiz


def crawl_today(attempts=3, collector=crawl_once, sleeper=time.sleep):
    for attempt in range(1, attempts + 1):
        try:
            print(f"Collecting Thrice ({source_date()}), attempt {attempt}/{attempts}.", flush=True)
            return collector(source_date())
        except TemporarySourceError as error:
            if attempt == attempts or error.retry_after > 180:
                raise
            delay = max(10 * 3 ** (attempt - 1), error.retry_after)
            print(f"{error} Retrying with a fresh session in {delay:g}s.", flush=True)
            sleeper(delay)
    raise CollectionError("Collection did not complete.")
