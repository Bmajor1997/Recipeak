# Putting the recipe server online (Google Cloud)

The same setup as Votic: one small Google Cloud VM (e2-micro, 30 GB disk) running the recipe server behind Caddy,
which gives it HTTPS. The usage ledger and the cover-photo library stay on the VM's persistent disk. Nothing here
runs by itself: running `gce-create.sh` creates Cloud resources and can cost money, so it needs your go-ahead.

## Steps

1. Open Google Cloud Shell in the project you want to use, and clone the repository there.
2. Run it with the project ID and the commit to deploy (normally the latest on main):
   `PROJECT=<project-id> COMMIT_SHA=$(git rev-parse origin/main) bash deploy/backend/gce-create.sh`
   It prints the server's address, for example `https://34-12-56-78.sslip.io`.
3. Add the keys on the server. They're typed in hidden and never shown or saved anywhere else:
   `gcloud compute ssh recipeak-backend --zone us-east1-b -- sudo bash /opt/recipeak/deploy/backend/set-secrets.sh`
   It asks for the Firebase project ID, the RevenueCat secret key and the OpenAI key, then restarts and checks the server.
4. Optional: open `/etc/recipeak/backend.env` on the server to add feedback-dashboard admins
   (`MM_FEEDBACK_ADMIN_UIDS`, `FIREBASE_WEB_API_KEY`) or free beta testers (`MM_PREMIUM_TESTER_UIDS`).
5. Set the address as the `EXPO_PUBLIC_API_BASE_URL` Actions variable on GitHub, so Google Play builds use it.

## Checks before a Google Play build

- `https://<address>/healthz` answers `{"ok":true}`, and `/privacy` and `/terms` open.
- A request without signing in gets 401.
- A free test account gets 3 photos; a RevenueCat test subscriber gets Premium.
- After `sudo systemctl restart recipeak-backend`, the same account's photo count is unchanged.

## Cost

The e2-micro VM and 30 GB standard disk can fit Google's Free Tier, but the public IPv4 address (about $3.65 a month)
and network traffic can be billed. The bootstrap sets the server's own OpenAI budget to $20 a month; that limits
Recipeak's spending, not the Google Cloud bill.
