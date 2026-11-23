"""Splits the places for the map's filters into one small file per suburb.

Each suburb gets the places inside it plus a margin past its border, so
something just over the line still shows. The app downloads one file when a
suburb is picked, not all of Melbourne.

  public/data/places/<suburb_id>.json   [type, name, lat, lon] for each place

Reads the suburb shapes from public/data/suburbs.geojson, so run
export_app_data.py first if the suburbs have changed. Needs shapely.

  python3 scripts/export_places.py "path/to/Gold/new_roots_features.csv"
"""

import argparse
import csv
import json
import math
import re
import sys
from pathlib import Path

csv.field_size_limit(sys.maxsize)

REPO = Path(__file__).resolve().parent.parent

# keep in step with PLACE_MARGIN_KM in src/data/places.ts. a 20 minute walk,
# the same distance as US 3.2. fixed rather than scaled to the suburb, since
# how far someone walks to a place over the border doesn't change with size
MARGIN_KM = 1.5

# the data's type -> the app's. keep the app's names in step with
# PLACE_GROUPS in src/data/places.ts. anything not here is left out
TYPES = {
    "church": "church",
    "mosque": "mosque",
    "synagogue": "synagogue",
    "gurdwara (sikh)": "gurdwara",
    "gurdwara": "gurdwara",
    "mandir (hindu)": "mandir",
    "mandir": "mandir",
    "vihara (buddhist)": "vihara",
    "vihara": "vihara",
    "monastry": "monastery",
    "monastery": "monastery",
    "library": "library",
    "community centre": "communityCentre",
    "hall": "hall",
    "general hospital": "hospital",
    "hospital": "hospital",
    "community health centre": "communityHealth",
    "gp": "gp",
    "general practice": "gp",
    "pharmacy": "pharmacy",
    "primary school": "primary",
    "secondary school": "secondary",
    "primary/secondary school": "primarySecondary",
    "university": "university",
    "tertiary institution": "tertiary",
    "amep class": "englishClass",
    "playground": "playground",
    "picnic site": "picnic",
}

# Gold's names first, then Vicmap's own from Bronze
COLUMNS = {
    "type": ("feature_subtype", "feature_type", "type"),
    "name": ("name", "name_label"),
    "lat": ("y_coord", "Y", "lat", "latitude"),
    "lon": ("x_coord", "X", "lon", "longitude"),
    "id": ("pfi", "id"),
}

# Vicmap names come in capitals. these stay that way when the rest is tidied
KEEP_CAPS = {"TAFE", "RSL", "YMCA", "YWCA", "CWA", "AMES", "RMIT", "ACU", "PCYC", "CFA", "SES", "MCH", "VCE", "UFC", "AFL", "II", "III", "IV"}
SMALL = {"and", "of", "the", "at", "for", "in", "on", "de"}


def tidy_name(name):
    """ST MARYS CATHOLIC CHURCH -> St Marys Catholic Church. mixed case is left alone"""
    if not name or not name.isupper():
        return name

    def word(match):
        text = match.group(0)
        if text in KEEP_CAPS or any(ch.isdigit() for ch in text):
            return text
        lower = text.lower()
        if lower in SMALL and match.start() > 0:
            return lower
        if lower.startswith("mc") and len(lower) > 3:
            return "Mc" + lower[2].upper() + lower[3:]
        return lower[:1].upper() + lower[1:]

    return re.sub(r"[A-Z0-9']+", word, name)

# km per degree at Melbourne. flat is close enough for a 1.5 km margin
KM_LAT = 110.95
KM_LON = 111.32 * math.cos(math.radians(-37.8))


def pick_column(header, names, required=True):
    for name in names:
        if name in header:
            return name
    if required:
        sys.exit(f"the places file needs one of these columns: {', '.join(names)}")
    return None


def to_km(lon, lat):
    return lon * KM_LON, lat * KM_LAT


def read_places(path):
    with path.open(newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        header = reader.fieldnames or []
        cols = {key: pick_column(header, names, key != "id") for key, names in COLUMNS.items()}
        places, seen, skipped = [], set(), {}
        for row in reader:
            raw = (row[cols["type"]] or "").strip().lower()
            kind = TYPES.get(raw)
            if not kind:
                skipped[raw] = skipped.get(raw, 0) + 1
                continue
            # Vicmap repeats some features, one row per version
            if cols["id"]:
                key = row[cols["id"]]
                if key in seen:
                    continue
                seen.add(key)
            try:
                lat, lon = float(row[cols["lat"]]), float(row[cols["lon"]])
            except ValueError:
                continue
            name = tidy_name((row[cols["name"]] or "").strip()) or None
            place = (kind, name, round(lat, 5), round(lon, 5))
            # Gold has no id, so drop exact repeats instead
            if not cols["id"]:
                if place in seen:
                    continue
                seen.add(place)
            places.append(place)
    return places, skipped


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("places", type=Path, help="Gold new_roots_features.csv, or Vicmap's Bronze file")
    parser.add_argument("--out", type=Path, default=REPO / "public" / "data" / "places")
    args = parser.parse_args()

    try:
        from shapely import STRtree, transform
        from shapely.geometry import Point, shape
    except ImportError:
        sys.exit("needs shapely: pip install shapely")

    boundaries = json.loads((REPO / "public" / "data" / "suburbs.geojson").read_text())
    places, skipped = read_places(args.places.expanduser())
    if not places:
        sys.exit("none of the rows had a type the app shows, is that the right file?")

    points = [Point(to_km(lon, lat)) for _, _, lat, lon in places]
    tree = STRtree(points)

    args.out.mkdir(parents=True, exist_ok=True)
    for old in args.out.glob("*.json"):
        old.unlink()

    sizes = []
    for feature in boundaries["features"]:
        area = transform(shape(feature["geometry"]), lambda coords: coords * [KM_LON, KM_LAT]).buffer(MARGIN_KM)
        near = sorted(
            (places[i] for i in tree.query(area, predicate="intersects")),
            key=lambda place: (place[0], place[1] or "", place[2]),
        )
        path = args.out / f"{feature['properties']['suburb_id']}.json"
        path.write_text(json.dumps([list(place) for place in near], separators=(",", ":"), ensure_ascii=False))
        sizes.append((path.stat().st_size, len(near)))

    largest = max(sizes)
    print(
        f"wrote {len(sizes)} files to {args.out.relative_to(REPO)}, "
        f"{len(places)} places, the largest {largest[0] // 1024} KB with {largest[1]} places"
    )
    left_out = sum(skipped.values())
    print(f"left out {left_out} rows with types the map doesn't show")


if __name__ == "__main__":
    main()
