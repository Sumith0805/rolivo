// A small 3D cube that turns while something loads. `full` centres it on the screen, `small` sits inline.
export default function Loader3D({ label = "Loading", full = false, small = false }) {
  return (
    <div className={`loader3d${full ? " full" : ""}${small ? " small" : ""}`} role="status" aria-live="polite">
      <div className="l3-stage" aria-hidden="true">
        <div className="l3-cube">
          <i className="f f-front" />
          <i className="f f-back" />
          <i className="f f-right" />
          <i className="f f-left" />
          <i className="f f-top" />
          <i className="f f-bottom" />
        </div>
        <span className="l3-shadow" />
      </div>
      <p>{label}</p>
    </div>
  );
}
