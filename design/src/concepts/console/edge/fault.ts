// Failure & edge states (flow 9), owned by the edge owner. The couch session lives in OGS's cloud,
// not on any one device, so every fault here is "a device lost the session", never "the session is
// gone". `kind` is the edge owner's to extend.
export interface Fault {
  kind: string;
  /** Which device or home the fault is about (a device id, a household id), if any. */
  subject?: string;
  /** Where recovery stands: just happened, recovering, recovered. */
  phase: "now" | "recovering" | "recovered";
}
