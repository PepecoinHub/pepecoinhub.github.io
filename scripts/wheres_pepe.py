"""Pepe Guesser robot: prepares daily puzzles for the PondOS game, a week ahead.

For each new puzzle it
  1. picks a well-known, "point-like" place from Wikidata (a bridge, tower, castle, square, waterfall…; no walls,
     rivers, mountain ranges or deserts, which are too big to score fairly), at a random level of fame;
  2. takes the place's photo from Wikimedia Commons, only under a free licence (public domain, CC0, CC BY, CC BY-SA);
  3. crops it a little, adds one of the Pepe traveller poses (scripts/wp/poses), drops all metadata (EXIF/GPS)
     and saves it as WebP;
  4. sends it, with the answer, to Supabase through gry_wp_robot_add. That function accepts only the robot token
     (GitHub secret WP_ROBOT_TOKEN); nothing about the puzzle is written to this public repository.
The host approves or rejects each puzzle in the game window before it can go live.

Run: WP_ROBOT_TOKEN=… python scripts/wheres_pepe.py    (options: --dry-run DIR to only save pictures locally)
"""
import base64
import io
import json
import pathlib
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
POSES = ROOT / "scripts" / "wp" / "poses"
UA = "PepecoinHubWheresPepe/1.0 (https://pepecoinhub.com/meme/; game puzzles from Wikidata/Commons)"
TARGET_READY = 10          # keep this many puzzles waiting (pending + approved, not yet live)
MAX_NEW_PER_RUN = 5
OUT_W = 1200

# point-like kinds of places (Wikidata classes): one photo spot is within a few km of the item's coordinates
CLASSES = {
    "Q12280": "bridge", "Q12518": "tower", "Q16970": "church building", "Q2977": "cathedral", "Q32815": "mosque",
    "Q44539": "temple", "Q23413": "castle", "Q16560": "palace", "Q4989906": "monument", "Q179700": "statue",
    "Q34038": "waterfall", "Q174782": "square", "Q33506": "museum", "Q11303": "skyscraper", "Q39715": "lighthouse",
    "Q839954": "archaeological site", "Q57821": "fortification", "Q1440300": "observation tower", "Q24398318": "religious building",
    "Q483453": "fountain", "Q1081138": "historic site", "Q12570": "suspension bridge", "Q15243209": "historic district",
}
BANDS = [(120, 100000), (60, 119), (30, 59)]   # sitelinks: famous / known / harder; one band is drawn at random

# pose file -> which way Pepe faces ("left" means he stands on the right side, looking into the picture)
FACES = {"juicebox": "left", "brb": "left", "chonky": "left", "comfy": "left", "explorer": "left", "backpack": "left"}
# poses cut off at the chest: they stand on the bottom edge of the photo, without a shadow
BUSTS = {"explorer"}
# the balloons take most of that picture: it gets more height, so Pepe himself is not tiny
TALL = {"balloons": (0.66, 0.78), "explorer": (0.42, 0.5)}

FREE_LICENCE = re.compile(r"^(cc0|public domain|pd|cc by(-sa)? \d\.\d|cc by(-sa)?( \d\.\d)?)", re.I)


def http(url, data=None, headers=None, timeout=60):
    h = {"User-Agent": UA}
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def supabase_conf():
    js = (ROOT / "docs" / "games" / "js" / "config.js").read_text()
    url = re.search(r"supabaseUrl:\s*'([^']+)'", js).group(1)
    key = re.search(r"supabaseKey:\s*'([^']+)'", js).group(1)
    return url, key


def rpc(name, args):
    url, key = supabase_conf()
    body = json.dumps(args).encode()
    raw = http(f"{url}/rest/v1/rpc/{name}", body, {"apikey": key, "Content-Type": "application/json"})
    return json.loads(raw or b"null")


SPARQL_ENDPOINTS = [
    ("wikidata", "https://query.wikidata.org/sparql?format=json&query="),
    ("qlever", "https://qlever.cs.uni-freiburg.de/api/wikidata?query="),   # a fast public Wikidata mirror, as a backup
]


def sparql(q):
    """Run a query on Wikidata's endpoint, or on the backup when that one fails."""
    last = None
    for name, base in SPARQL_ENDPOINTS:
        try:
            raw = http(base + urllib.parse.quote(q), headers={"Accept": "application/sparql-results+json"}, timeout=70)
            return json.loads(raw)["results"]["bindings"]
        except urllib.error.HTTPError as e:
            last = f"{name}: HTTP {e.code}"
        except Exception as e:
            last = f"{name}: {type(e).__name__}"
        print("  query failed on", last, flush=True)
    raise RuntimeError(last)


def candidates(band, cls):
    """Places of one kind (a Wikidata class) at one level of fame: only ids, coordinates and the photo.
    No names here (the label lookup is what makes big queries time out); details() fetches those for one place."""
    lo, hi = band
    q = f"""PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
SELECT ?item ?coord ?image ?sl WHERE {{
  ?item wdt:P31 wd:{cls} .
  ?item wikibase:sitelinks ?sl .
  FILTER(?sl >= {lo} && ?sl <= {hi})
  ?item wdt:P625 ?coord .
  ?item wdt:P18 ?image .
}} LIMIT 400"""
    out = {}
    for r in sparql(q):
        qid = r["item"]["value"].rsplit("/", 1)[-1]
        m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", r["coord"]["value"])
        if not m or qid in out or not re.match(r"^Q\d+$", qid):
            continue
        out[qid] = {"qid": qid, "lon": float(m.group(1)), "lat": float(m.group(2)),
                    "image": urllib.parse.unquote(r["image"]["value"].rsplit("/", 1)[-1])}
    return list(out.values())


def entities(ids, props="labels|claims|sitelinks"):
    q = urllib.parse.urlencode({"action": "wbgetentities", "format": "json", "ids": "|".join(ids), "props": props,
                                "languages": "en", "sitefilter": "enwiki"})
    return json.loads(http("https://www.wikidata.org/w/api.php?" + q))["entities"]


def claim_ids(ent, prop):
    out = []
    for c in ent.get("claims", {}).get(prop, []):
        v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if isinstance(v, dict) and v.get("id"):
            out.append(v["id"])
        elif isinstance(v, str):
            out.append(v)
    return out


def details(c):
    """Name, Wikipedia link, country, ISO code and continent of one place (Wikidata's API, not the query service)."""
    e = entities([c["qid"]])[c["qid"]]
    title = e.get("labels", {}).get("en", {}).get("value")
    countries = claim_ids(e, "P17")
    if not title or not countries:
        return None
    wiki = e.get("sitelinks", {}).get("enwiki", {}).get("title")
    ce = entities([countries[0]])[countries[0]]
    iso = (claim_ids(ce, "P297") or [""])[0].upper()
    conts = claim_ids(ce, "P30")
    if not re.match(r"^[A-Z]{2}$", iso) or not conts:
        return None
    labels = entities(conts[:2], "labels")
    cont = " / ".join(labels[k].get("labels", {}).get("en", {}).get("value", "") for k in conts[:2] if k in labels).strip(" /")
    c.update({"title": title, "country": ce.get("labels", {}).get("en", {}).get("value", ""), "country_code": iso, "continent": cont,
              "wiki_url": "https://en.wikipedia.org/wiki/" + urllib.parse.quote(wiki.replace(" ", "_")) if wiki else None})
    return c if c["country"] and cont else None


def strip_html(s):
    s = re.sub(r"<[^>]+>", "", s or "")
    return re.sub(r"\s+", " ", s).strip()


def commons_info(filename):
    q = urllib.parse.urlencode({"action": "query", "format": "json", "titles": "File:" + filename, "prop": "imageinfo",
                                "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 1600})
    pages = json.loads(http("https://commons.wikimedia.org/w/api.php?" + q))["query"]["pages"]
    info = next(iter(pages.values())).get("imageinfo", [None])[0]
    if not info:
        return None
    meta = info.get("extmetadata", {})
    lic = strip_html(meta.get("LicenseShortName", {}).get("value", ""))
    if not FREE_LICENCE.match(lic) or re.search(r"\b(nc|nd)\b", lic, re.I):
        return None
    if info.get("mime") not in ("image/jpeg", "image/png", "image/webp"):
        return None
    w, h = info.get("width", 0), info.get("height", 0)
    if w < 1200 or w < h * 1.2:          # wide enough, and landscape
        return None
    artist = strip_html(meta.get("Artist", {}).get("value", "")) or "unknown author"
    return {"thumb": info.get("thumburl") or info["url"], "license": lic[:60], "credit": artist[:200],
            "source_url": info.get("descriptionurl", "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(filename))}


def compose(photo_bytes, rng):
    """Crop the photo a little, add a Pepe pose, return WebP bytes (no metadata)."""
    im = Image.open(io.BytesIO(photo_bytes))
    im = im.convert("RGB")
    w, h = im.size
    # a random crop of 86-94 % keeps it fair but makes a reverse image search harder
    f = rng.uniform(0.86, 0.94)
    cw, ch = int(w * f), int(h * f)
    x0, y0 = rng.randint(0, w - cw), rng.randint(0, h - ch)
    im = im.crop((x0, y0, x0 + cw, y0 + ch))
    ratio = max(1.25, min(1.8, im.width / im.height))
    if im.width / im.height > ratio:                     # very wide panoramas: cut the sides
        nw = int(im.height * ratio)
        im = im.crop(((im.width - nw) // 2, 0, (im.width - nw) // 2 + nw, im.height))
    im = im.resize((OUT_W, round(OUT_W * im.height / im.width)), Image.LANCZOS).convert("RGBA")
    W, H = im.size

    pose_file = rng.choice(sorted(POSES.glob("*.png")))
    pose = Image.open(pose_file).convert("RGBA")
    lo, hi = TALL.get(pose_file.stem, (0.38, 0.46))
    ph = int(H * rng.uniform(lo, hi))
    pose = pose.resize((round(pose.width * ph / pose.height), ph), Image.LANCZOS)
    right = FACES.get(pose_file.stem) == "left"
    margin = int(W * 0.03)
    x = W - pose.width - margin if right else margin
    bust = pose_file.stem in BUSTS
    y = H - pose.height if bust else H - pose.height - int(H * 0.02)
    # a soft shadow under his feet
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse((x + pose.width * 0.12, y + ph * 0.93, x + pose.width * 0.88, y + ph * 1.02), fill=(0, 0, 0, 90))
    if not bust:
        im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(8)))
    im.alpha_composite(pose, (x, y))
    out = im.convert("RGB")
    for q in (78, 70, 62, 55):
        buf = io.BytesIO()
        out.save(buf, "WEBP", quality=q, method=6)      # Pillow writes no EXIF unless asked
        if buf.tell() <= 480_000:
            break
    return buf.getvalue(), pose_file.stem


def main():
    args = sys.argv[1:]
    dry = args[args.index("--dry-run") + 1] if "--dry-run" in args else None
    import os
    token = os.environ.get("WP_ROBOT_TOKEN", "").strip()
    if not dry and not token:
        print("WP_ROBOT_TOKEN is not set: nothing to do")
        return 0
    rng = random.Random()
    need = MAX_NEW_PER_RUN
    if not dry:
        st = rpc("gry_wp_robot_status", {"p_token": token})
        need = min(MAX_NEW_PER_RUN, max(0, TARGET_READY - st["pending"] - st["approved_waiting"]))
        print("queue:", st, "-> new:", need, flush=True)
    added, tries, pools, wd_fail, t0 = 0, 0, {}, 0, time.time()
    skips = {"no details, licence or size": 0, "error": 0}
    while added < need and tries < 150 and wd_fail < 6 and time.time() - t0 < 12 * 60:
        tries += 1
        key = (rng.choice(BANDS), rng.choice(list(CLASSES)))
        if key not in pools:
            try:
                pools[key] = candidates(*key)
                print(f"{CLASSES[key[1]]}, fame {key[0][0]}+: {len(pools[key])} places", flush=True)
            except Exception as e:
                wd_fail += 1
                pools[key] = []
                print(f"no places from either query service ({e}), {wd_fail}/6", flush=True)
                time.sleep(3)
                continue
        if not pools[key]:
            continue
        c = pools[key].pop(rng.randrange(len(pools[key])))
        try:
            if not details(c):
                skips["no details, licence or size"] += 1
                continue
            info = commons_info(c["image"])
            if not info:
                skips["no details, licence or size"] += 1
                continue
            webp, pose = compose(http(info["thumb"]), rng)
        except Exception as e:
            skips["error"] += 1
            print("skipped a place:", type(e).__name__, flush=True)
            continue
        c.update({k: info[k] for k in ("license", "credit", "source_url")})
        c.pop("image")
        if dry:
            pathlib.Path(dry).mkdir(parents=True, exist_ok=True)
            (pathlib.Path(dry) / f"{c['qid']}.webp").write_bytes(webp)
            (pathlib.Path(dry) / f"{c['qid']}.json").write_text(json.dumps(c, indent=1))
            res = {"id": "dry"}
        else:
            try:
                res = rpc("gry_wp_robot_add", {"p_token": token, "p": c, "p_image": "data:image/webp;base64," + base64.b64encode(webp).decode()})
            except Exception as e:
                skips["error"] += 1
                print("the queue refused a puzzle:", getattr(e, "code", type(e).__name__), flush=True)
                continue
        if res and res.get("duplicate"):
            continue
        added += 1
        print(f"added puzzle {added} ({pose}, {len(webp) // 1024} KB)", flush=True)   # no place, no Q-id: Actions logs are public
        time.sleep(1)
    print(f"done: {added} new after {tries} tries, skipped: {skips}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
