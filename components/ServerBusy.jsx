export default function ServerBusy() {
  return (
    <div style={{ padding: '80px 18px', textAlign: 'center' }}>
      <div style={{ fontSize: 44 }} aria-hidden>
        🔌
      </div>
      <h2 style={{ marginTop: 14, fontSize: 21, fontWeight: 800 }}>Server Connection Busy</h2>
      <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: 'var(--mu)' }}>
        The metadata source could not be reached right now (it may be busy, rate-limiting, or
        updating its domain). Please reload in a few minutes — nothing is wrong with your device.
      </p>
      <a href="" className="btn go" style={{ marginTop: 22 }}>
        Reload
      </a>
    </div>
  );
}
