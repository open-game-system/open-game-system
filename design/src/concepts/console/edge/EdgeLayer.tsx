// Wraps every device's surface. With no fault it renders the surface untouched; the edge owner
// decides per device whether a fault overlays, replaces, or leaves it alone.
import type { ReactNode } from "react";
import type { Device } from "../../../harness/types";
import type { Store } from "../../../harness/store";
import type { S } from "../state";

export function EdgeLayer({ children }: { device: Device; store: Store<S>; seat?: string; children: ReactNode }) {
  return <>{children}</>;
}
