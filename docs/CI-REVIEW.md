# Checks and review before merging

`Assurance` is the entry point for pull requests, main-branch pushes and weekly scans. It always runs security checks; Recipeak also always runs backend, recipe and mobile checks. Native/build suites run when their input paths change. `Required assurance` fails for any failed/cancelled suite and for missing mandatory jobs. A skipped optional suite means its inputs did not change.

Protect `main` with required pull requests, `Required assurance`, `Review readiness`, resolved conversations, and up-to-date checks. Do not permit force pushes, branch deletion or administrator bypass. These are repository settings, not something a YAML file enforces. A solo owner cannot supply their own independent approval; add a second reviewer before requiring a human approval count.

Codex must review the **current PR head**, and all review conversations must be resolved. After a substantive push, request `@codex review`. For each finding, fix it and test the failure, or explain why it is accepted before resolving the conversation. A completed old review does not approve new commits. The review workflow verifies the bot identity and exact commit through GitHub APIs; it never checks out PR code with its write token.

The **Final commit review** workflow maintains one review/check report per PR. GitHub sends its ordinary notification when the report is first posted to subscribers; existing Codex notifications remain controlled by GitHub notification settings. This does not create a separate SMTP service or disable existing mail. The report includes repository, PR, commit, severity links, unresolved threads and next actions. Test/build enforcement remains the separate required assurance check.

After resolving threads, run **Actions > Final commit review > Run workflow**, entering the PR number. It also refreshes on review/comment events and every 30 minutes. The setup PR bootstraps the new workflow; keep it unmerged until native builds and review pass. Branch protection must require the new contexts only once those checks have appeared on that PR.

Coverage thresholds are explicitly scoped to the files listed in test configuration. They are not a whole-product coverage score. Native smoke builds use public debug signing for verification only; store signing and real purchases remain separate manual release/testing activities.

## Recipe and allergen changes

Recipes are rebuilt from source and checked for consistency. Allergen findings now fail CI, including warnings found in cocktail garnishes. Explicitly named substitutes are evaluated for each allergen independently, so coconut milk does not hide peanuts and vegan butter does not hide separate milk.

Correct the source recipe and regenerate its data when a warning is valid. For a reviewed false positive, add its exact fingerprint, explanation, reviewer and expiry date to `data/recipes/allergen-review.json`. Ingredient changes invalidate the exception. Never bulk-accept warnings. Run `python scripts/check_allergens.py` and the recipe checker tests before requesting review. A passing keyword check cannot establish allergy safety or eliminate cross-contact.

Backend coverage gates all measured server files at 90% lines, 80% branches and 85% functions. Mobile coverage gates the explicitly listed API, recipe and purchase logic at 80% lines/statements/functions and 75% branches.
