// The only Porchlight chrome on a kid's iPad: their own painted character in their colour,
// so a five-year-old knows "this one is mine" in every game.
import type { CSSProperties } from "react";
import type { Person } from "../../../world";

export function KidBadge({ kid, size = 120 }: { kid: Person; size?: number }) {
  const style: CSSProperties & Record<"--kc" | "--ks", string> = { "--kc": kid.color, "--ks": `${size}px` };
  return (
    <div className="kt-badge" style={style} aria-hidden="true">
      {kid.portrait && <img src={kid.portrait} alt="" />}
    </div>
  );
}
