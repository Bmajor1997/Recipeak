// The centre tab is a button that opens the camera sheet (see (tabs)/_layout.tsx), so this page is never shown.
import { Redirect } from "expo-router";

export default function CameraTab() {
  return <Redirect href="/" />;
}
