"""Runs the data team's scoring module on a few households and saves its
answers, so the browser's scoring can be tested against the real thing.

The fixture holds only suburbs with every figure present, because the browser
deliberately differs where data is missing: it leaves a missing figure out
instead of counting it as 0. Rerun this whenever the scoring module or Gold
changes:

  python3 scripts/make_parity_fixture.py "path/to/Scoring Module" "path/to/Gold"
"""

import importlib.util
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "src" / "services" / "__tests__" / "fixtures" / "scoring-parity.json"
SUBURBS = 40

# households covering each home type, a range of incomes and every level
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
]

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
]


def main():
    module_dir, gold = Path(sys.argv[1]), Path(sys.argv[2])
    spec = importlib.util.spec_from_file_location("scoring", module_dir / "new_roots_scoring.py")
    scoring = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(scoring)
    scoring.ROOT = gold
    scorer = scoring.NewRootsScorer()

    rent_columns = [f"{metric}_score" for metric in scorer.weights["metric"] if metric.startswith("rent_")]
    other_columns = [
        f"{metric}_score"
        for metric, table in zip(scorer.weights["metric"], scorer.weights["table"])
        if table.strip().lower() == "obt" and not metric.startswith("rent_")
    ]
    complete = scorer.obt.dropna(subset=other_columns)
    # every rent the three households use
    complete = complete.dropna(subset=[
        "rent_2br_flat_score", "rent_2br_house_score", "rent_3br_house_score", "rent_1br_flat_score",
    ])
    languages = scorer.languages[scorer.languages["language"].isin([h["selected_language"] for h in HOUSEHOLDS])]
    with_language = languages.dropna(subset=["language_score"]).groupby("suburb_id").size()
    complete = complete[complete.index.isin(with_language[with_language == len(HOUSEHOLDS)].index)]
    infra = scorer.infrastructure.dropna(subset=["infra_score"])["suburb_id"].unique()
    complete = complete[complete.index.isin(infra)]
    chosen = sorted(complete.index)[:SUBURBS]
    print(f"{len(complete)} suburbs have every figure, keeping {len(chosen)}")

    cases = []
    for household in HOUSEHOLDS:
        rows = scorer.calculate_scores(**household)
        expected = {
            str(row["suburb_id"]): {key: row[key] for key in OUTPUTS}
            for row in rows
            if str(row["suburb_id"]) in chosen
        }
        cases.append({"household": household, "expected": expected})

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"suburbs": chosen, "cases": cases}, indent=1))
    print(f"wrote {OUT.relative_to(REPO)}")


if __name__ == "__main__":
    main()
