import { BootSchema } from "../room.schemas";
import type { Boot } from "../room.types";

/** The snapshot and access token the Worker inlined into the page, parsed (the page's boundary). */
export function readBoot(doc: Pick<Document, "getElementById"> = document): Boot {
  const text = doc.getElementById("boot")?.textContent;
  if (!text) throw new Error("this page has no boot payload: open it through /host or /tv/CODE");
  return BootSchema.parse(JSON.parse(text));
}
