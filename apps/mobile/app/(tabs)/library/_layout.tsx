import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { ParamListBase } from "@react-navigation/native";
import { Stack, useNavigation, useRouter } from "expo-router";
import { useEffect } from "react";
import { colors } from "../../../components/ogs/theme";

/**
 * The Library tab's own stack: the list, then a game's page on top, so the tab bar and the
 * return pill stay. A tap on the Library tab while it's showing a game's page pops to the list.
 */
export default function LibraryLayout() {
  const navigation = useNavigation<BottomTabNavigationProp<ParamListBase>>();
  const router = useRouter();
  useEffect(
    () =>
      navigation.addListener("tabPress", () => {
        if (navigation.isFocused() && router.canDismiss()) router.dismissAll();
      }),
    [navigation, router],
  );
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.dusk0 } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[appId]" />
    </Stack>
  );
}
