import ResumeScan from "./ResumeScan.jsx";

// A stack of resume pages in real 3D depth. It leans toward the pointer (see usePointerDepth).
export default function DeckScene() {
  return (
    <div className="deck" aria-hidden="true">
      <div className="deck-sway">
        <div className="deck-3d">
          <div className="deck-card c3" />
          <div className="deck-card c2" />
          <div className="deck-front">
            <ResumeScan />
          </div>
        </div>
      </div>
      <span className="deck-floor" />
    </div>
  );
}
