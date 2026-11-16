"""Builds data/recipes/recipes.json from the hand-written recipe files in data/recipes/src/.

Each source file holds recipes in a compact text form:

    @ file-stem | Title | servings | prep minutes | cook minutes | allergens, comma separated | Description
    - amount | unit | ingredient
    # step
    G glass | garnish | y or n (alcoholic) | non-alcoholic version, or -     (cocktails only)
    ! note                                                                    (optional)

Run from the repo root:  python3 scripts/build_recipes.py
It checks every recipe against the app's rules and the photo manifest, and refuses to write if anything is wrong.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "recipes" / "src"
OUT = ROOT / "data" / "recipes" / "recipes.json"
ALLERGENS = {"milk", "eggs", "fish", "shellfish", "tree nuts", "peanuts", "wheat", "soy", "sesame"}
NOTES = {
    "meal": "A representative home version. Restaurants and regions make it in many ways, and this isn't any one restaurant's recipe.",
    "cocktail": "A classic home version. Bars vary the proportions, and this isn't any one bar's recipe. Please drink responsibly.",
}

manifest = json.loads((ROOT / "data" / "curated-photos" / "manifest.json").read_text())
kinds = {p["file"][:-4]: p["kind"] for p in manifest["photos"]}
problems, recipes = [], {}


def fail(stem, msg):
    problems.append(f"{stem}: {msg}")


for path in sorted(SRC.glob("*.txt")):
    current = None
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        tag, rest = line[0], line[1:].strip()
        if tag == "@":
            parts = [p.strip() for p in rest.split("|")]
            if len(parts) != 7:
                problems.append(f"{path.name}: bad header {line[:60]}")
                current = None
                continue
            stem, title, serv, prep, cook, allergens, desc = parts
            current = {"stem": stem, "title": title, "description": desc, "servings": int(serv), "prep_minutes": int(prep),
                       "cook_minutes": int(cook), "ingredients": [], "steps": [],
                       "allergens": [a.strip() for a in allergens.split(",") if a.strip() and a.strip() != "-"],
                       "cocktail": None, "note": None}
            if stem in recipes:
                fail(stem, "written twice")
            recipes[stem] = current
        elif current is None:
            problems.append(f"{path.name}: line outside a recipe: {line[:60]}")
        elif tag == "-":
            parts = [p.strip() for p in rest.split("|")]
            if len(parts) != 3:
                fail(current["stem"], f"bad ingredient {rest}")
                continue
            current["ingredients"].append({"amount": parts[0], "unit": parts[1], "item": parts[2]})
        elif tag == "#":
            current["steps"].append(rest)
        elif tag == "G":
            parts = [p.strip() for p in rest.split("|")]
            if len(parts) != 4 or parts[2] not in ("y", "n"):
                fail(current["stem"], f"bad cocktail line {rest}")
                continue
            current["cocktail"] = {"glass": parts[0], "garnish": "" if parts[1] == "-" else parts[1], "alcoholic": parts[2] == "y",
                                   "non_alcoholic_version": None if parts[3] == "-" else parts[3]}
        elif tag == "!":
            current["note"] = rest
        else:
            problems.append(f"{path.name}: unknown line {line[:60]}")

out = {}
for stem, r in recipes.items():
    kind = kinds.get(stem)
    if not kind:
        fail(stem, "no photo with this file name")
        continue
    if kind == "cocktail" and r["cocktail"] is None:
        fail(stem, "cocktail without a G line")
    if kind == "meal" and r["cocktail"] is not None:
        fail(stem, "meal with a G line")
    bad = set(r["allergens"]) - ALLERGENS
    if bad:
        fail(stem, f"unknown allergens {bad}")
    if not (1 <= len(r["ingredients"]) <= 40) or not (1 <= len(r["steps"]) <= 30):
        fail(stem, "needs 1-40 ingredients and 1-30 steps")
    if not (1 <= r["servings"] <= 100) or r["prep_minutes"] > 2880 or r["cook_minutes"] > 2880:
        fail(stem, "servings or minutes out of range")
    if len(r["title"]) > 120 or len(r["description"]) > 600 or any(len(s) > 600 for s in r["steps"]):
        fail(stem, "text too long")
    for i in r["ingredients"]:
        if len(i["amount"]) > 40 or len(i["unit"]) > 40 or len(i["item"]) > 200 or not i["item"]:
            fail(stem, f"bad ingredient {i}")
    note = r["note"] or NOTES[kind]
    out[stem] = {"kind": kind, "recipe": {k: r[k] for k in ("title", "description", "servings", "prep_minutes", "cook_minutes",
                                                            "ingredients", "steps")} | {"allergens": sorted(set(r["allergens"])),
                                                                                         "cocktail": r["cocktail"], "note": note}}

missing = sorted(set(kinds) - set(out))
if problems:
    print("\n".join(problems))
    sys.exit(1)
OUT.write_text(json.dumps(dict(sorted(out.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"{len(out)} recipes written; {len(missing)} photos still without a recipe")
if "--list-missing" in sys.argv:
    print(" ".join(missing))
