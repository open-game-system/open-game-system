// Ava's iPad went to sleep at 9%: her character is asleep too, and the plug says what it needs.
import type { CSSProperties } from "react";
import type { Person } from "../../../world";
import { Battery, Moon, Plug } from "../ui/Icons";

export function Asleep({ kid }: { kid: Person }) {
  const style: CSSProperties & Record<"--kc", string> = { "--kc": kid.color };
  return (
    <div className="kt kt-asleep" style={style}>
      <Moon className="kt-moon" size={150} />
      <span className="kt-star kt-star--1" />
      <span className="kt-star kt-star--2" />
      <span className="kt-star kt-star--3" />
      <img className="kt-sleeper" src="/art/story-nook/char-dinosaur-sleep.webp" alt="" />
      <div className="kt-charge" aria-hidden="true">
        <Plug size={88} />
        <Battery level={0.09} size={150} />
      </div>
    </div>
  );
}
