export default function Loading() {
  return (
    <div className="pt-5" aria-busy="true">
      <div className="aspect-video w-full animate-pulse rounded-xl bg-white/10" />
      <div className="mt-4 h-6 w-1/2 animate-pulse rounded bg-white/10" />
    </div>
  );
}
