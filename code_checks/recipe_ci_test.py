"""Tests for the automated recipe consistency and allergen review checks."""
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("check_allergens", ROOT / "scripts/check_allergens.py")
allergens = importlib.util.module_from_spec(spec)
spec.loader.exec_module(allergens)


class AllergenReviewTests(unittest.TestCase):
    def test_explicit_substitutes_do_not_hide_separate_allergens(self):
        recipe = {"ingredients": [{"item": "vegan butter and milk", "unit": ""}, {"item": "coconut milk", "unit": ""}], "allergens": []}
        flags = allergens.find_flags({"soup": {"recipe": recipe}})
        self.assertEqual(len(flags), 1)
        self.assertIn("missing milk", flags[0])
        recipe["ingredients"] = [{"item": "coconut milk and peanut butter", "unit": ""}]
        flags = allergens.find_flags({"soup": {"recipe": recipe}})
        self.assertFalse(any("missing milk" in flag for flag in flags))
        self.assertTrue(any("missing peanuts" in flag for flag in flags))

    def test_garnishes_are_checked(self):
        recipe = {"ingredients": [], "allergens": [], "cocktail": {"garnish": "sesame seeds"}}
        self.assertIn("missing sesame", allergens.find_flags({"drink": {"recipe": recipe}})[0])

    def test_review_is_scoped_to_exact_ingredients_and_expires(self):
        recipes = {"soup": {"recipe": {"ingredients": [{"item": "butter", "unit": "tbsp"}], "allergens": []}}}
        findings = allergens.find_findings(recipes)
        exception = {"id": findings[0]["id"], "reason": "Reviewed example", "reviewed_by": "test reviewer", "expires": "2026-12-01"}
        self.assertEqual(allergens.unreviewed_findings(findings, [exception], date(2026, 11, 22)), [])
        self.assertEqual(allergens.unreviewed_findings(findings, [exception], date(2026, 12, 2)), findings)
        recipes["soup"]["recipe"]["ingredients"][0]["item"] = "butter and cream"
        changed = allergens.find_findings(recipes)
        self.assertEqual(allergens.unreviewed_findings(changed, [exception], date(2026, 11, 22)), changed)
        with self.assertRaises(ValueError):
            allergens.unreviewed_findings(findings, [{"id": exception["id"]}])

    def test_reports_missing_allergens_in_original_and_diet_version(self):
        recipes = {"soup": {"recipe": {"ingredients": [{"item": "butter", "unit": "tbsp"}], "allergens": []},
                           "variants": {"vegan": {"ingredients": [{"item": "cashews", "unit": "cup"}], "allergens": []},
                                        "vegetarian": "same"}}}
        flags = allergens.find_flags(recipes)
        self.assertTrue(any("soup (standard): missing milk" in f for f in flags))
        self.assertTrue(any("soup (vegan): missing tree nuts" in f for f in flags))

    def test_does_not_report_an_allergen_already_listed(self):
        recipes = {"soup": {"recipe": {"ingredients": [{"item": "butter", "unit": "tbsp"}], "allergens": ["milk"]}}}
        self.assertEqual(allergens.find_flags(recipes), [])


class RecipeConsistencyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for folder in ("scripts", "data/recipes", "data/curated-photos", "apps/mobile/src/recipes"):
            shutil.copytree(ROOT / folder, self.root / folder, dirs_exist_ok=True)

    def run_check(self):
        return subprocess.run([sys.executable, str(self.root / "scripts/check_recipe_consistency.py")],
                              capture_output=True, text=True)

    def test_vegan_butter_lettuce_is_not_dairy_but_real_butter_is(self):
        pending = self.root / "data/recipes/pending"
        pending.mkdir(exist_ok=True)
        source = pending / "butter-lettuce-regression.txt"
        text = """@ butter-lettuce-regression | Lettuce Salad | 1 | 5 | 0 | - | A small green salad.
- 1 | | butter lettuce
- 1 | tsp | olive oil
# Wash and dry the lettuce, tear into a bowl and dress with oil.
@@ vegetarian = same
@@ vegan = same
"""
        source.write_text(text, encoding="utf-8")
        command = [sys.executable, str(self.root / "scripts/build_recipes.py")]
        good = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(good.returncode, 0, good.stdout + good.stderr)
        source.write_text(text.replace("- 1 | | butter lettuce", "- 1 | tbsp | butter"), encoding="utf-8")
        bad = subprocess.run(command, capture_output=True, text=True)
        self.assertNotEqual(bad.returncode, 0)
        self.assertIn("still has butter", bad.stdout)

    def test_current_data_agrees(self):
        result = self.run_check()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_modified_app_recipe_is_detected(self):
        path = self.root / "apps/mobile/src/recipes/collection.json"
        recipes = json.loads(path.read_text(encoding="utf-8"))
        recipes[next(iter(recipes))]["title"] = "A changed title"
        path.write_text(json.dumps(recipes), encoding="utf-8")
        result = self.run_check()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("collection.json", result.stderr)

    def test_changed_source_requires_regeneration(self):
        path = self.root / "data/recipes/src/cocktails-02.txt"
        source = path.read_text(encoding="utf-8")
        self.assertIn("Scotch and amaretto over ice.", source)
        path.write_text(source.replace("Scotch and amaretto over ice.", "A different description.", 1), encoding="utf-8")
        result = self.run_check()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("godfather", result.stderr)

    def test_modified_variant_is_detected(self):
        path = self.root / "apps/mobile/src/recipes/collectionVariants.json"
        versions = json.loads(path.read_text(encoding="utf-8"))
        versions.pop(next(iter(versions)))
        path.write_text(json.dumps(versions), encoding="utf-8")
        result = self.run_check()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("collectionVariants.json", result.stderr)


if __name__ == "__main__":
    unittest.main()
