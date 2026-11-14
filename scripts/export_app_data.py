"""Turns the data team's Gold tables into the small files the web app loads.

The app ranks suburbs in the browser, so it needs every suburb's figures and
scores, but not the geometry or the raw data. This keeps only what the app
reads, rounds it, and writes:

  public/data/app-data.json           scores, figures and topic weights
  public/data/languages/index.json    every language spoken in these suburbs
  public/data/languages/<name>.json   one language's figures, loaded when chosen
  public/data/suburbs.geojson         suburb shapes for the map (needs shapely)
  src/data/payments.json              Centrelink rates for the budget

Run it whenever Gold or the payments table changes, then commit and deploy:

  python3 scripts/export_app_data.py "path/to/Gold" --skip-shapes
"""

import argparse
import csv
import json
import math
import re
import sys
from datetime import date
from pathlib import Path

csv.field_size_limit(sys.maxsize)

REPO = Path(__file__).resolve().parent.parent

# the quick picks on the language step, spelt the way the census spells them.
# keep in step with CENSUS_NAMES in src/data/languages.ts
QUICK_PICKS = [
    "Dari",
    "Hazaraghi",
    "Persian (excluding Dari)",
    "Arabic",
    "Pashto",
    "Dinka",
]

# census groups that aren't a language someone would pick, and English, which
# everyone shares so it can't point to a community
NOT_A_CHOICE = {"English", "Non-verbal, so described", "Inadequately described", "Invented Languages"}
CATCH_ALL = re.compile(r", (nfd|nec)$")

# fewer speakers than this across all the suburbs and the census figures are
# mostly noise (it randomly adjusts small counts)
MIN_SPEAKERS = 20

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


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def export_languages(gold, weights, out):
    """Writes the language index and one small file per language.

    A language file lists [percent, speaker count, then one score per Language
    metric] for each suburb. Suburbs where nobody speaks it, with every score
    0, are left out to keep the files small, so the app reads a missing suburb
    as 0 speakers and 0 scores. Blank scores stay in as null, which the app
    treats as missing data."""
    metrics = [row["metric"] for row in weights if row["table"] == "languages"]
    by_language = {}
    labels = {}
    spoken = {}
    for row in read_rows(gold / "new_roots_languages.csv"):
        suburb_id = row["suburb_id"].strip()
        language = row["language"].strip()
        labels[language] = (row.get("display_name") or language).strip() or language
        percent = number(row["percent_spoken"])
        count = number(row.get("speaker_count"))
        scores = [number(row.get(f"{metric}_score")) for metric in metrics]
        by_language.setdefault(language, {})[suburb_id] = [rounded(percent, 3), rounded(count, 0)] + [
            rounded(score, 2) for score in scores
        ]
        if percent:
            spoken.setdefault(suburb_id, []).append((percent, language))

    totals = {name: sum(row[1] or 0 for row in rows.values()) for name, rows in by_language.items()}
    missing = [name for name in QUICK_PICKS if name not in by_language]
    if missing:
        sys.exit(f"these quick-pick languages aren't in the languages table: {missing}")

    folder = out / "languages"
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob("*.json"):
        old.unlink()

    index = []
    for name in sorted(by_language, key=lambda item: (-totals[item], item)):
        offered = name in QUICK_PICKS or (
            name not in NOT_A_CHOICE and not CATCH_ALL.search(name) and totals[name] >= MIN_SPEAKERS
        )
        if not offered:
            continue
        rows = {
            suburb_id: values
            for suburb_id, values in sorted(by_language[name].items())
            if any(value is None or value != 0 for value in values)
        }
        file = slug(name)
        (folder / f"{file}.json").write_text(
            json.dumps(
                {"name": name, "label": labels[name], "metrics": metrics, "suburbs": rows},
                separators=(",", ":"),
                ensure_ascii=False,
            )
        )
        index.append({"name": name, "label": labels[name], "speakers": int(totals[name]), "file": file})

    (folder / "index.json").write_text(json.dumps(index, separators=(",", ":"), ensure_ascii=False))
    print(f"wrote {len(index)} language files and public/data/languages/index.json")

    # the four most spoken languages in each suburb, for the details page
    top = {
        suburb_id: [[name, rounded(percent, 2)] for percent, name in sorted(rows, reverse=True)[:4]]
        for suburb_id, rows in sorted(spoken.items())
    }
    shown = {name for rows in top.values() for name, _ in rows} | {entry["name"] for entry in index}
    return top, {name: labels[name] for name in sorted(shown)}


# each figure the budget uses, as (payment type, situation) in the payments
# table. the export stops if any is missing, so a renamed row can't quietly
# turn into a $0 payment
PAYMENT_ROWS = {
    "parenting": {
        "single": ("Parenting Payment", "Single"),
        "partnered": ("Parenting Payment", "Partnered"),
    },
    "parentingEnergy": {
        "single": ("Energy Supplement - Parenting Payment", "Single"),
        "partnered": ("Energy Supplement - Parenting Payment", "Partnered"),
    },
    "jobseeker": {
        "singleNoChildren": ("JobSeeker Payment", "Single no children"),
        "singleWithChildren": ("JobSeeker Payment", "Single with children"),
        "partnered": ("JobSeeker Payment", "Partnered per person"),
    },
    "jobseekerEnergy": {
        "singleNoChildren": ("Energy Supplement - JobSeeker", "Single no children"),
        "singleWithChildren": (
            "Energy Supplement - JobSeeker",
            "Single with children / principal carer / 55+ / partial capacity",
        ),
        "partnered": ("Energy Supplement - JobSeeker", "Partnered"),
    },
    "ftbA": {
        "child0to12": ("Family Tax Benefit Part A", "Maximum child age 0-12"),
        "child13to19": ("Family Tax Benefit Part A", "Maximum child age 13-19"),
    },
    "ftbAEnergy": {
        "child0to12": ("Energy Supplement - FTB Part A", "Maximum child 0-12"),
        "child13to19": ("Energy Supplement - FTB Part A", "Maximum child 13-19"),
    },
    "ftbB": {
        "youngestUnder5": ("Family Tax Benefit Part B", "Youngest child under 5"),
        "youngest5to18": ("Family Tax Benefit Part B", "Youngest child 5-18"),
    },
    "ftbBEnergy": {
        "youngestUnder5": ("Energy Supplement - FTB Part B", "Youngest child under 5"),
        "youngest5to18": ("Energy Supplement - FTB Part B", "Youngest child 5-18"),
    },
    "rentAssistance": {
        "single": ("Rent Assistance", "Single"),
        "couple": ("Rent Assistance", "Couple combined"),
        "singleFtb1to2": ("Rent Assistance", "Single FTB A 1-2 children"),
        "singleFtb3plus": ("Rent Assistance", "Single FTB A 3+ children"),
        "coupleFtb1to2": ("Rent Assistance", "Couple FTB A 1-2 children"),
        "coupleFtb3plus": ("Rent Assistance", "Couple FTB A 3+ children"),
    },
}

DATE_COLUMNS = ("rates_from", "effective_from", "effective_date")


def tidy(text):
    return " ".join(text.split()).casefold()


def export_payments(path, rates_from, out):
    rows = read_rows(path)
    amounts = {}
    dates = set()
    for row in rows:
        key = (tidy(row["payment_type"]), tidy(row["situation"]))
        amounts[key] = number(re.sub(r"[$,\s]", "", row["weekly_amount"]))
        for column in DATE_COLUMNS:
            if row.get(column, "").strip():
                dates.add(row[column].strip())

    rates, missing = {}, []
    for group, figures in PAYMENT_ROWS.items():
        rates[group] = {}
        for name, (payment_type, situation) in figures.items():
            amount = amounts.get((tidy(payment_type), tidy(situation)))
            if amount is None or amount <= 0:
                missing.append(f"{payment_type} / {situation}")
            rates[group][name] = amount
    if missing:
        sys.exit("the payments table is missing these rows, or they aren't positive amounts:\n  " + "\n  ".join(missing))

    if len(dates) > 1:
        sys.exit(f"the payments table has more than one rates date: {sorted(dates)}")
    if dates:
        rates_from = dates.pop()
    if not rates_from:
        sys.exit("the payments table has no rates_from column, so pass --rates-from, e.g. --rates-from 2026-09-20")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", rates_from):
        sys.exit(f"the rates date should look like 2026-09-20, not {rates_from}")

    out.write_text(json.dumps({"ratesFrom": rates_from, "rates": rates}, indent=2) + "\n")
    print(f"wrote {out.relative_to(REPO)} (rates from {rates_from})")


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
    parser.add_argument(
        "--payments",
        type=Path,
        help="the Centrelink payments CSV, if it isn't in the Gold folder or next to it in Silver",
    )
    parser.add_argument("--rates-from", help="when the payment rates started, e.g. 2026-09-20")
    args = parser.parse_args()

    gold = args.gold.expanduser()
    if not (gold / "new_roots_obt.csv").exists():
        sys.exit(f"no new_roots_obt.csv in {gold}, is that the Gold folder?")
    args.out.mkdir(parents=True, exist_ok=True)

    obt_rows = read_rows(gold / "new_roots_obt.csv")
    weights = export_weights(gold)
    top_languages, language_labels = export_languages(gold, weights, args.out)
    data = {
        "exported": date.today().isoformat(),
        "weights": weights,
        "suburbs": export_suburbs(obt_rows),
        "topLanguages": top_languages,
        "languageLabels": language_labels,
        "community": export_community(gold),
    }
    path = args.out / "app-data.json"
    path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))
    print(f"wrote {path.relative_to(REPO)} ({path.stat().st_size // 1024} KB, {len(data['suburbs'])} suburbs)")

    payments = args.payments or next(
        (
            path
            for path in (gold / "centrelink_weekly_payments.csv", gold.parent / "Silver" / "centrelink_weekly_payments.csv")
            if path.exists()
        ),
        None,
    )
    if payments:
        export_payments(payments.expanduser(), args.rates_from, REPO / "src" / "data" / "payments.json")
    else:
        print("no centrelink_weekly_payments.csv found, so src/data/payments.json was left as it is")

    if not args.skip_shapes:
        export_shapes(obt_rows, args.out)


if __name__ == "__main__":
    main()
