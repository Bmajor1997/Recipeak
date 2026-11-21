# Settings in Recipeak

The Settings tab adapts Votic's grouped settings navigation. Since 2026-11-20 it has four groups:

| Group | Rows |
| --- | --- |
| Your account | **Account**: an account card (email, how you sign in, plan with See Premium), Change password (email accounts only), Sign out, and Delete account set apart at the bottom in red. **Premium**: the plan and free photos left, See Premium, Manage subscription (subscribers), Restore purchase, Refresh. |
| Preferences | **Appearance & photos**: Match phone, Light or Dark; button colour Coral (default) or Blue; pause the Home photo wall; keep offline cover photos. **Cocktails, meals & diet**. |
| Support | **Help** (how-to text and Show tips again), **Send feedback** (feature requests and bug reports, ported from Votic), Contact support (email), Rate Recipeak (once the app is on Google Play). |
| About | Privacy policy and Terms of use (open the server's pages), then the app version and maker. |

Saved recipes live only in the Saved tab, which has a Share button for all saved recipe text. The camera always keeps its own dark look and coral accent.

Preferences are stored in AsyncStorage under a versioned key scoped to the Firebase user ID. They are local to the device. Changing sign-in remounts preference state so a late read/save from a prior account cannot populate the next account. Controls remain disabled during preference reads/writes. A failed write leaves the previous choice in place and allows retry. Failed/corrupt reads show a retry action rather than overwriting the stored value.

Saved recipes belong to the signed-in account (since 2026-11-15): each Firebase user ID has its own list on the device, so people who share a phone never see each other's recipes or share one free limit. The old phone-wide list moves to the first account that opens Saved after the update, and is then removed so no other account gets it. If cover preferences cannot be read, recipe text can still be saved without downloading a new offline photo.

## Source areas intentionally omitted

- Reading/listening, narration voices, pronunciations, document scans, drafts, Recently Deleted, document import/backup, onboarding walkthroughs, and reading activity: these are Votic document-reader features without corresponding Meals & Mixers models/services.
- Votic personalization: the target app supports explicit recipe diet versions and US units; it does not have Votic's answer-style/purpose service.
- Credit packs and retention offers: Recipeak sells only the yearly and monthly plans.
- Temporary-file cleanup/storage-byte estimates: no equivalent safe cleanup/measurement service exists. Settings reports actual saved recipe/photo counts instead.

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
