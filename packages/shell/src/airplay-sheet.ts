/**
 * The "Show on TV" sheet for AirPlay (ShowOnTvSheet renders it): iOS can't start Screen Mirroring
 * for an app, so the sheet shows the Control Center steps and waits for the TV's display. In
 * "audio-only" mode the user picked the AirPlay sound route instead. React-free.
 */
export type AirplaySheetMode = "steps" | "audio-only";
export type AirplaySheetState = { open: boolean; mode: AirplaySheetMode };

const CLOSED: AirplaySheetState = { open: false, mode: "steps" };

export function createAirplaySheet() {
  let state: AirplaySheetState = CLOSED;
  const listeners = new Set<() => void>();
  const closeListeners = new Set<(mode: AirplaySheetMode) => void>();
  const set = (next: AirplaySheetState) => {
    if (next.open === state.open && next.mode === state.mode) return;
    state = next;
    for (const l of listeners) l();
  };
  return {
    get: (): AirplaySheetState => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    open(mode: AirplaySheetMode = "steps") {
      set({ open: true, mode });
    },
    /** The TV's display connected: close without telling the waiting cast it was cancelled. */
    done() {
      set(CLOSED);
    },
    /** The user closed it ("Not now"): a cast waiting for the display gives up. */
    close() {
      if (!state.open) return;
      const { mode } = state;
      set(CLOSED);
      for (const l of closeListeners) l(mode);
    },
    onClose(listener: (mode: AirplaySheetMode) => void) {
      closeListeners.add(listener);
      return () => void closeListeners.delete(listener);
    },
  };
}

export type AirplaySheet = ReturnType<typeof createAirplaySheet>;
