"""Turns the data team's Gold tables into the small files the web app loads.

The app ranks suburbs in the browser, so it needs every suburb's figures and
scores, but not the geometry, the 500 languages or the raw data. This keeps
only what the app reads, rounds it, and writes:

  public/data/app-data.json    scores, figures, languages and topic weights
  public/data/suburbs.geojson  suburb shapes for the map (needs shapely)

Run it whenever Gold changes, then commit the two files and deploy:

  python3 scripts/export_app_data.py "path/to/Gold"
"""

import argparse
import csv
import json
import math
import sys
from datetime import date
from pathlib import Path

csv.field_size_limit(sys.maxsize)

REPO = Path(__file__).resolve().parent.parent

# the languages the app offers, spelt the way the census spells them. keep in
# step with CENSUS_NAMES in src/data/languages.ts
OFFERED_LANGUAGES = [
    "Dari",
    "Hazaraghi",
    "Persian (excluding Dari)",
    "Arabic",
    "Pashto",
    "Dinka",
]

# the scoring module renames these when it reads the lookup, so do the same
TABLE_NAMES = {"cultural_infrastructure": "infrastructure"}
METRIC_NAMES = {"language_score": "language", "infra_score": "infra"}

# about 140 m at Melbourne's latitude. plenty for a phone-sized map, and
# simplifying all the borders together keeps neighbouring suburbs touching
SIMPLIFY_DEGREES = 0.0015


def number(text):
    """CSV text to a number, or None for blanks and NaN."""
    if text is None:
        return None
    text = text.strip()
    if text == "":
        return None
    try:
        value = float(text)
    except ValueError:
        return None
    return None if math.isnan(value) else value


def rounded(value, places):
    if value is None:
        return None
    value = round(value, places)
    return int(value) if value == int(value) else value


def read_rows(path):
    with open(path, newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def export_weights(gold):
    weights = []
    for row in read_rows(gold / "new_roots_metric_weighting_lookup.csv"):
        table = row["table"].strip().lower()
        metric = row["metric"].strip()
        weights.append({
            "topic": row["topic"].strip(),
            "table": TABLE_NAMES.get(table, table),
            "metric": METRIC_NAMES.get(metric, metric),
            "weight": number(row["weighting_pct"]),
        })
    return weights


def export_suburbs(obt_rows):
    suburbs = []
    for row in obt_rows:
        suburb = {
            "suburb_id": row["suburb_id"].strip(),
            "suburb_name": row["suburb_name"].strip(),
            "suburb_area_km2": rounded(number(row.get("suburb_area_km2")), 2),
        }
        for key, text in row.items():
            if key.endswith("_value"):
                suburb[key] = rounded(number(text), 3)
            elif key.endswith("_score") or key.endswith("_ranking"):
                suburb[key] = rounded(number(text), 2)
        suburbs.append(suburb)
    return sorted(suburbs, key=lambda item: item["suburb_id"])


def export_languages(gold, weights):
    # the Language topic can use more than one metric (share and speaker
    # count, say), so keep a score for each one the lookup names
    metrics = [row["metric"] for row in weights if row["table"] == "languages"]
    offered = {name: {} for name in OFFERED_LANGUAGES}
    spoken = {}
    for row in read_rows(gold / "new_roots_languages.csv"):
        suburb_id = row["suburb_id"].strip()
        language = row["language"].strip()
        percent = number(row["percent_spoken"])
        if language in offered:
            offered[language][suburb_id] = {
                "percent": rounded(percent, 3),
                "count": rounded(number(row.get("speaker_count")), 0),
                "scores": {metric: rounded(number(row.get(f"{metric}_score")), 2) for metric in metrics},
            }
        if percent:
            spoken.setdefault(suburb_id, []).append((percent, language))

    missing = [name for name, rows in offered.items() if not rows]
    if missing:
        sys.exit(f"these offered languages aren't in the languages table: {missing}")

    # the four most spoken languages in each suburb, for the details page
    top = {
        suburb_id: [[name, rounded(percent, 2)] for percent, name in sorted(rows, reverse=True)[:4]]
        for suburb_id, rows in sorted(spoken.items())
    }
    return offered, top


def export_community(gold):
    # the scoring module averages every infrastructure score for a suburb
    totals = {}
    for row in read_rows(gold / "new_roots_infrastructure.csv"):
        score = number(row["infra_score"])
        if score is None:
            continue
        total = totals.setdefault(row["suburb_id"].strip(), [0.0, 0])
        total[0] += score
        total[1] += 1
    return {key: rounded(total / count, 4) for key, (total, count) in sorted(totals.items())}


def export_shapes(obt_rows, out):
    try:
        from shapely import coverage_simplify, wkt
        from shapely.geometry import mapping
    except ImportError:
        print("shapely isn't installed, so suburbs.geojson was left as it is")
        return

    geometries = [wkt.loads(row["geometry"]) for row in obt_rows]
    simplified = coverage_simplify(geometries, tolerance=SIMPLIFY_DEGREES)

    def round_coords(coords):
        if isinstance(coords[0], (int, float)):
            return [round(coords[0], 5), round(coords[1], 5)]
        return [round_coords(part) for part in coords]

    features = []
    for row, shape in zip(obt_rows, simplified):
        point = shape.representative_point()
        geometry = mapping(shape)
        features.append({
            "type": "Feature",
            "properties": {
                "suburb_id": row["suburb_id"].strip(),
                "suburb_name": row["suburb_name"].strip(),
                "label_lat": round(point.y, 5),
                "label_lon": round(point.x, 5),
            },
            "geometry": {"type": geometry["type"], "coordinates": round_coords(geometry["coordinates"])},
        })
    path = out / "suburbs.geojson"
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")))
    print(f"wrote {path.relative_to(REPO)} ({path.stat().st_size // 1024} KB)")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("gold", type=Path, help="the Gold folder from Drive")
    parser.add_argument("--out", type=Path, default=REPO / "public" / "data")
    parser.add_argument("--skip-shapes", action="store_true", help="leave suburbs.geojson as it is")
    args = parser.parse_args()

    gold = args.gold.expanduser()
    if not (gold / "new_roots_obt.csv").exists():
        sys.exit(f"no new_roots_obt.csv in {gold}, is that the Gold folder?")
    args.out.mkdir(parents=True, exist_ok=True)

    obt_rows = read_rows(gold / "new_roots_obt.csv")
    weights = export_weights(gold)
    languages, top_languages = export_languages(gold, weights)
    data = {
        "exported": date.today().isoformat(),
        "weights": weights,
        "suburbs": export_suburbs(obt_rows),
        "languages": languages,
        "topLanguages": top_languages,
        "community": export_community(gold),
    }
    path = args.out / "app-data.json"
    path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))
    print(f"wrote {path.relative_to(REPO)} ({path.stat().st_size // 1024} KB, {len(data['suburbs'])} suburbs)")

    if not args.skip_shapes:
        export_shapes(obt_rows, args.out)


if __name__ == "__main__":
    main()
