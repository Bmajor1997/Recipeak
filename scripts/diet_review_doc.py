"""Writes data/recipes/diet-review.md from the diet audit table.

Make the table, then run this from the repo root:
    (cd apps/mobile && DIET_AUDIT=/tmp/diet-audit.json npx vitest run tests/dietAudit.test.ts)
    python3 scripts/diet_review_doc.py /tmp/diet-audit.json
"""
import collections
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIETS = ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free", "low-carb", "non-alcoholic"]
NAMES = {"vegetarian": "Vegetarian", "vegan": "Vegan", "gluten-free": "Gluten-free", "dairy-free": "Dairy-free", "nut-free": "Nut-free"}

# Brands named in the recipes so a brand-dependent ingredient fits its diet. Checked November 2026.
BRANDS = [
    ("Dolin vermouth (Rouge, Dry, Blanc)", "vegan", "Barnivore, company email Sept 2024; Waitrose label"),
    ("Lillet (all)", "vegan", "Barnivore, company email Apr 2018; lillet.com"),
    ("Guinness (all)", "vegan", "Barnivore, company emails 2021–22"),
    ("Miller High Life", "vegan", "Barnivore, MillerCoors email"),
    ("Moët & Chandon Champagne", "vegan", "Barnivore, company email"),
    ("Mionetto Organic Prosecco", "vegan", "US retail label (Hannaford)"),
    ("Tio Pepe fino sherry", "vegan", "Barnivore, González Byass email Feb 2022; Ocado label"),
    ("La Gitana manzanilla", "vegan", "Enotria and Laithwaites labels"),
    ("Harveys amontillado", "vegan", "Enotria label"),
    ("Barbadillo Oloroso Seco", "vegan", "Grapevine label"),
    ("Cockburn's Special Reserve port", "vegan", "Barnivore, company email May 2019"),
    ("Bonterra white wines", "vegan", "Bonterra site; Barnivore company email"),
    ("Yellow Tail red wines", "vegan", "Healthline and Domino, citing Barnivore"),
    ("Disaronno", "nut-free", "AAAAI Ask the Expert; Disaronno statement"),
    ("Lea & Perrins Worcestershire (US)", "gluten-free", "Kraft Heinz product page"),
    ("Hershey's chocolate syrup", "gluten-free", "Hershey's label"),
    ("McCormick Gluten Free Taco Seasoning", "gluten-free", "McCormick; certified gluten-free (contains milk)"),
    ("Aidells Cajun Style andouille", "gluten-free", "Aidells label"),
    ("Herb-Ox bouillon", "gluten-free", "Celiac.com brand list"),
    ("Ibarra Mexican chocolate", "dairy-free", "ingredients: sugar, cacao, soy lecithin, cinnamon"),
    ("Kikkoman panko (plain)", "dairy-free", "Kikkoman ingredients: wheat flour, sugar, yeast, salt"),
]


def main(path):
    rows = json.loads(Path(path).read_text())
    counts = {d: collections.Counter() for d in DIETS}
    review = collections.defaultdict(list)
    for r in rows:
        for d in DIETS:
            if d in r["fits"]:
                counts[d]["fits"] += 1
            elif d in r["options"]:
                counts[d]["option"] += 1
            elif d in r["other"]:
                counts[d][r["other"][d].split(":")[0]] += 1
        for d, o in r["other"].items():
            if o.startswith("review"):
                review[d].append((r["title"], o[len("review: "):]))
    before = sum(6 if r["kind"] == "meal" else 7 for r in rows)
    after = sum(len(r["options"]) for r in rows)
    lines = [
        "# Diet options: items that need a person to check",
        "",
        "Made by `scripts/diet_review_doc.py` from the audit in `apps/mobile/tests/dietAudit.test.ts` (rules in",
        "`apps/mobile/src/recipes/diets.ts`, hand decisions in `apps/mobile/src/recipes/dietReview.json`).",
        "Until an item here is checked, the app shows **neither** an \"Already …\" label **nor** a \"Make it …\" option",
        "for that diet. To settle one, name a checked brand in the recipe (\"vegan sweet vermouth (such as Dolin Rouge)\")",
        "or add a decision for it to `dietReview.json` (`fits`, `option` or `none`, with the reason).",
        "",
        "## Totals",
        "",
        f"Options shown before the audit: {before} (every diet on every recipe). Now: {after}.",
        "",
        "| Diet | Already fits | Option | Can't be adapted | Needs review |",
        "|---|---|---|---|---|",
    ]
    for d in DIETS:
        c = counts[d]
        lines.append(f"| {d} | {c['fits']} | {c['option']} | {c['none']} | {c['review']} |")
    lines += [
        "",
        "## Rules used",
        "",
        "- Decided from each recipe's ingredients and garnish, never its name alone. An ingredient line's \"X or Y\" counts as fitting when Y is a real substitute (\"butter or oil\").",
        "- A word in front of an ingredient settles it for that diet only: \"vegan sweet vermouth\", \"gluten-free soy sauce\", \"dairy-free panko\", \"nut-free amaretto\", \"sugar-free simple syrup\".",
        "- An option is offered only when something must change. It is not offered when what breaks the diet is the heart of the dish: named in the title (\"Beef Pho\", \"Cheese Omelet\") or marked by hand in `dietReview.json` (ceviche, piña colada, fesenjan…).",
        "- Vegetarian: no meat, fish or gelatin, and no Parmesan or pecorino (animal rennet); a vegetarian hard cheese is the swap.",
        "- Low-carb (Ben's choice): already low-carb with no grains, bread, pasta, rice, potatoes, corn, beans, sugar, syrup, juice or sweet liqueur. Offered when the carbs are sugar, a sauce thickener, a coating or a side; not when a starch or batter is the dish, or a liqueur or juice carries a drink.",
        "- Nut-free (Ben's choice): peanuts, tree nuts and coconut all count.",
        "- Gluten: distilled spirits (whisky, vodka) and ginger beer count as gluten-free; beer, soy sauce, malt vinegar and wheat products don't.",
        "- Non-alcoholic: offered only for alcoholic drinks (every drink in the collection is alcoholic).",
        "- Labels and options are recipe checks, not allergy guarantees: they don't cover cross-contact, and brands change their recipes.",
        "",
        "## Brands named in the recipes",
        "",
        "| Brand | Settles | Source |",
        "|---|---|---|",
    ]
    lines += [f"| {b} | {d} | {s} |" for b, d, s in BRANDS]
    lines.append("")
    for d in DIETS:
        if review[d]:
            lines += [f"## Still to check: {NAMES.get(d, d)} ({len(review[d])})", ""]
            lines += [f"- **{t}**: {w}" for t, w in sorted(review[d])]
            lines.append("")
    (ROOT / "data" / "recipes" / "diet-review.md").write_text("\n".join(lines))
    print(f"{after} options; {sum(len(v) for v in review.values())} items to check")


if __name__ == "__main__":
    main(sys.argv[1])
