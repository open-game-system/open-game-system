import { Tabs, useRouter } from "expo-router";
import { useEffect } from "react";
import { CastPromptHost } from "../../components/ogs/library/CastPrompt";
import { TabBar } from "../../components/ogs/TabBar";
import { consumePendingGameUrl, subscribeToGameUrl } from "../../services/game-url-store";

/** Owner decision (Oct 2026): five tabs, always all five, in this order. Games push on top. */
export default function TabsLayout() {
  const router = useRouter();

  // Deep links and push taps open their game over the tabs (event subscription).
  useEffect(() => {
    const pending = consumePendingGameUrl();
    if (pending) router.push({ pathname: "/game", params: { url: pending } });
    return subscribeToGameUrl((url) => router.push({ pathname: "/game", params: { url } }));
  }, [router]);

  // Play on any tab asks to cast first when it must: one cast prompt over them all.
  return (
    <>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
        <Tabs.Screen name="playing" />
        <Tabs.Screen name="tv" />
        <Tabs.Screen name="library" />
        <Tabs.Screen name="friends" />
        <Tabs.Screen name="profile" />
      </Tabs>
      <CastPromptHost />
    </>
  );
}
