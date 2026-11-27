"""Five years of median rents for the suburb page's rent trend (US 1.4).

  public/data/rent-trend.json   each suburb's last five years beside Melbourne's

The Rental Report counts rents for areas, some of them two or three suburbs
together, so every suburb in an area gets the same line and the app says so.
Only about 165 of the 572 suburbs are in it. The rest get no file entry and
the page says there's no trend for them, rather than estimating one.

  python3 scripts/export_rent_trend.py pipeline/gold
"""

import argparse
import csv
import json
from datetime import date
from pathlib import Path

import rent_outliers

# the one big table has very long rows (Jake's Windows-safe limit, as in export_app_data.py)
csv.field_size_limit(2**31 - 1)

REPO = Path(__file__).resolve().parent.parent
YEARS = 5

# the Rental Report's home types -> the app's rent columns, minus rent_
TYPES = {
    "1 bedroom flat": "1br_flat",
    "2 bedroom flat": "2br_flat",
    "3 bedroom flat": "3br_flat",
    "2 bedroom house": "2br_house",
    "3 bedroom house": "3br_house",
    "4 bedroom house": "4br_house",
    "All properties": "all",
}


def number(text):
    text = (text or "").strip()
    return round(float(text)) if text else None


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("gold", type=Path, help="the Gold folder, like pipeline/gold")
    parser.add_argument("--out", type=Path, default=REPO / "public" / "data" / "rent-trend.json")
    args = parser.parse_args()

    with (args.gold / "new_roots_rent_trend.csv").open(newline="", encoding="utf-8-sig") as file:
        rows = list(csv.DictReader(file))
    # a home type whose rent the app swaps for the council figure gets no line
    # of its own, so the chart falls back to all homes rather than showing the
    # skewed figure beside the estimate
    with (args.gold / "new_roots_obt.csv").open(newline="", encoding="utf-8-sig") as file:
        swapped = set(rent_outliers.find(list(csv.DictReader(file)), args.gold))

    latest = max(row["period"] for row in rows)
    end = date.fromisoformat(latest)
    start = end.replace(year=end.year - YEARS).isoformat()
    periods = sorted({row["period"] for row in rows if start <= row["period"] <= latest})
    index = {period: i for i, period in enumerate(periods)}

    melbourne = {key: [None] * len(periods) for key in TYPES.values()}
    suburbs = {}
    for row in rows:
        key = TYPES.get(row["dwelling_type"])
        at = index.get(row["period"])
        if key is None or at is None:
            continue
        melbourne[key][at] = number(row["melbourne_avg_rent"])
        if (row["suburb_id"], key) in swapped:
            continue
        suburb = suburbs.setdefault(row["suburb_id"], {"area": row["precinct"], "rents": {}})
        suburb["rents"].setdefault(key, [None] * len(periods))[at] = number(row["median_weekly_rent"])

    # a home type with no figures at all is left out, so the app falls back
    for suburb in suburbs.values():
        suburb["rents"] = {key: values for key, values in suburb["rents"].items() if any(v is not None for v in values)}

    out = {"periods": periods, "melbourne": melbourne, "suburbs": suburbs}
    args.out.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False))
    print(
        f"wrote {args.out.relative_to(REPO)} ({args.out.stat().st_size // 1024} KB), "
        f"{len(suburbs)} suburbs, {periods[0]} to {periods[-1]}"
    )


if __name__ == "__main__":
    main()
