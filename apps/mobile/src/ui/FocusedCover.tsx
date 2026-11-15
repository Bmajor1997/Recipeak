// A cover photo that shows the upper part of tall photos, where the glass rim and garnish (or the plate) sit,
// instead of the centre crop that cuts them off on a wide cover.
import { useState } from "react";
import { Image, StyleSheet } from "react-native";
import { cover_placement } from "./coverPlacement";

export function FocusedCover({ uri, width, height, label }: { uri: string; width: number; height: number; label: string }) {
  const [aspect, set_aspect] = useState<number | null>(null);
  const placement = cover_placement(width, height, aspect);
  return (
    <Image
      source={{ uri }}
      onLoad={(event) => {
        const { width: w, height: h } = event.nativeEvent.source;
        if (w > 0 && h > 0) set_aspect(h / w);
      }}
      style={placement ? { position: "absolute", left: 0, ...placement } : StyleSheet.absoluteFill}
      resizeMode="cover"
      accessibilityLabel={label}
    />
  );
}
