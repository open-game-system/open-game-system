import type { ClientKind, Outbound } from "@open-game-system/ogs-protocol";

export interface Peer {
  deviceId: string;
  kind: ClientKind;
}

/** Indexes of the peers an outbound message goes to: everyone, the launchers, or one device's sockets. */
export function recipients(out: Outbound, peers: readonly Peer[]): number[] {
  const matches = (p: Peer): boolean => {
    if (out.to === "all") return true;
    if (out.to === "launcher") return p.kind === "launcher";
    return p.deviceId === out.to.deviceId;
  };
  return peers.flatMap((p, i) => (matches(p) ? [i] : []));
}
