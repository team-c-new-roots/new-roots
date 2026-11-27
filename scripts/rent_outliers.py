"""Rent figures we don't trust, and the council figure to use instead.

The Rental Report counts every new bond, community housing included, so a
suburb with a new block of community housing can show a median far below what
a private renter pays (Brighton East's 1 bedroom flats were $272 in June 2026
against $510 for Bayside, after 150 community flats for over-55s opened).
And a median from a handful of leases moves a long way on one cheap one.

Gold keeps the suburb's own figure. Until the pipeline does this itself, both
export scripts use this to swap in the council area's figure when a suburb's
own one is either

  - more than 40% below its council area's, or
  - from fewer than 15 new leases a year and below its council area's.

Only figures below the council's are swapped, so it never makes a suburb look
cheaper. The app then marks the rent as estimated from the council area, the
same as suburbs with no figure of their own.
"""

import csv
from collections import defaultdict

TYPES = ["1br_flat", "2br_flat", "3br_flat", "2br_house", "3br_house", "4br_house"]
# 40% rather than 30%: at 30% it also caught suburbs that are simply the
# cheaper end of their council, like Ashburton and Altona 4 bedroom houses,
# with plenty of leases behind them
FAR_BELOW = 0.6
FEW_LEASES = 15
# a suburb counts as wholly in one council when this much of it is
ONE_COUNCIL = 0.99
# and its council figures only count when the suburbs that use them agree
AGREE = 0.02


def number(text):
    text = (text or "").strip()
    return float(text) if text else None


def council_shares(gold):
    shares = defaultdict(list)
    with (gold / "suburb_lga_mapping.csv").open(newline="", encoding="utf-8-sig") as file:
        for row in csv.DictReader(file):
            shares[row["suburb_id"].strip()].append((row["lga_name"].strip(), float(row["lga_weighting"])))
    return shares


def council_rents(obt_rows, shares):
    """Each council's figure for each home type, read back from the suburbs
    that Gold gave the council figure to. Councils where those suburbs
    disagree are left out, since Gold borrowed from elsewhere for them."""
    seen = defaultdict(list)
    for row in obt_rows:
        own = shares.get(row["suburb_id"].strip()) or []
        if not own:
            continue
        council, weight = max(own, key=lambda pair: pair[1])
        if weight < ONE_COUNCIL:
            continue
        for home in TYPES:
            value = number(row.get(f"rent_{home}_value"))
            if value is not None and (row.get(f"rent_{home}_infilling_method") or "").strip() == "lga":
                seen[(council, home)].append(value)
    return {
        key: sorted(values)[len(values) // 2]
        for key, values in seen.items()
        if max(values) - min(values) <= AGREE * min(values)
    }


def council_rent(suburb_id, home, shares, councils):
    parts = [(councils.get((name, home)), weight) for name, weight in shares.get(suburb_id, [])]
    parts = [(value, weight) for value, weight in parts if value is not None]
    total = sum(weight for _, weight in parts)
    if total < 0.9:
        return None
    return sum(value * weight for value, weight in parts) / total


def find(obt_rows, gold):
    """{(suburb_id, home): (own figure, council figure, leases, reason)}"""
    shares = council_shares(gold)
    councils = council_rents(obt_rows, shares)
    found = {}
    for row in obt_rows:
        suburb_id = row["suburb_id"].strip()
        for home in TYPES:
            if (row.get(f"rent_{home}_infilling_method") or "").strip() != "suburb":
                continue
            own = number(row.get(f"rent_{home}_value"))
            council = council_rent(suburb_id, home, shares, councils)
            if own is None or council is None or own >= council:
                continue
            leases = number(row.get(f"rental_availability_{home}_value"))
            if own < FAR_BELOW * council:
                found[(suburb_id, home)] = (own, council, leases, "far below council")
            elif leases is not None and leases < FEW_LEASES:
                found[(suburb_id, home)] = (own, council, leases, "few leases")
    return found


def rent_scale(obt_rows, home, skip):
    """Gold's score for a rent rises steadily as the rent falls, and its rank
    is the rent's place among all suburbs, cheapest first. This scores any rent
    the same way from Gold's own figures, leaving out the swapped suburbs."""
    points = sorted(
        (number(row.get(f"rent_{home}_value")), number(row.get(f"rent_{home}_score")))
        for row in obt_rows
        if row["suburb_id"].strip() not in skip
        and number(row.get(f"rent_{home}_value")) is not None
        and number(row.get(f"rent_{home}_score")) is not None
    )
    rents = [rent for rent, _ in points]

    def score_and_rank(rent):
        rank = 1 + sum(1 for other in rents if other < rent)
        if rent <= points[0][0]:
            return points[0][1], rank
        if rent >= points[-1][0]:
            return points[-1][1], rank
        for (low, low_score), (high, high_score) in zip(points, points[1:]):
            if low <= rent <= high:
                if high == low:
                    return low_score, rank
                share = (rent - low) / (high - low)
                return round(low_score + share * (high_score - low_score), 2), rank

    return score_and_rank


def apply(obt_rows, gold, report=print):
    """Swaps the figures in place and returns what changed, with Gold's own
    figure, score and rank for each, so the parity test can put them back."""
    found = find(obt_rows, gold)
    scale = {home: rent_scale(obt_rows, home, {key[0] for key in found if key[1] == home}) for home in TYPES}
    names = {row["suburb_id"].strip(): row["suburb_name"].strip() for row in obt_rows}
    gold_figures = {}
    for row in obt_rows:
        suburb_id = row["suburb_id"].strip()
        for home in TYPES:
            hit = found.get((suburb_id, home))
            if hit:
                gold_figures[(suburb_id, home)] = (
                    number(row.get(f"rent_{home}_score")),
                    number(row.get(f"rent_{home}_ranking")),
                )
                row[f"rent_{home}_value"] = repr(hit[1])
                row[f"rent_{home}_infilling_method"] = "lga"
                # Gold's score and rank came from the skewed figure, and budget
                # fit uses the score, so give the council figure the score and
                # rank Gold gives that rent elsewhere
                score, rank = scale[home](hit[1])
                row[f"rent_{home}_score"] = repr(score)
                row[f"rent_{home}_ranking"] = str(rank)
    for (suburb_id, home), (own, council, leases, reason) in sorted(found.items(), key=lambda item: names[item[0][0]]):
        count = "?" if leases is None else int(leases)
        report(f"  {names[suburb_id]} {home}: ${own:.0f} -> council ${council:.0f} ({reason}, {count} leases)")
    return {key: (*hit, *gold_figures[key]) for key, hit in found.items()}
