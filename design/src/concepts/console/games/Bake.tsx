// Bake Shop's own controller views (stand-ins for the game's web content inside OGS).
import { Shaker, Strawberry, Swirl } from "./BakeArt";

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
