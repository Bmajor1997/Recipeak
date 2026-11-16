"""Flags recipes whose ingredients suggest an allergen the recipe doesn't list. Run after build_recipes.py."""
import json, re, sys
from pathlib import Path
R = json.loads((Path(__file__).resolve().parent.parent / "data/recipes/recipes.json").read_text())
RULES = {
    "milk": r"\b(butter|milk|cream(?! of coconut)|cheese|cheddar|mozzarella|parmesan|pecorino|ricotta|feta|paneer|yogurt|ghee|crema|queso|gruy|provolone|swiss|kibbeh|irish cream|sour cream|buttermilk|half-and-half|mascarpone)\b",
    "eggs": r"\b(eggs?|egg yolks?|yolks?|mayonnaise|mayo|egg noodles|eggnog|brioche|challah)\b",
    "wheat": r"\b(flour|bread|breadcrumbs|panko|pasta|spaghetti|fettuccine|linguine|macaroni|ziti|lasagna|noodles|tortillas?\b(?!.*corn)|pita|pide|baguette|rolls?|buns?|croutons|crackers|couscous|bulgur|soy sauce|beer|stout|lager|wrappers|pastry|pie crusts?|waffle|naan|roti|paratha|pav|dough|gingersnap|muffins|saltine|udon|ramen|vermicelli(?!.*rice))\b",
    "soy": r"\b(soy|tofu|edamame|miso|kecap|tamari|hoisin|maggi)\b",
    "fish": r"\b(fish|anchov|cod|salmon|haddock|tuna|bonito|dashi|worcestershire|eel|unagi|saltfish)\b",
    "shellfish": r"\b(shrimp|prawn|crab|clam|mussel|lobster|scallop|oyster sauce|squid|octopus|crayfish|bagoong|shrimp paste|clamato)\b",
    "peanuts": r"\b(peanut)",
    "tree nuts": r"\b(almond|walnut|pecan|cashew|pistachio|pine nuts|hazelnut|orgeat|amaretto|noyaux|coconut)\b",
    "sesame": r"\b(sesame|tahini)\b",
}
flags = []
for stem, v in R.items():
    r = v["recipe"]
    text = " ".join(i["item"] + " " + i["unit"] for i in r["ingredients"]).lower()
    for allergen, pat in RULES.items():
        if allergen not in r["allergens"] and re.search(pat, text):
            hit = re.search(pat, text).group(0)
            flags.append(f"{stem}: missing {allergen}? ({hit})")
print("\n".join(flags)); print(len(flags), "flags")
