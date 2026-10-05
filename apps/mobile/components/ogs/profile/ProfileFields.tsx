import { LinearGradient } from "expo-linear-gradient";
import { useRef, useSyncExternalStore } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { STICKERS } from "../../../services/identity";
import { handleStatusText, type ProfileForm } from "../../../services/profile-form";
import { useRevealFocused } from "../KeyboardFooter";
import { Sticker } from "../Sticker";
import { colors, TARGET } from "../theme";
import { profileReturnKey } from "./profile-view";

/**
 * Name (typed), @id (pre-filled from the name, editable, checked) and sticker (pre-picked,
 * changeable): onboarding's "Make your OGS profile" and the Profile tab's Edit.
 * Return on the name moves to the @id; return on the @id submits (`onSubmit`) once it can.
 */
export function ProfileFields({ form, onSubmit }: { form: ProfileForm; onSubmit?: () => void }) {
  const s = useSyncExternalStore(form.subscribe, form.getSnapshot, form.getSnapshot);
  const status = handleStatusText(s);
  const handleRef = useRef<TextInput>(null);
  // The @id row (with its "free" check) shows with the name: typing the name fills it in.
  const handleRow = useRef<View>(null);
  const reveal = useRevealFocused();
  const nameKey = profileReturnKey("name", form.canSubmit());
  const handleKey = profileReturnKey("handle", form.canSubmit());
  return (
    <View style={styles.wrap}>
      <View style={styles.big}>
        <Sticker id={s.sticker} size={96} />
      </View>
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stickers}
          // With the keyboard up, a sticker tap picks it (not just closes the keyboard).
          keyboardShouldPersistTaps="handled"
          testID="profileStickers"
        >
          {STICKERS.map((st) => (
            <Pressable
              key={st.id}
              testID={`profileSticker-${st.id}`}
              accessibilityRole="radio"
              accessibilityLabel={st.label}
              accessibilityState={{ selected: s.sticker === st.id }}
              onPress={() => form.setSticker(st.id)}
              style={[styles.pick, s.sticker === st.id && styles.pickOn]}
            >
              <Sticker id={st.id} size={44} />
            </Pressable>
          ))}
        </ScrollView>
        {/* More stickers off to the right: they fade out at the edge, not cut. */}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(18, 15, 34, 0)", colors.dusk0]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.more}
        />
      </View>
      <Text style={styles.label}>Name</Text>
      <TextInput
        testID="profileNameInput"
        value={s.name}
        onChangeText={(t) => form.setName(t)}
        style={styles.input}
        accessibilityLabel="Name"
        placeholder="Your name"
        placeholderTextColor={colors.cream3}
        autoCapitalize="words"
        autoCorrect={false}
        onFocus={() => reveal(handleRow)}
        returnKeyType={nameKey.returnKeyType}
        // Keep the keyboard up: return moves on to the @id.
        submitBehavior="submit"
        onSubmitEditing={() => {
          if (nameKey.action === "focusHandle") handleRef.current?.focus();
        }}
      />
      <Text style={styles.label}>Profile id</Text>
      <View ref={handleRow} style={styles.handleRow}>
        <Text style={styles.at}>@</Text>
        <TextInput
          ref={handleRef}
          testID="profileHandleInput"
          onFocus={() => reveal()}
          value={s.handle}
          onChangeText={(t) => form.setHandle(t)}
          style={styles.handleInput}
          accessibilityLabel="Profile id"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="your.id"
          placeholderTextColor={colors.cream3}
          returnKeyType={handleKey.returnKeyType}
          submitBehavior="blurAndSubmit"
          onSubmitEditing={() => {
            if (handleKey.action === "submit") onSubmit?.();
          }}
        />
        <Text
          testID="profileHandleStatus"
          style={[styles.status, s.status === "taken" ? styles.taken : styles.free]}
        >
          {s.status === "taken" ? "taken" : status}
        </Text>
      </View>
      {s.status === "taken" && s.suggestion ? (
        <Pressable
          testID="profileHandleSuggestion"
          accessibilityRole="button"
          onPress={() => form.acceptSuggestion()}
          style={styles.suggestion}
        >
          <Text style={styles.suggestionText}>
            That id is taken. Use <Text style={styles.bold}>@{s.suggestion}</Text>
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  big: { alignItems: "center", marginBottom: 4 },
  stickers: { gap: 8, paddingVertical: 4, paddingRight: 28 },
  more: { position: "absolute", top: 0, bottom: 0, right: 0, width: 36 },
  pick: {
    width: TARGET + 12,
    height: TARGET + 12,
    borderRadius: (TARGET + 12) / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  pickOn: { borderColor: colors.peach, backgroundColor: colors.dusk2 },
  label: { color: colors.cream3, fontSize: 13, fontWeight: "700", marginTop: 6 },
  input: {
    minHeight: TARGET + 4,
    borderRadius: 12,
    backgroundColor: colors.dusk1,
    borderWidth: 1,
    borderColor: colors.hair,
    color: colors.cream,
    paddingHorizontal: 12,
    fontSize: 18,
  },
  handleRow: {
    minHeight: TARGET + 4,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: colors.dusk1,
    borderWidth: 1,
    borderColor: colors.hair,
    paddingHorizontal: 12,
  },
  at: { color: colors.cream3, fontSize: 18 },
  handleInput: { flex: 1, color: colors.cream, fontSize: 18, paddingVertical: 10 },
  status: { fontSize: 14, fontWeight: "700" },
  free: { color: colors.mint },
  taken: { color: colors.ember },
  suggestion: { minHeight: TARGET, justifyContent: "center" },
  suggestionText: { color: colors.cream2, fontSize: 15 },
  bold: { fontWeight: "800", color: colors.peach },
});
