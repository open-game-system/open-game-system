// Bake Shop's own controller views (stand-ins for the game's web content inside OGS).
import { Cupcake, Oven, Shaker, Strawberry, Swirl } from "./BakeArt";
import { Portrait } from "../ui/Brand";
import type { Person } from "../../../world";

export function BakeReader() {
  return (
    <div className="g-bake g-bake--phone">
      <div className="g-bake__day">
        <span>Day 4</span>
        <span className="g-bake__pips" aria-label="3 of 5 orders baked">
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} className={i < 3 ? "on" : i === 3 ? "now" : ""} />
          ))}
        </span>
      </div>
      <div className="g-bake__customer">
        <img src="/art/bake-shop/char-bear.webp" alt="" />
        <div className="g-bake__bubble">
          <span className="g-bake__readlabel">Read it out loud</span>
          <p>“One strawberry cupcake, please, with rainbow sprinkles on top!”</p>
        </div>
      </div>
      <ul className="g-bake__order">
        <li className="done"><Swirl size={34} /> Pink frosting</li>
        <li><Strawberry size={34} /> A strawberry</li>
        <li><Shaker size={34} /> Rainbow sprinkles</li>
      </ul>
      <button className="g-bake__bell"><span>Ring the bell when it's ready</span></button>
    </div>
  );
}

/** Baker (Juneau): no words. The order floats as a picture; four giant ingredients. */
export function BakeBaker({ who }: { who: Person }) {
  return (
    <div className="g-bake g-bake--kid">
      <div className="g-bake__dream">
        <Cupcake size={190} />
      </div>
      <div className="g-bake__plate">
        <Cupcake size={250} berry={false} sprinkles={false} />
      </div>
      <div className="g-bake__bins">
        <button className="g-bake__bin is-hot" aria-label="strawberry"><Strawberry size={180} /></button>
        <button className="g-bake__bin" aria-label="sprinkles"><Shaker size={180} /></button>
        <button className="g-bake__bin" aria-label="frosting"><Swirl size={180} /></button>
        <button className="g-bake__bin g-bake__bin--oven" aria-label="oven"><Oven size={180} /></button>
      </div>
      <div className="g-kid-seat">
        <Portrait person={who} size={86} />
      </div>
    </div>
  );
}

/** Littlest helper (Ava, almost 3): one thing to mash. Every tap showers sprinkles; nothing can go wrong. */
export function BakeHelper({ who }: { who: Person }) {
  return (
    <div className="g-bake g-bake--kid g-bake--little">
      <div className="g-bake__confetti" aria-hidden>
        {Array.from({ length: 26 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 60}%`, background: ["#8fddbe", "#ffd23f", "#6fb7f0", "#f46a8e"][i % 4], transform: `rotate(${i * 29}deg)` }} />
        ))}
      </div>
      <button className="g-bake__mash" aria-label="shake">
        <Shaker size={580} />
      </button>
      <div className="g-kid-seat">
        <Portrait person={who} size={86} />
      </div>
    </div>
  );
}
