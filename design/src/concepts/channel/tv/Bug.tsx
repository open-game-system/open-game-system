// The channel bug: a corner mark, the only OGS chrome on the picture while a game plays.
import { Bars } from "../brand/Mark";

export function Bug() {
  return (
    <div className="ch-bug" aria-hidden="true">
      <Bars height={30} width={8} gap={4} />
    </div>
  );
}
