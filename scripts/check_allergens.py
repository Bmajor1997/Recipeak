"""Flags recipes whose ingredients suggest an allergen the recipe doesn't list. Run after build_recipes.py."""
import json
import re
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
RULES = {
    "milk": r"\b(butter|milk|cream(?! of coconut)|cheese|cheddar|mozzarella|parmesan|pecorino|ricotta|feta|paneer|yogurt|ghee|crema|queso|gruy|provolone|swiss|kibbeh|irish cream|sour cream|buttermilk|half-and-half|mascarpone)\b",
    "eggs": r"\b(eggs?|egg yolks?|yolks?|mayonnaise|mayo|egg noodles|eggnog|brioche|challah)\b",
    "wheat": r"\b(flour|bread|breadcrumbs|panko|pasta|spaghetti|fettuccine|linguine|macaroni|ziti|lasagna|noodles|tortillas?\b(?!.*corn)|pita|pide|baguette|rolls?|buns?|croutons|crackers|couscous|bulgur|soy sauce|beer|stout|lager|wrappers|pastry|pie crusts?|waffle|naan|roti|paratha|pav|dough|gingersnap|muffins|saltine|udon|ramen|vermicelli(?!.*rice))\b",
    "soy": r"\b(soy|tofu|edamame|miso|kecap|tamari|hoisin|maggi)\b",
    "fish": r"\b(fish|anchov|cod|salmon|haddock|tuna|bonito|dashi|worcestershire|eel|unagi|saltfish)\b",
    "shellfish": r"\b(shrimp|prawn|crab|clam|mussel|lobster|scallop|oyster sauce|squid|octopus|crayfish|bagoong|shrimp paste|clamato)\b",
    "peanuts": r"\b(peanut)",
    "tree nuts": r"\b(almonds?|walnuts?|pecans?|cashews?|pistachios?|pine nuts|hazelnuts?|macadamias?|brazil nuts?|orgeat|amaretto|noyaux|frangelico|nutella|praline|marzipan)\b",
    "sesame": r"\b(sesame|tahini)\b",
}
def find_flags(recipes):
    """Keyword-based review suggestions; a flag is not proof of an allergen."""
    flags = []
    for stem, entry in sorted(recipes.items()):
        versions = [("standard", entry["recipe"])]
        versions += [(name, recipe) for name, recipe in entry.get("variants", {}).items() if isinstance(recipe, dict)]
        for name, recipe in versions:
            text = " ".join(i["item"] + " " + i["unit"] for i in recipe["ingredients"]).lower()
            for allergen, pattern in RULES.items():
                match = re.search(pattern, text)
                if allergen not in recipe["allergens"] and match:
                    flags.append(f"{stem} ({name}): missing {allergen}? ({match.group(0)})")
    return flags


def main():
    recipes = json.loads((ROOT / "data/recipes/recipes.json").read_text(encoding="utf-8"))
    flags = find_flags(recipes)
    print("# Possible allergen issues for human review\n")
    print("Keyword matches may be false positives and cannot establish allergy safety. Check ingredients and product labels.\n")
    print(f"{len(flags)} possible issues found across standard recipes and written diet versions.\n")
    for flag in flags:
        print(f"- {flag}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
