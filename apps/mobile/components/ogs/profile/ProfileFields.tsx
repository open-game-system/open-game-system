import { useSyncExternalStore } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { STICKERS } from "../../../services/identity";
import { handleStatusText, type ProfileForm } from "../../../services/profile-form";
import { Sticker } from "../Sticker";
import { colors, fonts, TARGET } from "../theme";

/**
 * Name (typed), @id (pre-filled from the name, editable, checked) and sticker (pre-picked,
 * changeable): onboarding's "Make your OGS profile" and the Profile tab's Edit.
 */
export function ProfileFields({ form }: { form: ProfileForm }) {
  const s = useSyncExternalStore(form.subscribe, form.getSnapshot, form.getSnapshot);
  const status = handleStatusText(s);
  return (
    <View style={styles.wrap}>
      <View style={styles.big}>
        <Sticker id={s.sticker} size={96} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stickers}
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
        returnKeyType="done"
      />
      <Text style={styles.label}>Profile id</Text>
      <View style={styles.handleRow}>
        <Text style={styles.at}>@</Text>
        <TextInput
          testID="profileHandleInput"
          value={s.handle}
          onChangeText={(t) => form.setHandle(t)}
          style={styles.handleInput}
          accessibilityLabel="Profile id"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="your.id"
          placeholderTextColor={colors.cream3}
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
  stickers: { gap: 8, paddingVertical: 4 },
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
  bold: { fontWeight: "800", color: colors.peach, fontFamily: fonts.display },
});
