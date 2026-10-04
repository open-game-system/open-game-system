import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { DEFAULT_FAMILY, STICKERS, type StickerId } from "../../services/identity";
import type { Band } from "../../services/ogs-api";
import { Button } from "./Button";
import { Sticker } from "./Sticker";
import { colors, fonts, TARGET } from "./theme";

export interface FamilyDraft {
  name: string;
  people: { name: string; band: Band; sticker: StickerId }[];
}

/** Read by onboarding when it completes (Skip keeps the defaults). */
export const familyDraft: FamilyDraft = {
  name: "Our family",
  people: DEFAULT_FAMILY.map((p) => ({ ...p })),
};

const BANDS: { band: Band; label: string }[] = [
  { band: "grownup", label: "Grown-up" },
  { band: "kid", label: "Kid" },
  { band: "little", label: "Little" },
];

const nextSticker = (id: StickerId): StickerId => {
  const i = STICKERS.findIndex((s) => s.id === id);
  return STICKERS[(i + 1) % STICKERS.length]?.id ?? "bear";
};

/** Onboarding: one short "who's in your family" step (names, band, a Story Nook sticker). */
export function FamilyStep({ onNext }: { onNext: () => void }) {
  const [draft, setDraft] = useState<FamilyDraft>(familyDraft);
  const update = (next: FamilyDraft) => {
    familyDraft.name = next.name;
    familyDraft.people = next.people;
    setDraft(next);
  };
  const setPerson = (i: number, patch: Partial<FamilyDraft["people"][number]>) =>
    update({ ...draft, people: draft.people.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Who's in your family?</Text>
      <Text style={styles.body}>Tap a sticker to change it. You can change all of this later.</Text>
      <TextInput
        testID="familyName"
        value={draft.name}
        onChangeText={(name) => update({ ...draft, name })}
        style={styles.input}
        accessibilityLabel="Family name"
        placeholder="Our family"
        placeholderTextColor={colors.cream3}
      />
      {draft.people.map((person, i) => (
        <View key={`person-${i}`} style={styles.person} testID={`familyPerson-${i}`}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Change ${person.name}'s sticker`}
            onPress={() => setPerson(i, { sticker: nextSticker(person.sticker) })}
            style={styles.sticker}
          >
            <Sticker id={person.sticker} size={52} />
          </Pressable>
          <View style={styles.personBody}>
            <TextInput
              value={person.name}
              onChangeText={(name) => setPerson(i, { name })}
              style={[styles.input, styles.personName]}
              accessibilityLabel={`Person ${i + 1} name`}
            />
            <View style={styles.bands}>
              {BANDS.map((b) => (
                <Pressable
                  key={b.band}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: person.band === b.band }}
                  onPress={() => setPerson(i, { band: b.band })}
                  style={[styles.band, person.band === b.band && styles.bandOn]}
                >
                  <Text style={[styles.bandText, person.band === b.band && styles.bandTextOn]}>
                    {b.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {draft.people.length > 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${person.name}`}
              onPress={() => update({ ...draft, people: draft.people.filter((_, j) => j !== i) })}
              style={styles.remove}
            >
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      <Button
        label="+ Add someone"
        kind="ghost"
        onPress={() =>
          update({
            ...draft,
            people: [
              ...draft.people,
              {
                name: "",
                band: "kid",
                sticker: STICKERS[draft.people.length % STICKERS.length]?.id ?? "owl",
              },
            ],
          })
        }
      />
      <Button label="Next" testID="familyNext" onPress={onNext} style={{ marginTop: 12 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 24, paddingBottom: 40, gap: 12 },
  heading: { fontFamily: fonts.display, fontSize: 30, color: colors.cream },
  body: { color: colors.cream2, fontSize: 16, lineHeight: 22 },
  input: {
    minHeight: TARGET,
    borderRadius: 12,
    backgroundColor: colors.dusk1,
    borderWidth: 1,
    borderColor: colors.hair,
    color: colors.cream,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.dusk1,
    borderRadius: 16,
    padding: 10,
  },
  sticker: {
    width: TARGET + 16,
    height: TARGET + 16,
    alignItems: "center",
    justifyContent: "center",
  },
  personBody: { flex: 1, gap: 8 },
  personName: { backgroundColor: colors.dusk2 },
  bands: { flexDirection: "row", gap: 6 },
  band: {
    minHeight: TARGET,
    paddingHorizontal: 10,
    borderRadius: 12,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.hair,
  },
  bandOn: { backgroundColor: colors.peach, borderColor: colors.peach },
  bandText: { color: colors.cream2, fontSize: 14, fontWeight: "600" },
  bandTextOn: { color: colors.ink },
  remove: { minHeight: TARGET, minWidth: TARGET, justifyContent: "center", alignItems: "center" },
  removeText: { color: colors.cream3, fontSize: 13, fontWeight: "600" },
});
