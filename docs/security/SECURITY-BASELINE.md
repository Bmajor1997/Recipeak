# Meals and Mixers security baseline

Status: **adopted engineering targets, not a certification or claim of compliance**. Adapted from Votic's OWASP/NIST baseline.

Scope: to be confirmed as the app is designed (mobile app, backend services, any AI features).

## Standards and assessment
- **OWASP MASVS**: assess MASVS-STORAGE, CRYPTO, AUTH, NETWORK, PLATFORM, CODE, RESILIENCE and PRIVACY as applicable. Use MASTG test cases and record evidence.
- **OWASP ASVS 5.0.0**: keep a control-by-control applicability matrix for backend APIs, authentication, access control, validation, uploads, cryptography, logging and configuration. Target Level 2 for internet-facing user-data services.
- **NIST AI RMF 1.0** (if AI features are added): GOVERN, MAP, MEASURE, MANAGE, including the NIST Generative AI Profile.
- **Reliability**: bounded jobs, checked errors, safe recovery, regression tests, documented release gates.

## Non-negotiable engineering requirements
1. Every user record and request is authorized server-side to its owning user. Test cross-account access.
2. Reject unsupported and oversized input before expensive work; bound processing time, memory and concurrency.
3. Keep secrets out of client bundles, source control, logs and AI prompts.
4. Treat user-supplied and retrieved content as untrusted; it never overrides system policy.
5. Fail safely, avoid duplicate charges, and support retry/cancellation for paid features.
6. Verify purchase entitlements server-side where privileged operations depend on them.
7. Security changes need automated tests, review, and documented risk acceptance for any exception.

## Automated gates (see `.github/workflows/security-checks.yml`)
| Gate | Tool | Fails the build when |
| --- | --- | --- |
| Secret scan | Gitleaks + `security/verify-gitleaks-log.cjs` | A secret is found, or the scan did not cover full history |
| Static analysis | Semgrep (`--config auto`), CodeQL | A finding is reported |
| Dependencies | npm audit + `security/check-npm-audit.cjs`, OSV-Scanner | A high/critical advisory has no unexpired exception in `osv-scanner.toml` |
| Dependency review | GitHub dependency-review-action | A pull request adds a vulnerable dependency |
| Native analysis | `security/check-sarif.cjs` | A SARIF report has unsuppressed findings (wire up when native code exists) |

## Evidence register
| Workstream | Initial status | Evidence required |
| --- | --- | --- |
| Mobile controls (MASVS) | Not assessed | Per-control review and MASTG test output |
| Backend controls (ASVS) | Not assessed | Threat model, access-control and validation tests |
| CI release gate | In place | Workflow run links |
| Dependency and secret scans | In place | Scan reports and triaged findings in `security/vulnerability-report.md` |

References:
- https://mas.owasp.org/MASVS/
- https://mas.owasp.org/MASTG/
- https://owasp.org/www-project-application-security-verification-standard/
- https://www.nist.gov/itl/ai-risk-management-framework
