#!/usr/bin/env bash
set -euo pipefail
package=com.mealsandmixers.app
evidence() {
  adb logcat -d > android-smoke-logcat.txt || true
  adb exec-out screencap -p > android-smoke-screen.png || true
}
trap evidence EXIT
adb install -r "$1"
# The start screen's photos drift without end, and uiautomator can't capture a screen that never goes idle. With
# animations off, Android reports Reduce Motion, so the photos hold still (as they do for people who turn it on).
for scale in window_animation_scale transition_animation_scale animator_duration_scale; do
  adb shell settings put global "$scale" 0
done
adb shell am force-stop "$package"
adb shell am start -W -n "$package/.MainActivity" | tee android-smoke-launch.txt
grep -q 'Status: ok' android-smoke-launch.txt
for attempt in $(seq 1 30); do
  adb shell uiautomator dump /sdcard/recipeak-smoke.xml >/dev/null 2>&1 || true
  adb shell cat /sdcard/recipeak-smoke.xml > android-smoke-ui.xml || true
  # Require rendered application content, rather than merely a live process or splash screen.
  if grep -q 'Get started' android-smoke-ui.xml; then
    adb shell dumpsys activity activities > android-smoke-activity.txt
    grep -E 'mResumedActivity|topResumedActivity' android-smoke-activity.txt | grep -q "$package"
    echo 'Bundled Recipeak opened its first-launch screen.'
    exit 0
  fi
  sleep 2
done
echo 'Recipeak did not render its first-launch screen within 60 seconds.' >&2
exit 1
