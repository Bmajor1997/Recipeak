// "Rate this recipe" on the recipe screen: stars, "I made this", what went wrong, and an optional note.
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useApp } from "../AppContext";
import { Button, Chip, Notice, useTheme } from "../ui/theme";
import { MAX_NOTE, RATING_TAGS, type RatingTag, tags_for } from "./ratings";
import type { Kind } from "./types";

export function RateRecipe({ kind, dish }: { kind: Kind; dish: string }) {
  const { colors, type } = useTheme();
  const { ratings } = useApp();
  const [stars, set_stars] = useState(0);
  const [made, set_made] = useState(false);
  const [tags, set_tags] = useState<RatingTag[]>([]);
  const [note, set_note] = useState("");
  const [rated_before, set_rated_before] = useState(false);
  const [busy, set_busy] = useState(false);
  const [message, set_message] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void ratings?.get(kind, dish).then((r) => {
      if (!live) return;
      set_stars(r?.stars ?? 0);
      set_made(r?.made ?? false);
      set_tags(r?.tags ?? []);
      set_note(r?.note ?? "");
      set_rated_before(Boolean(r));
    });
    return () => {
      live = false;
    };
  }, [ratings, kind, dish]);

  if (!ratings) return null;

  function toggle_tag(tag: RatingTag) {
    set_message(null);
    set_tags((list) => {
      if (list.includes(tag)) return list.filter((t) => t !== tag);
      // "Perfect as written" and a problem don't go together.
      return tag === "perfect" ? ["perfect"] : [...list.filter((t) => t !== "perfect"), tag];
    });
  }

  async function send() {
    if (!ratings || !stars || busy) return;
    set_busy(true);
    try {
      await ratings.save(kind, dish, { stars, made, tags, note });
      set_rated_before(true);
      set_message("Thanks! Your rating helps us improve this recipe.");
      // Sent in the background; if the server can't be reached, it's sent the next time the app opens.
      void ratings.send_pending();
    } catch {
      set_message("Couldn't save your rating. Please try again.");
    } finally {
      set_busy(false);
    }
  }

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={type.heading} accessibilityRole="header">
        Rate this recipe
      </Text>
      <View style={{ flexDirection: "row", gap: 4 }} accessibilityRole="radiogroup" accessibilityLabel="Star rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={`${n} star${n === 1 ? "" : "s"}`}
            accessibilityState={{ checked: stars === n }}
            hitSlop={4}
            onPress={() => {
              set_stars(n);
              set_message(null);
            }}
            style={{ padding: 4 }}
          >
            <Ionicons name={n <= stars ? "star" : "star-outline"} size={36} color={colors.accentInk} />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
        <Chip label={made ? "✓ I made this" : "I made this"} selected={made} onPress={() => set_made(!made)} />
      </View>

      {stars > 0 && (
        <>
          <Text style={[type.body, { marginTop: 12 }]}>How did it go? Pick any that apply.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 4 }}>
            {tags_for(kind).map((tag) => (
              <Chip key={tag} label={RATING_TAGS[tag]} selected={tags.includes(tag)} onPress={() => toggle_tag(tag)} />
            ))}
          </View>
          <TextInput
            accessibilityLabel="Note for the team, optional"
            placeholder="Anything we should fix? (optional)"
            placeholderTextColor={colors.muted}
            value={note}
            onChangeText={(text) => {
              set_note(text);
              set_message(null);
            }}
            maxLength={MAX_NOTE}
            multiline
            style={{
              minHeight: 80,
              fontSize: 16,
              color: colors.text,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              padding: 14,
              marginTop: 12,
              textAlignVertical: "top",
            }}
          />
          <View style={{ marginTop: 12 }}>
            <Button label={rated_before ? "Update rating" : "Send rating"} busy={busy} onPress={() => void send()} />
          </View>
        </>
      )}
      {message && <Notice>{message}</Notice>}
    </View>
  );
}
