export default function Splash({ label }) {
  return (
    <div className="splash">
      <div className="splash-logo">
        <img src="/logo.png" alt="" width="40" height="40" />
      </div>
      {label && <div className="muted">{label}</div>}
    </div>
  );
}
