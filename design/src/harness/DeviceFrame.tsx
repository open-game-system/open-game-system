import type { ReactNode } from "react";
import { DEVICE_SIZE, type Device } from "./types";

export function DeviceFrame({ device, seat, children }: { device: Device; seat?: string; children: ReactNode }) {
  const { w, h } = DEVICE_SIZE[device];
  return (
    <div data-device={device} data-seat={seat} data-ogs-root style={{ width: w, height: h, position: "relative", overflow: "hidden", isolation: "isolate" }}>
      {children}
    </div>
  );
}
