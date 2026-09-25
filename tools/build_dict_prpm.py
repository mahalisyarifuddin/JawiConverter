#!/usr/bin/env python3
"""
build_dict_prpm.py — Bangun kamus taling dan pengecualian daripada PRPM DBP.

Sumber utama:
  https://prpm.dbp.gov.my/Cari1?keyword=<word>&d=168075

Strategi:
  1. Sahkan sambungan dengan satu carian kawalan sebelum binaan bermula.
  2. Ambil ejaan Jawi PRPM untuk kata yang belum ada dalam cache.
  3. Bandingkan ejaan itu dengan enjin aturan yang disalin sementara daripada
     JawiConverter.html.
  4. Simpan cache secara atomik selepas setiap respons yang sah.

Contoh:
  python tools/build_dict_prpm.py --check-connection
  python tools/build_dict_prpm.py --wordlist tools/10000.txt \
      --out /tmp/jawi_dict.json --only-missing --limit 100 --delay 2.0
  python tools/build_dict_prpm.py --ingest-markdown WORD FILE

Kesantunan pelayan:
  - sela minimum keras 1.5 saat antara permulaan permintaan;
  - sela lalai 2.0 saat;
  - tiga percubaan dengan backoff untuk kegagalan sementara;
  - kegagalan rangkaian tidak pernah dicache sebagai hasil kosong.
"""

import argparse
import html
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Pasang kebergantungan: pip install requests beautifulsoup4", file=sys.stderr)
    sys.exit(1)

PRPM_URL = "https://prpm.dbp.gov.my/Cari1"
DEFAULT_D = "168075"  # Kamus Dewan Edisi Keempat
CACHE_FILE = Path(__file__).parent / "prpm_cache.json"
DEFAULT_DELAY = 2.0
MIN_DELAY = 1.5
DEFAULT_RETRIES = 3
CONTROL_WORD = "dada"
CONTROL_JAWI = "دادا"
ARABIC_RE = re.compile(r"[\u0600-\u06ff\u0750-\u077f]")
MARKDOWN_JAWI_RE = re.compile(
    r"\\\[.*?\\\]\s*\\?\|\s*"
    r"([\u0600-\u06ff\u0750-\u077f](?:[\u0600-\u06ff\u0750-\u077f \-]*[\u0600-\u06ff\u0750-\u077f])?)"
)
NOT_FOUND_RE = re.compile(r"Carian kata tiada di dalam kamus", re.I)
# Malay dictionary tokens only: letters, optional hyphenation, at least 2 chars.
# tools/10000.txt also contains frequencies, punctuation, and single letters.
WORD_RE = re.compile(r"^[a-z]+(?:-[a-z]+)*$")


class FetchError(RuntimeError):
    """Kegagalan sambungan/HTTP yang tidak patut dimasukkan ke cache."""


class RateLimiter:
    """Pastikan permintaan tidak bermula terlalu rapat antara satu sama lain."""

    def __init__(self, delay=DEFAULT_DELAY):
        if delay < MIN_DELAY:
            raise ValueError(
                f"Sela {delay:.2f}s terlalu singkat; minimum ialah {MIN_DELAY:.1f}s."
            )
        self.delay = delay
        self.last_started = None

    def wait(self):
        now = time.monotonic()
        if self.last_started is not None:
            remaining = self.delay - (now - self.last_started)
            if remaining > 0:
                time.sleep(remaining)
        self.last_started = time.monotonic()


def new_session():
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (compatible; JawiConverterCacheBuilder/1.0; "
                "+https://github.com/mahalisyarifuddin/JawiConverter)"
            ),
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "ms,en;q=0.8",
        }
    )
    return session


def normalize_wordlist_entry(raw_word):
    """Ambil token kata daripada baris senarai, termasuk format 'kata kekerapan'."""
    raw_word = raw_word.strip().lower()
    if not raw_word:
        return ""
    return raw_word.split()[0]


def is_fetchable_word(word):
    """Elakkan permintaan PRPM untuk tanda baca, nombor, atau huruf tunggal."""
    return bool(word) and len(word) >= 2 and WORD_RE.fullmatch(word)


def load_cache():
    if not CACHE_FILE.exists():
        return {}
    try:
        value = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Cache PRPM tidak dapat dibaca: {error}") from error
    if not isinstance(value, dict):
        raise RuntimeError("Cache PRPM mesti berupa objek JSON.")
    return value


def save_cache(cache):
    """Tulis secara atomik supaya gangguan tidak merosakkan cache yang sedia ada."""
    temp = CACHE_FILE.with_name(f".{CACHE_FILE.name}.tmp-{os.getpid()}")
    temp.write_text(
        json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    os.replace(temp, CACHE_FILE)


def parse_prpm_jawi(page):
    # Susun atur lama menggunakan <font class="cadr"> untuk ejaan Jawi.
    match = re.search(
        r"<font\b[^>]*\bclass=['\"][^'\"]*\bcadr\b[^'\"]*['\"][^>]*>"
        r"\s*([^<]+?)\s*</font>",
        page,
        flags=re.IGNORECASE,
    )
    if match:
        jawi = html.unescape(match.group(1)).replace("\xa0", "").strip()
        if jawi and ARABIC_RE.search(jawi):
            return jawi

    # Fallback untuk variasi kecil pada susun atur HTML.
    soup = BeautifulSoup(page, "html.parser")
    tag = soup.find("font", class_=lambda value: value and "cadr" in value.split())
    if tag:
        jawi = tag.get_text(strip=True)
        if jawi and ARABIC_RE.search(jawi):
            return jawi
    return None


def parse_prpm_jawi_markdown(page):
    """Ambil ejaan Jawi daripada rumusan markdown halaman PRPM."""
    section = page
    for marker in (
        "### Juga ditemukan",
        "**Tiada maklumat tesaurus",
        "| Tesaurus |",
    ):
        index = page.find(marker)
        if index != -1:
            section = page[:index]
            break
    match = MARKDOWN_JAWI_RE.search(section)
    if match:
        jawi = match.group(1).strip()
        if jawi and ARABIC_RE.search(jawi):
            return jawi
    if NOT_FOUND_RE.search(section):
        return None
    return None


def parse_prpm_page(page):
    """Cuba HTML dahulu, kemudian rumusan markdown."""
    jawi = parse_prpm_jawi(page)
    if jawi:
        return jawi
    return parse_prpm_jawi_markdown(page)


def ingest_markdown_file(word, path, cache=None):
    """Masukkan satu halaman PRPM ke cache tanpa permintaan rangkaian baharu."""
    word = normalize_wordlist_entry(word)
    if not is_fetchable_word(word):
        raise ValueError(f"Token bukan kata kamus: {word!r}")
    page = Path(path).read_text(encoding="utf-8")
    jawi = parse_prpm_page(page)
    cache = load_cache() if cache is None else cache
    cache[word] = jawi
    save_cache(cache)
    print(f"[ingest] {word} -> {jawi}")
    return jawi


def fetch_jawi_prpm_old(
    word,
    d=DEFAULT_D,
    session=None,
    limiter=None,
    retries=DEFAULT_RETRIES,
    timeout=20,
):
    """Ambil satu ejaan PRPM tanpa mencache kegagalan rangkaian sementara."""
    session = session or new_session()
    limiter = limiter or RateLimiter()
    params = {"keyword": word, "d": d}
    last_error = None

    for attempt in range(1, retries + 1):
        limiter.wait()
        try:
            response = session.get(PRPM_URL, params=params, timeout=timeout)
        except requests.RequestException as error:
            last_error = f"{type(error).__name__}: {error}"
        else:
            if response.status_code == 200:
                return parse_prpm_jawi(response.text)
            last_error = f"HTTP {response.status_code}"
            # 4xx selain had kadar bukan kegagalan sementara.
            if 400 <= response.status_code < 500 and response.status_code != 429:
                break

        if attempt < retries:
            backoff = max(limiter.delay, limiter.delay * (2 ** (attempt - 1)))
            print(
                f"[retry {attempt}/{retries}] {word}: {last_error}; "
                f"tunggu {backoff:.1f}s",
                file=sys.stderr,
            )
            time.sleep(backoff)

    raise FetchError(
        f"PRPM tidak dapat dicapai untuk '{word}' selepas {retries} percubaan: "
        f"{last_error}"
    )


def check_connection(session, limiter, d=DEFAULT_D, retries=DEFAULT_RETRIES):
    """Sahkan DNS/TLS/HTTP/parsing dengan kata kawalan yang stabil."""
    jawi = fetch_jawi_prpm_old(
        CONTROL_WORD,
        d=d,
        session=session,
        limiter=limiter,
        retries=retries,
    )
    if jawi != CONTROL_JAWI:
        raise FetchError(
            "PRPM menjawab tetapi semakan kawalan gagal: "
            f"{CONTROL_WORD!r} sepatutnya {CONTROL_JAWI!r}, diterima {jawi!r}."
        )
    print(f"[connection] PRPM OK: {CONTROL_WORD} -> {jawi}")
    return True


def heuristic_jawi_via_node(word):
    """Jalankan enjin aturan sahaja daripada salinan sementara aplikasi HTML."""
    helper = Path(__file__).parent / "app_engine.js"
    script = (
        f"const a=require({json.dumps(helper.as_posix())});"
        "const m=a.loadEngine({ruleOnly:true});"
        "console.log(m.wordToJawi(process.argv[1]));"
    )
    try:
        # Kata dihantar sebagai argv, bukan disisipkan ke dalam kod JavaScript.
        output = subprocess.check_output(
            ["node", "-e", script, word], text=True, timeout=5
        )
    except (OSError, subprocess.SubprocessError) as error:
        raise RuntimeError(f"Enjin Node gagal untuk {word!r}: {error}") from error
    return output.strip()


def build(
    wordlist,
    out_path,
    limit=None,
    delay=DEFAULT_DELAY,
    retries=DEFAULT_RETRIES,
    d=DEFAULT_D,
    only_missing=False,
):
    cache = load_cache()
    initial_size = len(cache)
    session = new_session()
    limiter = RateLimiter(delay)
    results = {"taling": [], "exception": {}}

    if out_path.exists():
        try:
            previous = json.loads(out_path.read_text(encoding="utf-8"))
            if isinstance(previous, dict):
                results.update(previous)
        except (OSError, json.JSONDecodeError):
            pass

    check_connection(session, limiter, d=d, retries=retries)

    fetched = 0
    usable = 0
    seen = set()
    try:
        for raw_word in wordlist:
            word = normalize_wordlist_entry(raw_word)
            if not word or word in seen:
                continue
            seen.add(word)
            if not is_fetchable_word(word):
                continue

            if word in cache:
                if only_missing:
                    continue
                jawi_prpm = cache[word]
                print(f"[cache] {word} -> {jawi_prpm}")
            else:
                if limit is not None and fetched >= limit:
                    break
                jawi_prpm = fetch_jawi_prpm_old(
                    word,
                    d=d,
                    session=session,
                    limiter=limiter,
                    retries=retries,
                )
                # A 200 response with no Jawi is a valid negative result. Network
                # and HTTP failures raise FetchError before this assignment.
                cache[word] = jawi_prpm
                save_cache(cache)
                fetched += 1
                print(f"[fetch {fetched}] {word} -> {jawi_prpm}")

            if not jawi_prpm:
                continue
            usable += 1
            jawi_heuristic = heuristic_jawi_via_node(word)
            if jawi_heuristic != jawi_prpm:
                if (
                    "e" in word
                    and "ي" in jawi_prpm
                    and "ي" not in jawi_heuristic
                ):
                    if word not in results["taling"]:
                        results["taling"].append(word)
                        print(f"  -> taling: {word}")
                else:
                    results["exception"][word] = jawi_prpm
                    print(
                        f"  -> exception: {word} "
                        f"heur={jawi_heuristic}"
                    )

            if fetched and fetched % 20 == 0:
                out_path.write_text(
                    json.dumps(results, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8",
                )
                print(f"Saved {fetched} network fetches to {out_path}")
    finally:
        out_path.write_text(
            json.dumps(results, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    print(
        f"Done. Cache {initial_size} -> {len(cache)}; fetched {fetched}; "
        f"usable {usable}; taling {len(results['taling'])}; "
        f"exceptions {len(results['exception'])} -> {out_path}"
    )
    return results


def demo_build(delay=DEFAULT_DELAY, retries=DEFAULT_RETRIES, d=DEFAULT_D):
    words = ["dada", "bara", "pala", "sawa", "nganga"]
    session = new_session()
    limiter = RateLimiter(delay)
    check_connection(session, limiter, d=d, retries=retries)
    for word in words:
        jawi = fetch_jawi_prpm_old(
            word, d=d, session=session, limiter=limiter, retries=retries
        )
        heuristic = heuristic_jawi_via_node(word)
        print(
            f"{word:10} PRPM={jawi} heur={heuristic} "
            f"{'OK' if jawi == heuristic else 'BERBEZA'}"
        )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--wordlist", help="fail senarai kata, satu kata setiap baris")
    parser.add_argument("--out", default="jawi_dict.json", help="output analisis JSON")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="bilangan maksimum permintaan untuk kata yang belum dicache",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY,
        help=f"sela permintaan dalam saat (minimum {MIN_DELAY}, lalai {DEFAULT_DELAY})",
    )
    parser.add_argument("--retries", type=int, default=DEFAULT_RETRIES)
    parser.add_argument("--d", default=DEFAULT_D)
    parser.add_argument(
        "--only-missing",
        action="store_true",
        help="langkau semua kunci yang sudah ada, termasuk hasil null",
    )
    parser.add_argument("--check-connection", action="store_true")
    parser.add_argument("--demo", action="store_true")
    parser.add_argument(
        "--ingest-markdown",
        nargs=2,
        metavar=("WORD", "FILE"),
        help="masukkan satu halaman markdown PRPM ke cache tanpa permintaan baharu",
    )
    parser.add_argument(
        "--ingest-dir",
        help="masukkan setiap fail .md dalam direktori (nama fail = kata)",
    )
    args = parser.parse_args()

    if args.retries < 1:
        parser.error("--retries mesti sekurang-kurangnya 1")
    if args.delay < MIN_DELAY:
        parser.error(f"--delay mesti sekurang-kurangnya {MIN_DELAY} saat")
    if args.limit is not None and args.limit < 1:
        parser.error("--limit mesti sekurang-kurangnya 1")

    try:
        if args.check_connection:
            check_connection(
                new_session(), RateLimiter(args.delay), d=args.d, retries=args.retries
            )
        elif args.demo:
            demo_build(delay=args.delay, retries=args.retries, d=args.d)
        elif args.wordlist:
            words = Path(args.wordlist).read_text(encoding="utf-8").splitlines()
            build(
                words,
                Path(args.out),
                limit=args.limit,
                delay=args.delay,
                retries=args.retries,
                d=args.d,
                only_missing=args.only_missing,
            )
        elif args.ingest_markdown:
            ingest_markdown_file(args.ingest_markdown[0], args.ingest_markdown[1])
        elif args.ingest_dir:
            directory = Path(args.ingest_dir)
            if not directory.is_dir():
                raise RuntimeError(f"Direktori ingest tidak wujud: {directory}")
            cache = load_cache()
            ingested = 0
            for path in sorted(directory.glob("*.md")):
                ingest_markdown_file(path.stem, path, cache=cache)
                ingested += 1
            print(f"Ingest {ingested} halaman; cache {len(cache)}")
        else:
            parser.error(
                "gunakan --check-connection, --demo, --wordlist, "
                "--ingest-markdown, atau --ingest-dir"
            )
    except (FetchError, RuntimeError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
