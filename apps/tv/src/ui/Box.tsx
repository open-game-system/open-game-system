import type { BoxModel } from "../launcher/layout";

/** A game as a box: key art on the cover, a spine, and the resume point on its label. */
export function Box({ box, focused }: { box: BoxModel; focused: boolean }) {
  return (
    <div
      className={`box${focused ? " focused" : ""}`}
      data-item={box.itemId}
      data-focused={focused || undefined}
    >
      <div className="box-cover" data-cover={box.appId}>
        <img src={box.cover} alt="" loading="eager" />
        <span className="box-spine" />
        {box.tag && <span className="box-tag">{box.tag}</span>}
      </div>
      <div className="box-label">
        <span className="box-name">{box.name}</span>
        {box.resume && <span className="box-resume">{box.resume}</span>}
      </div>
    </div>
  );
}
