import { requireOptionalNativeModule } from "expo";
import { type AirplayDisplayNative, airplayDisplayOf, nativeLogOf } from "./airplay-display";

/**
 * The OgsAirplayDisplay native module (ios/module/AirplayDisplay), autolinked through the shell's
 * expo-module.config.json; null on Android, in Expo Go and in a build made before it existed.
 */
const native = requireOptionalNativeModule<AirplayDisplayNative>("OgsAirplayDisplay");

export const airplayDisplay = airplayDisplayOf(native);
export const airplayNativeLog = nativeLogOf(native);
