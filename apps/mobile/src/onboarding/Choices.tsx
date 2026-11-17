// The "What are you here for?" and "How do you eat?" pickers, shared by the first-launch tour and Settings.
import { Image, type ImageSourcePropType, Pressable, StyleSheet, Text, View } from "react-native";
import { find_collection_dish } from "../recipes/shelves";
import type { Diet } from "../recipes/types";
import { fonts, useTheme, useThemedStyles, type Palette } from "../ui/theme";
import { DIET_CHOICES, type Interest } from "./onboarding";

const photo = (id: string): ImageSourcePropType | undefined => find_collection_dish(id)?.source;

const INTEREST_OPTIONS: { value: Interest; label: string; detail: string; photos: string[] }[] = [
  { value: "cocktails", label: "Mostly cocktails", detail: "More drinks on your home screen", photos: ["negroni"] },
  { value: "meals", label: "Mostly meals", detail: "More dishes on your home screen", photos: ["pasta-alla-norma"] },
  { value: "both", label: "A bit of both", detail: "An even mix", photos: ["margarita", "pho"] },
];

export function InterestPicker({ value, onChange }: { value: Interest; onChange: (next: Interest) => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(create_styles);
  return (
    <View style={{ gap: 12 }} accessibilityRole="radiogroup">
      {INTEREST_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${option.label}. ${option.detail}`}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              selected && { borderColor: colors.accent, backgroundColor: colors.accentTint },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={styles.thumb}>
              {option.photos.map((id) => (
                <Image key={id} source={photo(id)} style={{ flex: 1, height: 72 }} resizeMode="cover" accessible={false} />
              ))}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.optionTitle}>{option.label}</Text>
              <Text style={styles.optionDetail}>{option.detail}</Text>
            </View>
            <View style={[styles.radio, selected && { borderColor: colors.accent }]}>{selected && <View style={styles.radioDot} />}</View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DietPicker({ value, onToggle }: { value: Diet[]; onToggle: (choice: Diet | null) => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(create_styles);
  return (
    <View style={styles.grid}>
      {DIET_CHOICES.map(({ diet, label }) => {
        const selected = diet === null ? value.length === 0 : value.includes(diet);
        return (
          <Pressable
            key={label}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={label}
            onPress={() => onToggle(diet)}
            style={({ pressed }) => [
              styles.diet,
              selected && { backgroundColor: colors.accent, borderColor: colors.accent },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.dietLabel, selected && { color: colors.accentText }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const create_styles = (colors: Palette) =>
  StyleSheet.create({
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 12,
      paddingRight: 16,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    thumb: { width: 72, height: 72, borderRadius: 12, overflow: "hidden", flexDirection: "row", gap: 3 },
    optionTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 21 },
    optionDetail: { color: colors.muted, fontSize: 14, lineHeight: 19 },
    radio: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: colors.control,
      alignItems: "center",
      justifyContent: "center",
    },
    radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    diet: {
      flexBasis: "47%",
      flexGrow: 1,
      minHeight: 56,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    dietLabel: { color: colors.text, fontSize: 17, fontWeight: "600" },
  });
