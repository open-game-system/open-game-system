// Developer-facing surfaces (docs / game console). Owned by the developer-page owner.
import type { Store } from "../../../harness/store";
import type { S } from "../state";

export function DevSurface({ store: _store }: { store: Store<S> }) {
  return <div className="dev" />;
}
