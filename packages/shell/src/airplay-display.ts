/**
 * The OgsAirplayDisplay native module (ios/module/AirplayDisplay) as the shell uses it, and a no-op
 * where it is missing (Android, Expo Go, a build without the module, tests). airplay-native.ts loads
 * the real one.
 */
export interface EventSubscription {
  remove(): void;
}

export interface DisplayInfo {
  /** The AirPlay receiver's name when iOS reports it ("Kitchen"), else "TV". */
  name: string;
  width: number;
  height: number;
}

export type NativeLogData = Record<string, string | number | boolean | null>;

/** One native client-log event (NativeLog.swift). `data` is flat. */
export interface NativeLogEvent {
  seq: number;
  at: number;
  type: string;
  level: "info" | "warn" | "error";
  data: NativeLogData;
}

/** The module's events and their payloads. */
export type AirplayEvents = {
  onConnect: DisplayInfo;
  onDisconnect: Record<string, never>;
  onLog: NativeLogEvent;
  onAudioOnlyAirPlay: { name: string };
  onRoutes: { available: boolean };
};

/** What the module exposes (OgsAirplayDisplayModule.swift). */
export interface AirplayDisplayNative {
  start(tvUrl: string): Promise<void>;
  stop(): Promise<void>;
  currentDisplay(): Promise<DisplayInfo | null>;
  detectRoutes(seconds: number): Promise<boolean>;
  recentLog(after: number): Promise<NativeLogEvent[]>;
  log(type: string, level: string, data: NativeLogData): Promise<void>;
  addListener<K extends keyof AirplayEvents>(
    event: K,
    listener: (payload: AirplayEvents[K]) => void,
  ): EventSubscription;
}

/** The external display (AirPlay Screen Mirroring, the Simulator's external display). */
export interface AirplayDisplay {
  readonly available: boolean;
  /** Show this TV page on the display (now, or when one connects). */
  start(tvUrl: string): Promise<void>;
  /** Back to the idle card. */
  stop(): Promise<void>;
  currentDisplay(): Promise<DisplayInfo | null>;
  /** Look for AirPlay receivers for a while; resolves with what is known now. */
  detectRoutes(seconds: number): Promise<boolean>;
  onConnect(listener: (info: DisplayInfo) => void): EventSubscription;
  onDisconnect(listener: () => void): EventSubscription;
  /** The user picked the AirPlay audio route: sound went to the TV, but no picture. */
  onAudioOnlyAirPlay(listener: (name: string) => void): EventSubscription;
  onRoutes(listener: (available: boolean) => void): EventSubscription;
}

/** The native log: what happened before JS listened (the ring), then each event live. */
export interface NativeLogSource {
  readonly available: boolean;
  recentLog(after: number): Promise<NativeLogEvent[]>;
  onLog(listener: (e: NativeLogEvent) => void): EventSubscription;
  log(type: string, level: "info" | "warn" | "error", data: NativeLogData): Promise<void>;
}

const NOOP_SUB: EventSubscription = { remove: () => {} };

export const noAirplayDisplay: AirplayDisplay = {
  available: false,
  start: async () => {},
  stop: async () => {},
  currentDisplay: async () => null,
  detectRoutes: async () => false,
  onConnect: () => NOOP_SUB,
  onDisconnect: () => NOOP_SUB,
  onAudioOnlyAirPlay: () => NOOP_SUB,
  onRoutes: () => NOOP_SUB,
};

export const noNativeLog: NativeLogSource = {
  available: false,
  recentLog: async () => [],
  onLog: () => NOOP_SUB,
  log: async () => {},
};

/** The module's display half, or the no-op without it. */
export function airplayDisplayOf(native: AirplayDisplayNative | null): AirplayDisplay {
  if (!native) return noAirplayDisplay;
  return {
    available: true,
    start: (tvUrl) => native.start(tvUrl),
    stop: () => native.stop(),
    currentDisplay: () => native.currentDisplay(),
    detectRoutes: (seconds) => native.detectRoutes(seconds),
    onConnect: (listener) => native.addListener("onConnect", listener),
    onDisconnect: (listener) => native.addListener("onDisconnect", () => listener()),
    onAudioOnlyAirPlay: (listener) =>
      native.addListener("onAudioOnlyAirPlay", (p) => listener(p.name)),
    onRoutes: (listener) => native.addListener("onRoutes", (p) => listener(p.available)),
  };
}

/** The module's log half, or the no-op without it. */
export function nativeLogOf(native: AirplayDisplayNative | null): NativeLogSource {
  if (!native) return noNativeLog;
  return {
    available: true,
    recentLog: (after) => native.recentLog(after),
    onLog: (listener) => native.addListener("onLog", listener),
    log: (type, level, data) => native.log(type, level, data),
  };
}
