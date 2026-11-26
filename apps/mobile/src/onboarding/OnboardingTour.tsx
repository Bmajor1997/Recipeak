// The first-launch tour (design "Recipeak onboarding mockup", approved 2026-11-17): welcome, try a sample dish,
// cocktails or meals, diet, camera, and what's free. Every step after the welcome can be skipped. The root layout
// shows it in place of the app until it is finished, so nothing else (and no navigation) can open before it.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCameraPermissions } from "expo-camera";
import { type ReactNode, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DietPicker, InterestPicker } from "./Choices";
import { toggle_diet, type Entry } from "./onboarding";
import { useOnboarding } from "./OnboardingProvider";
import { Paywall } from "../paywall/Paywall";
import { FREE_PHOTOS, FREE_SAVED_RECIPES, start_offer } from "../paywall/plans";
import { bundled_recipe } from "../recipes/bundled";
import type { CollectionDish } from "../recipes/collectionPhotos";
import { format_ingredient } from "../recipes/format";
import { find_collection_dish } from "../recipes/shelves";
import { PillButton } from "../ui/PillButton";
import { StartScreen } from "../ui/StartScreen";
import { Button, fonts, useTheme, useThemedStyles, type Palette } from "../ui/theme";

const STEPS = 5;
const SAMPLES: { id: string; label: string }[] = [
  { id: "margarita", label: "Cocktail" },
  { id: "pho", label: "Meal" },
  { id: "pasta-alla-norma", label: "Meal" },
];
const dish = (id: string) => find_collection_dish(id);

export function OnboardingTour() {
  const [step, set_step] = useState(0);
  const { values, update } = useOnboarding();
  const { type } = useTheme();
  const finish = (entry: Entry) => update({ done: true, entry });
  const next = () => set_step((s) => Math.min(s + 1, STEPS));

  if (step === 0) return <Welcome onStart={next} onHaveAccount={() => finish("sign-in")} />;
  return (
    <Frame step={step} onSkip={() => finish("create")}>
      {step === 1 && <TryIt onNext={next} />}
      {step === 2 && (
        <Question title="What are you here for?" subtitle="We'll fill your home screen with more of what you love." onNext={next}>
          <InterestPicker value={values.interest} onChange={(interest) => update({ interest })} />
          <Text style={[type.muted, { marginTop: 20, fontSize: 15, lineHeight: 21 }]}>
            {"You'll still see both. This only changes the mix. Change it any time in Settings."}
          </Text>
        </Question>
      )}
      {step === 3 && (
        <Question
          title="How do you eat?"
          subtitle="Recipes will open in this version automatically. Pick as many as you like."
          onNext={next}
        >
          <DietPicker value={values.diets} onToggle={(choice) => update({ diets: toggle_diet(values.diets, choice) })} />
        </Question>
      )}
      {step === 4 && <CameraStep onDone={next} />}
      {step === 5 && <FreePlan onStart={() => finish("create")} />}
    </Frame>
  );
}

/**
 * The first screen of the app: Recipeak's one start screen (StartScreen, the drifting photos), with Get started (the
 * tour) or I already have an account (straight to the same screen's Log in choices).
 */
function Welcome({ onStart, onHaveAccount }: { onStart: () => void; onHaveAccount: () => void }) {
  const styles = useThemedStyles(create_styles);
  return (
    <StartScreen
      subtitle="Recipes from any meal or drink you photograph."
      footer={<Text style={styles.reassure}>{start_offer(false)}</Text>}
    >
      <PillButton label="Get started" variant="accent" hint="A quick tour, then create your account" onPress={onStart} />
      <Pressable accessibilityRole="button" onPress={onHaveAccount} style={styles.link}>
        <Text style={styles.linkText}>I already have an account</Text>
      </Pressable>
    </StartScreen>
  );
}

/** Progress bar and Skip at the top of every step after the welcome. */
function Frame({ step, onSkip, children }: { step: number; onSkip: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(create_styles);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.top}>
        <View
          style={styles.progress}
          accessibilityRole="progressbar"
          accessibilityLabel={`Step ${step} of ${STEPS}`}
          accessibilityValue={{ min: 0, max: STEPS, now: step }}
        >
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[styles.bar, { backgroundColor: i < step ? colors.accent : colors.border }]} />
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip the intro" onPress={onSkip} style={styles.skip}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  const { type } = useTheme();
  const styles = useThemedStyles(create_styles);
  return (
    <View style={{ gap: 10, paddingTop: 28 }}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[type.muted, { fontSize: 17, lineHeight: 24 }]}>{subtitle}</Text>
    </View>
  );
}

function Question({ title, subtitle, onNext, children }: { title: string; subtitle: string; onNext: () => void; children: ReactNode }) {
  const styles = useThemedStyles(create_styles);
  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        <Heading title={title} subtitle={subtitle} />
        <View style={{ marginTop: 28 }}>{children}</View>
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Next" onPress={onNext} />
      </View>
    </>
  );
}

function TryIt({ onNext }: { onNext: () => void }) {
  const { colors, type } = useTheme();
  const styles = useThemedStyles(create_styles);
  const [open, set_open] = useState<CollectionDish | null>(null);
  const [last, set_last] = useState(SAMPLES[0].id);
  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        <Heading
          title="See it work"
          subtitle="Pretend you just snapped one of these. Tap it and the full recipe opens, the same way it will with your own photos."
        />
        <View style={{ gap: 12, marginTop: 28 }}>
          {SAMPLES.map(({ id, label }) => {
            const d = dish(id);
            if (!d) return null;
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={`${d.name}, ${label}. See recipe`}
                onPress={() => {
                  set_last(id);
                  set_open(d);
                }}
                style={({ pressed }) => [styles.sample, id === last && { borderColor: colors.accent }, pressed && { opacity: 0.8 }]}
              >
                <Image source={d.source} style={styles.sampleImage} accessible={false} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.sampleTitle}>{d.name}</Text>
                  <Text style={type.muted}>{label}</Text>
                </View>
                <Text style={styles.sampleCta}>See recipe</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Next" onPress={onNext} />
      </View>
      <SampleRecipe dish={open} onClose={() => set_open(null)} />
    </>
  );
}

/** The sample's recipe in a sheet, read from the recipes built into the app. */
function SampleRecipe({ dish: d, onClose }: { dish: CollectionDish | null; onClose: () => void }) {
  const { colors, type } = useTheme();
  const styles = useThemedStyles(create_styles);
  const insets = useSafeAreaInsets();
  const recipe = d ? bundled_recipe(d) : null;
  return (
    <Modal visible={Boolean(d && recipe)} animationType="slide" onRequestClose={onClose}>
      {d && recipe && (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
            <Image source={d.source} style={{ width: "100%", height: 320 }} resizeMode="cover" accessible={false} />
            <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 8 }}>
              <Text style={styles.title} accessibilityRole="header">
                {recipe.title}
              </Text>
              <Text style={type.muted}>{recipe.description}</Text>
              <Text style={type.heading}>Ingredients</Text>
              {recipe.ingredients.map((ingredient, i) => (
                <Text key={i} style={type.body}>
                  • {format_ingredient(ingredient)}
                </Text>
              ))}
              <Text style={type.heading}>Steps</Text>
              {recipe.steps.map((step, i) => (
                <Text key={i} style={[type.body, { marginBottom: 6 }]}>
                  {i + 1}. {step}
                </Text>
              ))}
            </View>
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close recipe"
            onPress={onClose}
            style={[styles.close, { top: insets.top + 12 }]}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>
      )}
    </Modal>
  );
}

function CameraStep({ onDone }: { onDone: () => void }) {
  const { colors, type } = useTheme();
  const styles = useThemedStyles(create_styles);
  const [, request_permission] = useCameraPermissions();
  const [busy, set_busy] = useState(false);
  async function allow() {
    set_busy(true);
    try {
      await request_permission();
    } catch {
      // If the phone can't ask, the camera asks again the first time it opens.
    } finally {
      set_busy(false);
      onDone();
    }
  }
  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.body, { alignItems: "center", paddingTop: 56 }]}>
        <View style={styles.cameraBadge}>
          <Ionicons name="camera-outline" size={56} color={colors.accentInk} accessible={false} />
        </View>
        <Text style={[styles.title, { textAlign: "center", marginTop: 18 }]} accessibilityRole="header">
          Point, snap, cook
        </Text>
        <Text style={[type.muted, { fontSize: 17, lineHeight: 24, textAlign: "center", marginTop: 10 }]}>
          Recipeak needs your camera to recognize the dish in front of you.
        </Text>
        <View style={{ gap: 14, marginTop: 32, alignSelf: "stretch", paddingHorizontal: 4 }}>
          <Point bold="Only when you tap the camera." rest="We never record in the background." />
          <Point bold="Photos stay private." rest="They're used to find the recipe, nothing else." />
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Allow camera" onPress={() => void allow()} busy={busy} />
        <Pressable accessibilityRole="button" onPress={onDone} style={styles.link}>
          <Text style={[styles.linkText, { color: colors.muted }]}>Not now</Text>
        </Pressable>
      </View>
    </>
  );
}

function Point({ bold, rest }: { bold: string; rest: string }) {
  const { colors, type } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 9 }} />
      <Text style={[type.body, { flex: 1, fontSize: 17, lineHeight: 25 }]}>
        <Text style={{ fontWeight: "700" }}>{bold}</Text> <Text style={{ color: colors.muted }}>{rest}</Text>
      </Text>
    </View>
  );
}

function FreePlan({ onStart }: { onStart: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(create_styles);
  const [premium, set_premium] = useState(false);
  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        <Heading title="Free to start" subtitle="No card needed. Here's what you get:" />
        <View style={{ gap: 12, marginTop: 28 }}>
          <Perk
            lead={<Text style={styles.perkNumber}>{FREE_PHOTOS}</Text>}
            title="Free photos"
            detail={`Snap ${FREE_PHOTOS} dishes and get their recipes.`}
          />
          <Perk
            lead={<Text style={styles.perkNumber}>{FREE_SAVED_RECIPES}</Text>}
            title="Free saves"
            detail={`Keep ${FREE_SAVED_RECIPES} recipes in your Saved tab.`}
          />
          <Perk
            lead={<Ionicons name="infinite" size={40} color={colors.accentInk} accessibilityLabel="Unlimited" />}
            title="Browse everything"
            detail="Every recipe on Home and Explore, always free."
          />
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Start cooking" onPress={onStart} />
        <Pressable accessibilityRole="button" onPress={() => set_premium(true)} style={styles.link}>
          <Text style={styles.linkText}>See Premium</Text>
        </Pressable>
      </View>
      <Modal visible={premium} animationType="slide" onRequestClose={() => set_premium(false)}>
        <Paywall reason="intro" onClose={() => set_premium(false)} />
      </Modal>
    </>
  );
}

function Perk({ lead, title, detail }: { lead: ReactNode; title: string; detail: string }) {
  const { type } = useTheme();
  const styles = useThemedStyles(create_styles);
  return (
    <View style={styles.perk} accessible accessibilityLabel={`${title}. ${detail}`}>
      <View style={{ width: 56, alignItems: "center" }}>{lead}</View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[type.body, { fontSize: 18, fontWeight: "700" }]}>{title}</Text>
        <Text style={[type.muted, { fontSize: 15 }]}>{detail}</Text>
      </View>
    </View>
  );
}

const create_styles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    wall: {
      position: "absolute",
      top: -20,
      left: -30,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      transform: [{ rotate: "-6deg" }],
    },
    reassure: { color: colors.muted, fontSize: 13, textAlign: "center" },
    link: { minHeight: 48, justifyContent: "center", alignItems: "center", alignSelf: "center", paddingHorizontal: 12 },
    linkText: { color: colors.accentInk, fontSize: 16, fontWeight: "600" },
    top: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 24 },
    progress: { flex: 1, flexDirection: "row", gap: 6 },
    bar: { flex: 1, height: 4, borderRadius: 2 },
    skip: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "flex-end" },
    skipText: { color: colors.muted, fontSize: 16, fontWeight: "600" },
    title: { color: colors.text, fontFamily: fonts.display, fontSize: 32, lineHeight: 38 },
    body: { paddingHorizontal: 24, paddingBottom: 24 },
    footer: { paddingHorizontal: 24 },
    sample: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 10,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    sampleImage: { width: 84, height: 84, borderRadius: 12 },
    sampleTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 20 },
    sampleCta: { color: colors.accentInk, fontSize: 15, fontWeight: "700", paddingRight: 8 },
    close: {
      position: "absolute",
      right: 16,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.scrim,
      alignItems: "center",
      justifyContent: "center",
    },
    cameraBadge: {
      width: 112,
      height: 112,
      borderRadius: 56,
      backgroundColor: colors.accentTint,
      alignItems: "center",
      justifyContent: "center",
    },
    perk: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      padding: 18,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    perkNumber: { color: colors.accentInk, fontFamily: fonts.display, fontSize: 34 },
  });
