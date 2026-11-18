"""Compare source recipes with committed generated data without changing the checkout."""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    with tempfile.TemporaryDirectory(prefix="recipeek-check-") as tmp:
        root = Path(tmp)
        for relative in ("scripts/build_recipes.py", "data/curated-photos/manifest.json"):
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / relative, target)
        shutil.copytree(ROOT / "data/recipes/src", root / "data/recipes/src")
        proc = subprocess.run([sys.executable, str(root / "scripts/build_recipes.py")], capture_output=True, text=True)
        if proc.returncode:
            print(proc.stdout, proc.stderr, sep="\n", file=sys.stderr)
            return 1
        generated = read_json(root / "data/recipes/recipes.json")
        manifest = read_json(ROOT / "data/curated-photos/manifest.json")
        visible = [p["file"][:-4] for p in manifest["photos"] if not p.get("hidden")]
        missing = [stem for stem in visible if stem not in generated]
        if missing:
            print("Visible photos have no source recipe: " + ", ".join(missing), file=sys.stderr)
            return 1
        expected = {
            "data/recipes/recipes.json": generated,
            "apps/mobile/src/recipes/collection.json": {s: generated[s]["recipe"] for s in visible},
            "apps/mobile/src/recipes/collectionVariants.json": {
                s: generated[s]["variants"] for s in visible if generated[s].get("variants")
            },
        }
        errors = []
        for path, want in expected.items():
            try:
                actual = read_json(ROOT / path)
            except (OSError, ValueError) as exc:
                errors.append(f"{path}: could not read JSON ({exc})")
                continue
            if actual != want:
                changed = sorted(k for k in set(actual) | set(want) if actual.get(k) != want.get(k))
                errors.append(f"{path}: differs for {', '.join(changed[:20])}" + (" ..." if len(changed) > 20 else ""))
        if errors:
            print("Generated recipe data does not match its sources:\n" + "\n".join(errors), file=sys.stderr)
            print("Run scripts/build_recipes.py and scripts/make_collection.py and commit the generated data.", file=sys.stderr)
            return 1
        print(f"Recipe sources and generated data agree for {len(visible)} visible dishes.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
