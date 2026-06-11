export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white dark:bg-slate-950">
      {/* Spinning logo */}
      <div className="relative flex items-center justify-center">
        {/* Outer glow ring */}
        <div className="absolute h-20 w-20 rounded-full bg-green-500/10 animate-ping" />
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/logo.svg"
          alt="Schwalmtalzupfer"
          className="relative h-14 w-14 animate-spin-slow"
        />
      </div>

      {/* Progress bar */}
      <div className="h-0.5 w-32 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-800">
        <div className="h-full w-full origin-left animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-green-500 to-transparent" />
      </div>
    </div>
  )
}
