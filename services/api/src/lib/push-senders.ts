import { getProviderForPlatform } from "../providers/push";
import type { Env } from "../types";
import type { PushSenders } from "./push-delivery";

/** The real senders: Expo for the OGS app. Web push is not wired yet: a web surface errors. */
export function pushSenders(env: Env): PushSenders {
  return {
    expo: (platform, token, n) => getProviderForPlatform(platform, env.EXPO_ACCESS_TOKEN).send(token, n),
    web: async () => "error",
  };
}
