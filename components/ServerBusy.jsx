export default function ServerBusy() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <div className="text-5xl" aria-hidden>
        🔌
      </div>
      <h2 className="mt-4 text-xl font-bold">Server Connection Busy</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        The metadata source could not be reached right now (it may be busy, rate-limiting, or
        updating its domain). Please reload in a few minutes — nothing is wrong with your device.
      </p>
      <a
        href=""
        className="mt-6 inline-block px-5 py-2.5 text-sm font-semibold text-white"
        style={{ background: 'var(--ac)', borderRadius: 12 }}
      >
        Reload
      </a>
    </div>
  );
}
