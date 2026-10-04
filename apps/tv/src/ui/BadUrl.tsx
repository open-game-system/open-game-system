import { Stage } from "./Stage";

export function BadUrl() {
  return (
    <Stage>
      <div className="screen calm">
        <div className="calm-card">
          <p className="eyebrow">OGS</p>
          <h1>This TV page needs its link from the OGS app</h1>
          <p>Open the TV tab on your phone and tap Cast.</p>
        </div>
      </div>
    </Stage>
  );
}
