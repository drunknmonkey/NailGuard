#!/usr/bin/env python3
"""Wegwerf-Spike: wertet spike-log.csv aus.

Berechnet die durchschnittliche effektive Detection-Rate (Callbacks/s) je
beobachtetem Zustand. Die Test-Phasen lassen sich aus den Spalten ableiten:

  Vordergrund (fokussiert)   : hasFocus=true,  visibilityState=visible
  Unfokussiert, sichtbar     : hasFocus=false, visibilityState=visible
  Verdeckt / Minimiert       : visibilityState=hidden
                               (macOS meldet beides als "hidden"; die zeitliche
                                Reihenfolge in der CSV trennt verdeckt vs. minimiert)

Aufruf:
    python3 spike/analyze.py [pfad/zur/spike-log.csv]

Ohne Argument wird ~/Desktop/nailguard-spike-log.csv gelesen.
"""
import csv
import os
import sys
from collections import defaultdict


def phase_label(visibility, has_focus):
    if visibility == "hidden":
        return "verdeckt/minimiert (hidden)"
    if has_focus == "true":
        return "Vordergrund (fokussiert, sichtbar)"
    return "unfokussiert, sichtbar"


def main():
    default = os.path.expanduser("~/Desktop/nailguard-spike-log.csv")
    path = sys.argv[1] if len(sys.argv) > 1 else default
    if not os.path.exists(path):
        sys.exit(f"Datei nicht gefunden: {path}")

    rows = []
    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            try:
                row["callbacks_letzte_sekunde"] = int(row["callbacks_letzte_sekunde"])
                row["sekunden_seit_start"] = int(row["sekunden_seit_start"])
            except (ValueError, KeyError):
                continue
            rows.append(row)

    if not rows:
        sys.exit("Keine auswertbaren Zeilen gefunden.")

    buckets = defaultdict(list)
    for row in rows:
        label = phase_label(row["visibilityState"], row["hasFocus"].lower())
        buckets[label].append(row["callbacks_letzte_sekunde"])

    print(f"Quelle: {path}")
    print(f"Samples: {len(rows)}  Dauer: {rows[-1]['sekunden_seit_start']} s\n")
    print(f"{'Phase':40} {'Samples':>8} {'Ø /s':>8} {'min':>5} {'max':>5}")
    print("-" * 70)
    for label in sorted(buckets):
        vals = buckets[label]
        avg = sum(vals) / len(vals)
        print(f"{label:40} {len(vals):>8} {avg:>8.1f} {min(vals):>5} {max(vals):>5}")

    print("\nZeitreihe (Sekunde : Callbacks  visibility/hasFocus):")
    for row in rows:
        print(
            f"  {row['sekunden_seit_start']:>4} : {row['callbacks_letzte_sekunde']:>3}"
            f"   {row['visibilityState']}/{row['hasFocus']}"
        )


if __name__ == "__main__":
    main()
