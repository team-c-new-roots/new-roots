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

And where Gold filled a gap from somewhere else that came out too low (a copy
of one of those figures, or a council figure from fewer than 15 leases), it
uses the nearest suburb with a trusted figure of its own instead. Figures only
ever go up, so it never makes a suburb look cheaper, and the app marks each one
as an estimate from the council area or nearby suburbs.
"""

import csv
import math
from collections import defaultdict

TYPES = ["1br_flat", "2br_flat", "3br_flat", "2br_house", "3br_house", "4br_house"]
# 40% rather than 30%: at 30% it also caught suburbs that are simply the
# cheaper end of their council, like Ashburton and Altona 4 bedroom houses,
# with plenty of leases behind them
FAR_BELOW = 0.6
FEW_LEASES = 15
# how far to look for a suburb to borrow from, the furthest Gold borrows
NEARBY_KM = 45
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


def positions_from(geojson_path):
    """Each suburb's label point from the app's suburbs.geojson, for distances."""
    import json

    if not geojson_path.exists():
        return None
    features = json.loads(geojson_path.read_text(encoding="utf-8"))["features"]
    return {
        str(feature["properties"]["suburb_id"]): (feature["properties"]["label_lat"], feature["properties"]["label_lon"])
        for feature in features
    }


def km_between(a, b):
    # flat-earth is plenty at this scale
    (lat1, lon1), (lat2, lon2) = a, b
    return math.hypot((lon1 - lon2) * math.cos(math.radians((lat1 + lat2) / 2)), lat1 - lat2) * 111.2


def council_leases(gold):
    """New leases a year in each council area by bedrooms, worked back from
    the affordable lettings table (that many affordable, at that share)."""
    leases = {}
    path = gold / "new_roots_affordable_lettings.csv"
    if not path.exists():
        return leases
    with path.open(newline="", encoding="utf-8-sig") as file:
        for row in csv.DictReader(file):
            share = number(row.get("affordable_lettings_share"))
            count = number(row.get("affordable_lettings"))
            if share and count is not None:
                leases[(row["lga_name"].strip(), row["dwelling_type"].strip())] = round(count * 100 / share)
    return leases


def borrowed(obt_rows, gold, found, positions):
    """Rents Gold filled in from somewhere else that came out too low.

    Gold gives a suburb with no figure the nearest suburb's own figure. Where
    that suburb's figure is one we swapped, the copy is just as wrong
    (Darraweit Guim had Craigieburn's $283). And a council figure from
    fewer than 15 new leases is no steadier than a suburb's. Either way this
    uses the nearest suburb with a trusted figure of its own instead, the way
    Gold fills a gap, but only when that's higher, and within NEARBY_KM."""
    shares = council_shares(gold)
    leases = council_leases(gold)
    changed = {}
    for home in TYPES:
        own = [
            row
            for row in obt_rows
            if (row.get(f"rent_{home}_infilling_method") or "").strip() == "suburb"
            and number(row.get(f"rent_{home}_value")) is not None
            and row["suburb_id"].strip() in positions
        ]
        trusted = [row for row in own if (row["suburb_id"].strip(), home) not in found]
        bedrooms = f"{home[0]} bedroom"
        for row in obt_rows:
            suburb_id = row["suburb_id"].strip()
            method = (row.get(f"rent_{home}_infilling_method") or "").strip()
            value = number(row.get(f"rent_{home}_value"))
            if value is None or suburb_id not in positions or method not in ("proximity", "lga"):
                continue
            here = positions[suburb_id]
            by_distance = lambda other: km_between(here, positions[other["suburb_id"].strip()])
            if method == "proximity":
                # the donor is the nearest suburb whose own figure this is.
                # Gold measures distance its own way, so look past the very nearest
                matches = [other for other in own if abs(number(other[f"rent_{home}_value"]) - value) < 0.5]
                donor = min(matches, key=by_distance, default=None)
                if donor is None or by_distance(donor) > NEARBY_KM or (donor["suburb_id"].strip(), home) not in found:
                    continue
                reason, count = "copied a swapped figure", None
            else:
                council = max(shares.get(suburb_id, [("", 0)]), key=lambda pair: pair[1])[0]
                count = leases.get((council, bedrooms))
                if count is None or count >= FEW_LEASES:
                    continue
                reason = "council figure from few leases"
            best = min(trusted, key=by_distance, default=None)
            if best is not None and by_distance(best) <= NEARBY_KM:
                replacement, source = number(best[f"rent_{home}_value"]), best["suburb_name"].strip()
            elif method == "proximity":
                # nothing trusted in reach, so follow the donor to its new figure
                replacement = found[(donor["suburb_id"].strip(), home)][1]
                source = f"{donor['suburb_name'].strip()}'s council figure"
            else:
                continue
            if replacement > value:
                changed[(suburb_id, home)] = (value, replacement, count, reason, source)
    return changed


def apply(obt_rows, gold, positions=None, report=print):
    """Swaps the figures in place and returns what changed, with Gold's own
    figure, score, rank and method for each, so the parity test can put them
    back. Without positions only the suburbs' own figures are checked."""
    found = find(obt_rows, gold)
    extra = borrowed(obt_rows, gold, found, positions) if positions else {}
    if not positions:
        report("  (no suburbs.geojson, so copied and thin council figures weren't checked)")
    changes = {key: (own, council, leases, reason, "lga", None) for key, (own, council, leases, reason) in found.items()}
    changes.update({key: (old, new, leases, reason, "proximity", donor) for key, (old, new, leases, reason, donor) in extra.items()})
    skip = {home: {key[0] for key in changes if key[1] == home} for home in TYPES}
    scale = {home: rent_scale(obt_rows, home, skip[home]) for home in TYPES}
    names = {row["suburb_id"].strip(): row["suburb_name"].strip() for row in obt_rows}
    gold_figures = {}
    for row in obt_rows:
        suburb_id = row["suburb_id"].strip()
        for home in TYPES:
            hit = changes.get((suburb_id, home))
            if not hit:
                continue
            gold_figures[(suburb_id, home)] = (
                number(row.get(f"rent_{home}_score")),
                number(row.get(f"rent_{home}_ranking")),
                (row.get(f"rent_{home}_infilling_method") or "").strip(),
            )
            row[f"rent_{home}_value"] = repr(hit[1])
            row[f"rent_{home}_infilling_method"] = hit[4]
            # Gold's score and rank came from the skewed figure, and budget
            # fit uses the score, so give the new figure the score and rank
            # Gold gives that rent elsewhere
            score, rank = scale[home](hit[1])
            row[f"rent_{home}_score"] = repr(score)
            row[f"rent_{home}_ranking"] = str(rank)
    for (suburb_id, home), (old, new, leases, reason, method, donor) in sorted(
        changes.items(), key=lambda item: (item[1][3], names[item[0][0]])
    ):
        source = f"council ${new:.0f}" if method == "lga" else f"${new:.0f} from {donor}"
        count = "" if leases is None else f", {int(leases)} leases"
        report(f"  {names[suburb_id]} {home}: ${old:.0f} -> {source} ({reason}{count})")
    return {key: (*hit[:4], *gold_figures[key]) for key, hit in changes.items()}
