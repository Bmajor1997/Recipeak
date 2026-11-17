// The paywall route, opened after the 3 free photos, when a free account tries to save a 4th recipe, or when its free
// diet versions (5 with each photo) are used up.
import { router, useLocalSearchParams } from "expo-router";
import { Paywall } from "../paywall/Paywall";

export default function Upgrade() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const close = () => (router.canGoBack() ? router.back() : router.replace("/saved"));
  return <Paywall reason={reason === "saved" || reason === "versions" ? reason : "photos"} onClose={close} />;
}
