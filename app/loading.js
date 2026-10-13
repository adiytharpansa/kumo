export default function Loading() {
  return (
    <div aria-busy="true">
      <div className="hero sk" style={{ minHeight: 'min(86svh,760px)' }} />
      <div className="sc" style={{ marginTop: 28 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="c" key={i}>
            <div className="poster sk" />
          </div>
        ))}
      </div>
    </div>
  );
}
