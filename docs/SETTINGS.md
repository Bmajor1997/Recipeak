# Settings in Meals & Mixers

The Settings tab adapts Votic's grouped settings navigation to Meals & Mixers. It uses the existing dark/grapefruit palette, Fraunces headings, shared buttons, Expo Router, Firebase sign-in methods, recipe store, and allowance API.

## Included

| Votic area | Meals & Mixers behavior |
| --- | --- |
| Account & Membership | Signed-in email, password-reset request, confirmed sign-out. Sign-out keeps the account's recipes on the device for its next sign-in and clears the current recipe. |
| Appearance | Match phone (default), Light or Dark. Every screen follows it except the camera, which always stays dark. |
| Accessibility | Pause the Home photo wall. The phone's Reduce Motion preference always takes precedence. Text continues to follow the phone's font-size setting. |
| Storage management | Choose whether newly saved recipes keep an offline cover photo. Existing saved photos remain until the corresponding recipe is removed. |
| Library tools | Count saved recipes and offline photos, open Saved, share all saved recipe text through the system share sheet. Text sharing is not an importable backup. |
| AI Credits & Usage | Read the existing server photo allowance, show paid access when reported, retry a failed request. Unavailable data is never shown as zero. Also explains the free plan's limit of 3 saved recipes. |
| Feedback (added 2026-11-15) | Ported from Votic: Settings > Feedback opens Suggest a Feature and Report a Bug. Each form has a title (120 characters) and a description (5,000), sends privately to the server, and keeps the text if sending fails. See "Feedback" in docs/PROJECT-PLAN.md. |
| Help / Privacy | Getting-started guidance, photo-processing explanation, device-storage disclosure, recipe and allergen limitations. |

Preferences are stored in AsyncStorage under a versioned key scoped to the Firebase user ID. They are local to the device. Changing sign-in remounts preference state so a late read/save from a prior account cannot populate the next account. Controls remain disabled during preference reads/writes. A failed write leaves the previous choice in place and allows retry. Failed/corrupt reads show a retry action rather than overwriting the stored value.

Saved recipes belong to the signed-in account (since 2026-11-15): each Firebase user ID has its own list on the device, so people who share a phone never see each other's recipes or share one free limit. The old phone-wide list moves to the first account that opens Saved after the update, and is then removed so no other account gets it. If cover preferences cannot be read, recipe text can still be saved without downloading a new offline photo.

## Source areas intentionally omitted

- Accent-colour choices: Meals & Mixers keeps its grapefruit accent. (Light and dark mode are included, see Preferences.)
- Reading/listening, narration voices, pronunciations, document scans, drafts, Recently Deleted, document import/backup, onboarding walkthroughs, and reading activity: these are Votic document-reader features without corresponding Meals & Mixers models/services.
- Votic personalization: the target app supports explicit recipe diet versions and US units; it does not have Votic's answer-style/purpose service.
- Credit packs, restore purchases, store subscription management, and retention offers: no client purchase service is wired in Meals & Mixers yet. Settings only displays the allowance/paid-access state returned by the existing API.
- Account deletion: no end-to-end deletion endpoint exists for Firebase identity plus backend usage/billing records. A Firebase-only deletion button would leave account data behind.
- Temporary-file cleanup/storage-byte estimates: no equivalent safe cleanup/measurement service exists. Settings reports actual saved recipe/photo counts instead.
- Support email and privacy-policy/terms links: the target repository has no configured product contact or published policy destinations. Votic's addresses and policies must not be reused for a different product. The Help page identifies those remaining gaps.

## Validation

- Mobile unit and component tests, TypeScript type checking and ESLint (zero warnings) run in CI on every pull request.
- Preference checks cover defaults, restart persistence, account separation, invalid/corrupt data, read/write failures, loading controls, retry, and retaining the old value after a failed save.
- Component checks cover all category links, unknown-category fallback/back navigation, allowance failure/retry, password-reset dispatch, sign-out cancellation, failed sign-out and retry.
- Components use a vertically scrollable layout with wrapping text, flexible copy columns, safe-area padding, a 720-point content maximum, and controls at least 48 points high. Visual layout is **not device-verified**: no Android device was connected, and the browser tool could not reach the local preview.
- Native Firebase delivery/sign-out, the server's live allowance, and the operating system's share sheet need a configured build/device. Tests mock those service boundaries.

## Device checks before release

1. On a narrow phone and with large system text, open each category, scroll to the final control, return to Settings, and confirm tab labels and controls remain reachable.
2. Toggle each preference, restart, and verify the wall stays paused / a newly saved recipe has the selected cover-photo behavior. Enable system Reduce Motion and confirm it always keeps the wall still.
3. Simulate storage/network failures and retry from each page; confirm no unavailable allowance is shown as zero.
4. Request a password reset with a test account, cancel sign-out, then confirm sign-out and verify protected routes return to sign-in.
5. Share saved recipe text through a real share destination, and verify cancelling sharing leaves Saved intact.
