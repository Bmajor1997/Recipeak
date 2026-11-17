// The paywall route, opened after the 3 free photos or when a free account tries to save a 4th recipe.
import { router, useLocalSearchParams } from "expo-router";
import { Paywall } from "../paywall/Paywall";

export default function Upgrade() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const close = () => (router.canGoBack() ? router.back() : router.replace("/saved"));
  return <Paywall reason={reason === "saved" ? "saved" : "photos"} onClose={close} />;
}
