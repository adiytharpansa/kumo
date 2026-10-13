export default function Loading() {
  return (
    <div aria-busy="true">
      <div className="sk" style={{ aspectRatio: '16/9', width: '100%' }} />
      <div className="bd">
        <div className="sk" style={{ height: 26, width: '55%', borderRadius: 9 }} />
        <div className="sk" style={{ height: 16, width: '35%', borderRadius: 9, marginTop: 10 }} />
      </div>
    </div>
  );
}
