export default function Loading() {
  return (
    <div aria-busy="true">
      <div className="ph sk" />
      <div className="bd">
        <div className="stt">
          <div className="sk" style={{ height: 66, borderRadius: 16 }} />
          <div className="sk" style={{ height: 66, borderRadius: 16 }} />
          <div className="sk" style={{ height: 66, borderRadius: 16 }} />
        </div>
        <div className="sk" style={{ height: 90, borderRadius: 16, marginTop: 16 }} />
      </div>
    </div>
  );
}
