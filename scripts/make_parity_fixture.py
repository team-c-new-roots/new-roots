"""Runs the data team's scoring module on a few households and saves its
answers for every suburb, so the browser's scoring can be tested against the
real thing. Rerun this whenever the scoring module or Gold changes, after
exporting the app's data from the same Gold, then run npm run format:

  python3 scripts/make_parity_fixture.py "path/to/Scoring Module and artefacts" "path/to/Gold"

The module needs pandas, shapely and pyproj installed.

Jake agreed on 15 Nov that a 0 is a real figure and only a blank is missing.
Until new_roots_scoring.py has that change, this applies it before running.
"""

import importlib.util
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "src" / "services" / "__tests__" / "fixtures" / "scoring-parity.json"
# households covering each home type and size, a range of incomes and every level
HOUSEHOLDS = [
    {
        "selected_language": "Dari",
        "bedrooms": 2,
        "dwelling_type": "both",
        "income": 1500,
        "topic_importance": {
            "Affordability": "very important",
            "Education": "important",
            "Healthcare": "important",
            "Safety": "important",
            "Transport": "not important",
            "Language": "very important",
            "Community": "very important",
        },
    },
    {
        "selected_language": "Arabic",
        "bedrooms": 3,
        "dwelling_type": "house",
        "income": 900,
        "topic_importance": {
            "Affordability": "very important",
            "Education": "very important",
            "Healthcare": "important",
            "Safety": "not important",
            "Transport": "important",
            "Language": "important",
            "Community": "not important",
        },
    },
    {
        "selected_language": "Dinka",
        "bedrooms": 1,
        "dwelling_type": "flat",
        "income": 650,
        "topic_importance": {
            "Affordability": "very important",
            "Education": "important",
            "Healthcare": "important",
            "Safety": "not important",
            "Transport": "very important",
            "Language": "very important",
            "Community": "important",
        },
    },
    {
        "selected_language": "Hazaraghi",
        "bedrooms": 4,
        "dwelling_type": "both",
        "income": 1250,
        "topic_importance": {
            "Affordability": "very important",
            "Education": "very important",
            "Healthcare": "not important",
            "Safety": "important",
            "Transport": "important",
            "Language": "important",
            "Community": "very important",
        },
    },
    {
        "selected_language": "Persian (excluding Dari)",
        "bedrooms": 1,
        "dwelling_type": "both",
        "income": 533.15,
        "topic_importance": {
            "Affordability": "very important",
            "Education": "not important",
            "Healthcare": "very important",
            "Safety": "important",
            "Transport": "very important",
            "Language": "not important",
            "Community": "not important",
        },
    },
]

# the two lines that read a 0 as missing, and what they become
ZERO_IS_MISSING = {
    "valid = raw.notna() & (raw != 0) & score.notna()": "valid = raw.notna() & score.notna()",
    "raw.where(raw.notna() & (raw != 0))": "raw.where(raw.notna())",
}

OUTPUTS = [
    "affordability_score",
    "education_score",
    "healthcare_score",
    "safety_score",
    "transport_score",
    "language_score",
    "community_score",
    "selected_weekly_rent",
    "rent_to_income_pct",
    "affordability_cap",
    "overall_score",
    "overall_rank",
    "selected_dwelling_type",
]


def main():
    module_dir, gold = Path(sys.argv[1]), Path(sys.argv[2])
    path = module_dir / "new_roots_scoring.py"
    source = path.read_text(encoding="utf-8")
    for old, new in ZERO_IS_MISSING.items():
        if old in source:
            source = source.replace(old, new)
            print(f"the module still reads 0 as missing, so counting it: {new}")
    spec = importlib.util.spec_from_loader("scoring", loader=None)
    scoring = importlib.util.module_from_spec(spec)
    scoring.__file__ = str(path)
    exec(compile(source, str(path), "exec"), scoring.__dict__)
    scoring.ROOT = gold
    scorer = scoring.NewRootsScorer()

    # [one value per output] for each suburb, to keep the file small
    cases = []
    for household in HOUSEHOLDS:
        rows = scorer.calculate_scores(**household)
        expected = {str(row["suburb_id"]): [row[key] for key in OUTPUTS] for row in rows}
        cases.append({"household": household, "expected": expected})
    suburbs = len(cases[0]["expected"])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"outputs": OUTPUTS, "cases": cases}, separators=(",", ":")))
    print(f"wrote {OUT.relative_to(REPO)}, {len(cases)} households and {suburbs} suburbs")


if __name__ == "__main__":
    main()
