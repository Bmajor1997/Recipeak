#!/usr/bin/env bash
set -euo pipefail
package=com.mealsandmixers.app
evidence() {
  adb logcat -d > android-smoke-logcat.txt || true
  adb exec-out screencap -p > android-smoke-screen.png || true
}
trap evidence EXIT
adb install -r "$1"
adb shell am force-stop "$package"
adb shell am start -W -n "$package/.MainActivity" | tee android-smoke-launch.txt
grep -q 'Status: ok' android-smoke-launch.txt
for attempt in $(seq 1 30); do
  adb shell uiautomator dump /sdcard/recipeak-smoke.xml >/dev/null 2>&1 || true
  adb shell cat /sdcard/recipeak-smoke.xml > android-smoke-ui.xml || true
  # A hung emulator launcher can obscure an otherwise running app with a system ANR dialog.
  # Dismiss only Quickstep's dialog; keep requiring the actual Recipeak screen below.
  if grep -Fq "Quickstep isn't responding" android-smoke-ui.xml; then
    close_position=$(python3 -c '
import re
import xml.etree.ElementTree as ET

root = ET.parse("android-smoke-ui.xml").getroot()
for node in root.iter("node"):
    if node.get("resource-id") == "android:id/aerr_close":
        bounds = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds", ""))
        if bounds:
            x1, y1, x2, y2 = map(int, bounds.groups())
            print((x1 + x2) // 2, (y1 + y2) // 2)
            break
' || true)
    if [[ "$close_position" =~ ^[0-9]+\ [0-9]+$ ]]; then
      read -r close_x close_y <<< "$close_position"
      echo 'Dismissing unresponsive emulator launcher.'
      adb shell input tap "$close_x" "$close_y" || true
    fi
    sleep 2
    continue
  fi
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
