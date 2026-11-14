# Meals and Mixers

<p align="center">
  <img src="assets/app-icon.png" alt="Meals and Mixers app icon: a plated dish with tomato and asparagus beside a pink cocktail garnished with a grapefruit slice" width="256">
</p>

Meals and Mixers is in the idea phase.

## What's here so far

- `assets/app-icon.png` — the front-facing app image.
- `.github/workflows/security-checks.yml` — code quality and security CI, ported from Votic. Runs on every push and pull request, and weekly.
- `.github/workflows/release-sbom.yml` — attaches a software bill of materials to each published release.
- `.github/dependabot.yml` — weekly updates for npm packages and the pinned GitHub Actions.
- `.github/CODEOWNERS` — review ownership.
- `security/` — scan verifiers, the dependency-exception gate and the vulnerability report.
- `docs/security/SECURITY-BASELINE.md` — the security standards this app targets.
- `.gitleaks.toml`, `.gitleaksignore`, `osv-scanner.toml` — scanner configuration and exception lists.

Run the security tooling tests with:

```sh
node --test code_checks/*.test.js
```
