// Before tonight starts the living room TV isn't ours: nothing from OGS is on it. While the stream
// comes up, the console shows one calm card so the room knows the phone was heard.
import { HOME } from "../../../world";
import { Mark } from "../ui/Brand";

export function TvOff() {
  return <div className="ct-off" aria-label="TV not cast" />;
}

export function TvConnecting({ gameName }: { gameName: string | null }) {
  return (
    <div className="ct-connecting">
      <span className="ct-connecting__mark">
        <Mark size={120} />
      </span>
      <p className="ct-connecting__line">{gameName ? `Starting ${gameName}` : "Connecting"}</p>
      <p className="ct-connecting__sub">{HOME.name} · Living room</p>
    </div>
  );
}
