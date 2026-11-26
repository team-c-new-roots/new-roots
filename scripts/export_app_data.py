"""Turns the data team's Gold tables into the small files the web app loads.

The app ranks suburbs in the browser, so it needs every suburb's figures and
scores, but not the geometry or the raw data. This keeps only what the app
reads, rounds it, and writes:

  public/data/app-data.json           scores, figures and topic weights
  public/data/languages/index.json    every language spoken in these suburbs
  public/data/languages/<name>.json   one language's figures, loaded when chosen
  public/data/suburbs.geojson         suburb shapes for the map (needs shapely)
  public/data/availability.json       how many homes were newly leased, and affordable lettings
  src/data/payments.json              Centrelink rates for the budget
  src/data/exported.json              the export date, shown as "data updated" on the site

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


# the topics the app scores, spelt as in TopicName in src/types/index.ts. a
# topic only reaches the scores when the team agrees it should, so anything
# else in the lookup, like Availability, is shown but never counted (agreed
# 24 Nov). add it here and to the app together if that changes. Essentials
# isn't in the lookup, it's added below
SCORED_TOPICS = {"Affordability", "Education", "Healthcare", "Safety", "Transport", "Language", "Community"}

# US 4.3, nearby services. the GP score is the OBT's own, the other two are
# worked out here from Gold features, along with the nearest of each by name the same way the pipeline does its
# proximities (nearest point to the suburb's centroid in EPSG:7855, scored
# 0-100 between the 10th and 90th percentiles). equal weights, agreed 24 Nov
ESSENTIALS = {
    "gp_proximity": {"general practice"},
    "pharmacy_proximity": {"pharmacy"},
    "services_australia_proximity": {"services australia centre", "services australia", "centrelink office"},
}


def export_weights(gold):
    weights, skipped = [], set()
    for row in read_rows(gold / "new_roots_metric_weighting_lookup.csv"):
        topic = row["topic"].strip()
        if topic not in SCORED_TOPICS:
            skipped.add(topic)
            continue
        table = row["table"].strip().lower()
        metric = row["metric"].strip()
        weights.append({
            "topic": topic,
            "table": TABLE_NAMES.get(table, table),
            "metric": METRIC_NAMES.get(metric, metric),
            "weight": number(row["weighting_pct"]),
        })
    for topic in sorted(skipped):
        print(f"left {topic} out of the scores, it isn't a topic the app scores")
    return weights


def export_weights_essentials():
    share = round(100 / len(ESSENTIALS), 2)
    return [
        {"topic": "Essentials", "table": "obt", "metric": metric, "weight": share}
        for metric in ESSENTIALS
    ]


def percentile(values, q):
    """pandas' default linear quantile"""
    ordered = sorted(values)
    at = (len(ordered) - 1) * q
    low, high = math.floor(at), math.ceil(at)
    return ordered[low] + (ordered[high] - ordered[low]) * (at - low)


def proximity_scores(values):
    """score(values, lower=True) from the pipeline notebook, nearer is better"""
    valid = [value for value in values if value is not None]
    if not valid:
        return [None] * len(values)
    if all(value == 0 for value in valid):
        return [None if value is None else 0 for value in values]
    low, high = percentile(valid, 0.1), percentile(valid, 0.9)
    if high == low:
        return [None if value is None else 100 for value in values]
    # round() is half to even, the same as pandas
    return [
        None if value is None else round(100 - (min(max(value, low), high) - low) / (high - low) * 100)
        for value in values
    ]


def rankings(values):
    """rank(ascending=True, method='min'), blanks left blank"""
    ordered = sorted(value for value in values if value is not None)
    first = {}
    for at, value in enumerate(ordered, 1):
        first.setdefault(value, at)
    return [None if value is None else first[value] for value in values]


def export_essentials(gold, obt_rows, suburbs):
    try:
        from pyproj import Transformer
        from shapely import transform, wkt
    except ImportError:
        sys.exit("the nearby services scores need shapely and pyproj: pip install -r pipeline/requirements.txt")

    to_metres = Transformer.from_crs(4326, 7855, always_xy=True)

    def project(coords):
        x, y = to_metres.transform(coords[:, 0], coords[:, 1])
        coords[:, 0], coords[:, 1] = x, y
        return coords

    centres = [transform(wkt.loads(row["geometry"]), project).centroid for row in obt_rows]
    points = {}
    for row in read_rows(gold / "new_roots_features.csv"):
        kind = row["feature_subtype"].strip().lower()
        lon, lat = number(row["x_coord"]), number(row["y_coord"])
        if lon is not None and lat is not None:
            points.setdefault(kind, []).append((*to_metres.transform(lon, lat), row["name"].strip()))

    by_id = {suburb["suburb_id"]: suburb for suburb in suburbs}
    for metric, kinds in ESSENTIALS.items():
        found = [point for kind in kinds for point in points.get(kind, [])]
        if not found:
            print(f"no {' or '.join(sorted(kinds))} in the features table, so {metric} is blank for now")
        nearest = [
            min(((math.hypot(centre.x - x, centre.y - y), name) for x, y, name in found)) if found else None
            for centre in centres
        ]
        distances = [None if near is None else near[0] / 1000 for near in nearest]
        for row, near, distance, rank, score in zip(
            obt_rows, nearest, distances, rankings(distances), proximity_scores(distances)
        ):
            suburb = by_id[row["suburb_id"].strip()]
            suburb[f"{metric}_name"] = near[1] or None if near else None
            # the GP figures stay the OBT's, only its name comes from here
            if metric == "gp_proximity":
                continue
            suburb[f"{metric}_value"] = rounded(distance, 6)
            suburb[f"{metric}_ranking"] = rank
            suburb[f"{metric}_score"] = score


def export_suburbs(obt_rows):
    suburbs = []
    for row in obt_rows:
        suburb = {
            "suburb_id": row["suburb_id"].strip(),
            "suburb_name": row["suburb_name"].strip(),
            "suburb_area_km2": rounded(number(row.get("suburb_area_km2")), 2),
        }
        for key, text in row.items():
            # US 2.5 has its own file, see export_availability
            if key.startswith("rental_availability_"):
                continue
            # rents stay exact, since the cheaper home and the budget caps can turn
            # on a fraction of a cent. 6 places is plenty for distances and rates
            if key.startswith("rent_") and key.endswith("_value"):
                suburb[key] = number(text)
            elif key.endswith("_value"):
                suburb[key] = rounded(number(text), 6)
            elif key.endswith("_score") or key.endswith("_ranking"):
                suburb[key] = rounded(number(text), 2)
            # where a rent came from: the suburb itself, its council area, or nearby suburbs
            elif key.endswith("_infilling_method"):
                suburb[key] = (text or "").strip() or None
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


# the payments table writes dates the Australian way, 20/09/2026
def iso_date(text):
    match = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", text)
    if not match:
        return text
    day, month, year = match.groups()
    return f"{year}-{int(month):02d}-{int(day):02d}"


def export_payments(path, rates_from, out):
    rows = read_rows(path)
    amounts = {}
    dates = set()
    for row in rows:
        key = (tidy(row["payment_type"]), tidy(row["situation"]))
        amounts[key] = number(re.sub(r"[$,\s]", "", row["weekly_amount"]))
        for column in DATE_COLUMNS:
            if row.get(column, "").strip():
                dates.add(iso_date(row[column].strip()))

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
    # the scoring module averages every infrastructure score and distance for a
    # suburb, then leaves the suburb out if either is blank
    totals = {}
    for row in read_rows(gold / "new_roots_infrastructure.csv"):
        total = totals.setdefault(row["suburb_id"].strip(), [0.0, 0, 0.0, 0])
        score, distance = number(row["infra_score"]), number(row.get("proximity"))
        if score is not None:
            total[0] += score
            total[1] += 1
        if distance is not None:
            total[2] += distance
            total[3] += 1
    community = {}
    for key, (score, scores, distance, distances) in sorted(totals.items()):
        community[key] = rounded(score / scores, 4) if scores and distances else None
    return community


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


# the rental report shortens a few council names to fit its columns
COUNCIL_NAMES = {"Mornington Penin'a": "Mornington Peninsula"}
AVAILABILITY_TYPES = ["1br_flat", "2br_flat", "3br_flat", "2br_house", "3br_house", "4br_house"]
LEVELS = {"suburb": "s", "precinct": "p", "lga": "c"}
AFFORDABLE_BEDS = {"1 bedroom": "1", "2 bedroom": "2", "3 bedroom": "3", "4+ bedroom": "4"}


def council_name(text):
    text = (text or "").strip()
    return COUNCIL_NAMES.get(text, text)


def month_year(text):
    # "Jun 2026" -> "June 2026"
    from datetime import datetime

    return datetime.strptime(text.strip(), "%b %Y").strftime("%B %Y")


def export_availability(gold, obt_rows, out):
    """US 2.5. how many homes of each size were newly leased in the year to the
    rental report's latest quarter, and the share of each council's new leases
    that were affordable on Centrelink incomes.

    a suburb's figure is its own, its rental report area's (two or three suburbs
    reported together) or its council's. the app says which. to say whether
    that's more or fewer than most suburbs, a shared figure is split evenly
    across the suburbs sharing it first, otherwise a council total would beat
    every single suburb. the data team's own ranking doesn't do that, so it's
    not used here"""
    affordable_rows = read_rows(gold / "new_roots_affordable_lettings.csv")
    periods = {row["period"].strip() for row in affordable_rows}
    if len(periods) != 1:
        sys.exit(f"expected one period in the affordable lettings, got {sorted(periods)}")
    period = month_year(periods.pop())

    # each suburb's main council, the one most of it sits in
    council_of = {}
    weight_of = {}
    for row in read_rows(gold / "suburb_lga_mapping.csv"):
        suburb_id = row["suburb_id"].strip()
        weight = number(row["lga_weighting"]) or 0
        if weight > weight_of.get(suburb_id, -1):
            weight_of[suburb_id] = weight
            council_of[suburb_id] = council_name(row["lga_name"])
    suburbs_in_council = {}
    for name in council_of.values():
        suburbs_in_council[name] = suburbs_in_council.get(name, 0) + 1

    areas = []
    area_index = {}

    def area(name):
        if name not in area_index:
            area_index[name] = len(areas)
            areas.append(name)
        return area_index[name]

    homes = {}
    for home in AVAILABILITY_TYPES:
        value_key = f"rental_availability_{home}_value"
        method_key = f"rental_availability_{home}_infilling_method"
        name_key = f"rental_availability_{home}_area_name"
        found = []
        precinct_size = {}
        for row in obt_rows:
            count = number(row.get(value_key))
            method = (row.get(method_key) or "").strip()
            if count is None or method not in LEVELS:
                continue
            name = (row.get(name_key) or "").strip()
            if method == "lga":
                name = council_name(name)
            if method == "precinct":
                precinct_size[name] = precinct_size.get(name, 0) + 1
            found.append((row["suburb_id"].strip(), int(round(count)), method, name))

        rows = []
        for suburb_id, count, method, name in found:
            if count <= 0:
                sys.exit(f"{home} for {suburb_id} is {count}, a missing figure should be blank, not zero")
            if method == "suburb":
                shared = 1
            elif method == "precinct":
                shared = precinct_size[name]
            else:
                if name not in suburbs_in_council:
                    sys.exit(f"{home} for {suburb_id} uses council {name!r}, which no suburb maps to")
                shared = suburbs_in_council[name]
            rows.append((suburb_id, count, method, name, shared, count / shared))

        each = sorted(item[5] for item in rows)
        table = {}
        for suburb_id, count, method, name, shared, per_suburb in rows:
            # share of suburbs with a lower figure, ties counted half
            below = sum(1 for value in each if value < per_suburb)
            equal = sum(1 for value in each if value == per_suburb)
            position = (below + equal / 2) / len(each)
            band = -1 if position < 1 / 3 else 1 if position > 2 / 3 else 0
            few = 1 if position < 0.2 else 0
            table[suburb_id] = [count, LEVELS[method], area(name) if method != "suburb" else -1, shared, band, few]
        homes[home] = table
        print(f"  {home}: {len(table)} suburbs, {sum(item[5] for item in table.values())} flagged few")

    affordable = {}
    for row in affordable_rows:
        beds = AFFORDABLE_BEDS.get(row["dwelling_type"].strip())
        if not beds:
            continue
        count = number(row["affordable_lettings"])
        share = number(row["affordable_lettings_share"])
        if count is None or share is None:
            continue
        affordable.setdefault(council_name(row["lga_name"]), {})[beds] = [int(count), rounded(share, 1)]

    missing = sorted({name for name in council_of.values() if name not in affordable})
    if missing:
        print(f"  no affordable lettings for {', '.join(missing)}")

    data = {
        "period": period,
        "areas": areas,
        "homes": homes,
        "councils": {suburb_id: area(name) for suburb_id, name in sorted(council_of.items())},
        "affordable": affordable,
    }
    path = out / "availability.json"
    path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))
    print(f"wrote {path.relative_to(REPO)} ({path.stat().st_size // 1024} KB, {period})")


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
    suburbs = export_suburbs(obt_rows)
    export_essentials(gold, obt_rows, suburbs)
    export_availability(gold, obt_rows, args.out)
    data = {
        "exported": date.today().isoformat(),
        "weights": weights + export_weights_essentials(),
        "suburbs": suburbs,
        "topLanguages": top_languages,
        "languageLabels": language_labels,
        "community": export_community(gold),
    }
    path = args.out / "app-data.json"
    path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))
    print(f"wrote {path.relative_to(REPO)} ({path.stat().st_size // 1024} KB, {len(data['suburbs'])} suburbs)")

    # small and bundled, so pages that don't load the suburb data can still say how fresh it is
    stamp = REPO / "src" / "data" / "exported.json"
    stamp.write_text(json.dumps({"exported": data["exported"]}, indent=2) + "\n")
    print(f"wrote {stamp.relative_to(REPO)} ({data['exported']})")

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
