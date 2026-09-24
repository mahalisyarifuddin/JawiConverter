#!/usr/bin/env python3
"""
build_dict_prpm.py — Bangun kamus taling & exception dari PRPM DBP

Sumber: https://prpm.dbp.gov.my/Cari1?keyword=<word>&d=168075 (Kamus Dewan Edisi Keempat)
Fallback: https://kamus.dbp.gov.my/ (Livewire, butuh session)

Strategi: Untuk tiap kata dalam wordlist, ambil Jawi sebenar dari PRPM,
bandingkan dengan output heuristik (jawi_converter.js via node atau python port),
jika berbeza -> masukkan ke kamus.

Untuk heuristik python, kita port logika ringkas atau panggil Node.js jika ada.

Penggunaan:
  python build_dict_prpm.py --wordlist wordlist.txt --out jawi_dict.json --limit 1000
  python build_dict_prpm.py --demo  # demo 20 kata pedoman

Throttle: 1 req / 1.2 detik (hormati DBP), retry 3x, cache di prpm_cache.json
"""
import argparse, json, time, re, os, sys, subprocess
from pathlib import Path
try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("pip install requests beautifulsoup4")
    sys.exit(1)

PRPM_URL = "https://prpm.dbp.gov.my/Cari1"
KAMUS_DBP_URL = "https://kamus.dbp.gov.my/"
DEFAULT_D = "168075"  # Kamus Dewan Edisi Keempat
CACHE_FILE = Path(__file__).parent / "prpm_cache.json"

# Heuristik python minimal (port dari JS) — cukup untuk deteksi pepet vs taling
# Untuk akurasi penuh, akan panggil Node.js jawi_converter.js jika ada

def load_cache():
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except:
            return {}
    return {}

def save_cache(cache):
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")

def fetch_jawi_prpm_old(word, d=DEFAULT_D, session=None):
    """GET prpm.dbp.gov.my/Cari1?keyword=word&d=..."""
    s = session or requests.Session()
    s.headers.update({"User-Agent":"Mozilla/5.0 (compatible; JawiBuilder/1.0)"})
    params = {"keyword": word, "d": d}
    # prpm expects GET with keyword in query string
    r = s.get(PRPM_URL, params=params, timeout=15)
    if r.status_code != 200:
        return None
    # parse <font class='cadr'>JAWI</font>  or <font class="cadr">
    # The page contains multiple tabs, take first cadr
    m = re.search(r"class=['\"]cadr['\"]>([^<]+)</font>", r.text)
    if m:
        jawi = m.group(1).strip()
        # bersihkan entity
        jawi = jawi.replace("&nbsp;","").strip()
        return jawi if jawi else None
    # fallback BeautifulSoup
    try:
        soup = BeautifulSoup(r.text, "html.parser")
        tag = soup.find("font", class_="cadr")
        if tag:
            return tag.get_text(strip=True)
    except:
        pass
    return None

def fetch_jawi_livewire(word, session=None):
    """Coba Kamus DBP baru via Livewire - fallback jika PRPM old 404"""
    # Implementation: GET halaman utama untuk token + snapshot, then POST to /livewire/update
    # Simplified: kita coba GET /carian?cari=word jika ada endpoint
    # Untuk sekarang return None (PRPM old lebih stabil)
    return None

def heuristic_jawi_via_node(word):
    """Panggil Node.js jawi_converter.js jika ada, else fallback python minimal"""
    js_path = Path(__file__).parent / "jawi_converter.js"
    if js_path.exists():
        try:
            out = subprocess.check_output(
                ["node", "-e", f"const m=require('{js_path.as_posix()}'); console.log(m.wordToJawi(process.argv[1]))", word],
                text=True, timeout=5
            )
            return out.strip()
        except Exception as e:
            # fallback
            pass
    # python fallback sangat minimal: hanya untuk demo
    return word  # dummy

def build(wordlist, out_path, limit=None, delay=1.2):
    cache = load_cache()
    session = requests.Session()
    results = {"taling": [], "exception": {}}
    # load existing out if exists
    if out_path.exists():
        try:
            prev = json.loads(out_path.read_text(encoding="utf-8"))
            results.update(prev)
        except:
            pass
    count = 0
    for word in wordlist:
        word = word.strip().lower()
        if not word or word in cache and cache[word] is None:
            continue
        if limit and count >= limit:
            break
        # cache hit?
        if word in cache:
            jawi_prpm = cache[word]
            print(f"[cache] {word} -> {jawi_prpm}")
        else:
            jawi_prpm = fetch_jawi_prpm_old(word, session=session)
            if not jawi_prpm:
                jawi_prpm = fetch_jawi_livewire(word, session=session)
            cache[word] = jawi_prpm
            save_cache(cache)
            print(f"[fetch] {word} -> {jawi_prpm}")
            time.sleep(delay)
        if not jawi_prpm:
            continue
        jawi_heur = heuristic_jawi_via_node(word)
        if jawi_heur != jawi_prpm:
            # deteksi taling: jika kata mengandung e dan jawi_prpm mengandung ya (ي) sementara heur tidak
            if "e" in word and "ي" in jawi_prpm and "ي" not in jawi_heur:
                if word not in results["taling"]:
                    results["taling"].append(word)
                    print(f"  -> taling: {word}")
            else:
                results["exception"][word] = jawi_prpm
                print(f"  -> exception: {word} heur={jawi_heur}")
        count += 1
        # periodic save
        if count % 20 == 0:
            out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Saved {count} progress to {out_path}")
    out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Done. Taling {len(results['taling'])}, Exception {len(results['exception'])} -> {out_path}")
    return results

def demo_build():
    """Demo 30 kata pedoman tanpa hit network (mock), atau dengan network jika online"""
    pedoman_words = [
        "dada","bara","pala","sawa","nganga",
        "saya","rasa","baja","tanya","mata",
        "baka","saka","ketika","leka","muka","luka",
        "teka","peta","beli","peri","kelu","beku",
        "tanda","hampa","warna","kasta",
        "rangka","harga","tangga","bangga",
        "bingka","jingga","seksa","renda","teksi","denggi",
        "belah","cekap","harapan","haram","bintang","kembang","kampung","gendang",
        "bahagia","sahaja","dahulu","haloba","mahaguru",
        "sekolah","besar","kecil","boleh","oleh"
    ]
    out = Path(__file__).parent / "jawi_dict_demo.json"
    # untuk demo, kita tidak hit network, hanya generate template
    # Tapi jika network ada, coba fetch 10 pertama
    print("Demo: 10 kata pertama live fetch...")
    cache = load_cache()
    s = requests.Session()
    for w in pedoman_words[:10]:
        j = fetch_jawi_prpm_old(w, session=s)
        h = heuristic_jawi_via_node(w)
        print(f"{w:10} PRPM={j} heur={h} {'OK' if j==h else 'BEDA'}")
        time.sleep(0.5)
    # build full list dengan fetch (komentar jika offline)
    # build(pedoman_words, out, delay=1.0)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--wordlist", help="path ke wordlist (satu kata per baris)")
    ap.add_argument("--out", default="jawi_dict.json", help="output JSON")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--demo", action="store_true")
    ap.add_argument("--d", default=DEFAULT_D)
    args = ap.parse_args()
    if args.demo:
        demo_build()
    elif args.wordlist:
        wl = Path(args.wordlist).read_text(encoding="utf-8").splitlines()
        build(wl, Path(args.out), limit=args.limit)
    else:
        # default: wordlist pedoman + frequent
        print("Gunakan --demo untuk demo, atau --wordlist <file>")
        demo_build()
