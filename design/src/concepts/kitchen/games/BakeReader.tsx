// Bake Shop's own grown-up page (stand-in): the order reader reads the order out loud.
import { gameById } from "../../../world";
import { Cupcake } from "./art";

export function BakeReader() {
  const g = gameById("bake-shop");
  return (
    <div className="g-bs">
      <div className="g-bs-head">
        <p className="g-bs-day">Day 4</p>
        <div className="g-bs-orders" aria-label="3 of 5 orders baked">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={i < 3 ? "on" : i === 3 ? "now" : ""} />
          ))}
        </div>
      </div>
      <div className="g-bs-ticket">
        <img src={g.art.extra?.bear} alt="" />
        <div>
          <span className="g-bs-who">Mrs. Bear would like</span>
          <p className="g-bs-order">a strawberry cupcake with sprinkles</p>
        </div>
      </div>
      <p className="g-bs-hint">Read it out loud. The bakers see the picture on their iPads.</p>
      <div className="g-bs-target">
        <Cupcake size={150} frosting="#f78fb0" sprinkles />
      </div>
      <button className="g-bs-bell" data-bot="bs-bell">
        <span>Ring the bell when it's ready</span>
      </button>
    </div>
  );
}
