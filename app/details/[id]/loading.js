export default function Loading() {
  return (
    <div className="pt-5" aria-busy="true">
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="aspect-[3/4] w-40 animate-pulse rounded-xl bg-white/10 sm:w-52" />
        <div className="flex-1 space-y-3">
          <div className="h-8 w-2/3 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-full animate-pulse rounded bg-white/10" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-white/10" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-white/10" />
        ))}
      </div>
    </div>
  );
}
