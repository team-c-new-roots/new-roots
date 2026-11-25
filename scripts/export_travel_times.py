"""Public transport travel times between suburbs, for US 4.2.

  public/data/travel/<destination id>.json

One file per destination, so the app only downloads the suburbs someone
picks as places they need to get to. The data team worked these out from the
middle of every suburb to the middle of every other, on a Wednesday arriving
by 8:30 am. Each file has

  t     minutes by public transport, 0 for the same suburb
  walk  minutes on foot, where walking beats any public transport

and any suburb in neither has no way there by 8:30 am.

  python3 scripts/export_travel_times.py pipeline/gold/travel_times
"""

import argparse
import csv
import json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("folder", type=Path, help="the travel_times folder in Gold")
    parser.add_argument("--out", type=Path, default=REPO / "public" / "data" / "travel")
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    for old in args.out.glob("*.json"):
        old.unlink()

    files = sorted(args.folder.glob("*.csv"))
    counts = {}
    for path in files:
        with path.open(newline="", encoding="utf-8-sig") as file:
            rows = list(csv.DictReader(file))
        destination = rows[0]["destination_suburb_id"].strip()
        times, walks = {}, {}
        for row in rows:
            origin = row["origin_suburb_id"].strip()
            status = row["status"].strip()
            counts[status] = counts.get(status, 0) + 1
            text = row["pt_travel_time"].strip()
            if status == "same_centroid":
                times[origin] = 0
            elif status == "ok" and text:
                times[origin] = round(float(text))
            elif status == "walk_only" and text:
                walks[origin] = round(float(text))
            elif status != "no_eligible_route":
                print(f"skipped {origin} to {destination}, status {status!r}")
        out = {"t": times, "walk": walks}
        (args.out / f"{destination}.json").write_text(json.dumps(out, separators=(",", ":")))

    size = sum(path.stat().st_size for path in args.out.glob("*.json"))
    print(f"wrote {len(files)} files to {args.out.relative_to(REPO)} ({size // 1024} KB), {counts}")


if __name__ == "__main__":
    main()
