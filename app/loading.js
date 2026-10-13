export default function Loading() {
  return (
    <div className="pt-5" aria-busy="true">
      <div className="mb-3 h-6 w-48 animate-pulse rounded bg-white/10" />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
            <div className="aspect-[3/4] w-full animate-pulse bg-white/10" />
            <div className="space-y-2 p-2.5">
              <div className="h-3 w-5/6 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-3/6 animate-pulse rounded bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
