// Relish's one start screen (the design approved 2026-11-21): its photos drifting behind the app icon and "Every dish
// has a recipe.", with the choices for where the person is. The first launch offers the tour ("Get started") or
// "I already have an account"; once nobody is signed in (after the tour, or after signing out) it offers the account
// choices. Both are this same screen, so the app never shows a second welcome. The photos hold still with Reduce
// Motion, and the content scrolls on small phones and with large text.
import type { ReactNode } from "react";
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SignInWall } from "./SignInWall";
import { fonts, useThemedStyles, type Palette } from "./theme";

const APP_ICON = require("../../assets/icon.png");

export function StartScreen({ subtitle, children, footer }: { subtitle: string; children: ReactNode; footer?: ReactNode }) {
  const styles = useThemedStyles(create_styles);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // On short screens the photos take less room, so the buttons stay in view without scrolling.
  const wall = Math.round(height * (height < 700 ? 0.5 : 0.62));
  const top = Math.max(insets.top + 16, Math.round(height * (height < 700 ? 0.22 : 0.34)));
  return (
    <View style={styles.screen} testID="start-screen">
      <SignInWall height={wall} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: insets.bottom + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={APP_ICON} style={styles.icon} accessibilityLabel="Relish" />
        <Text style={styles.headline} accessibilityRole="header">
          Every dish has a <Text style={styles.headlineAccent}>recipe</Text>.
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {children}
        <View style={{ flexGrow: 1, minHeight: 24 }} />
        {footer}
      </ScrollView>
    </View>
  );
}

const create_styles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { flexGrow: 1, paddingHorizontal: 24 },
    icon: { width: 84, height: 84, borderRadius: 42, alignSelf: "center" },
    headline: { color: colors.text, fontFamily: fonts.display, fontSize: 32, lineHeight: 40, textAlign: "center", marginTop: 20 },
    headlineAccent: { color: colors.accentInk },
    subtitle: { color: colors.muted, fontSize: 15, lineHeight: 21, textAlign: "center", marginTop: 8, marginBottom: 16 },
  });
