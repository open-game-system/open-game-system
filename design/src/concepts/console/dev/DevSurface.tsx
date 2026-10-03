// Developer-facing surfaces (docs / game console). Owned by the developer-page owner.
import { useState } from "react";
import type { Store } from "../../../harness/store";
import { useStore } from "../../../harness/store";
import type { S } from "../state";
import { Casting } from "./docs/Casting";
import { Identity } from "./docs/Identity";
import { Instances } from "./docs/Instances";
import { Kids } from "./docs/Kids";
import { LibraryTiers } from "./docs/LibraryTiers";
import { Manifest } from "./docs/Manifest";
import { Overview } from "./docs/Overview";
import { initialPage, type DevPage } from "./pages";
import { Shell } from "./Shell";

function Page({ page, go }: { page: DevPage; go: (p: DevPage) => void }) {
  switch (page) {
    case "overview":
      return <Overview go={go} />;
    case "manifest":
      return <Manifest go={go} />;
    case "identity":
      return <Identity go={go} />;
    case "instances":
      return <Instances go={go} />;
    case "casting":
      return <Casting go={go} />;
    case "kids":
      return <Kids go={go} />;
    case "library":
      return <LibraryTiers go={go} />;
    default:
      return <Overview go={go} />;
  }
}

export function DevSurface({ store }: { store: Store<S> }) {
  const s = useStore(store);
  const [page, go] = useState<DevPage>(() => initialPage(s));
  return (
    <Shell page={page} go={go}>
      <Page page={page} go={go} />
    </Shell>
  );
}
