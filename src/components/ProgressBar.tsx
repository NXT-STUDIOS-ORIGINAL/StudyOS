export function ProgressBar({ value, label }: { value: number | null; label: string }) {
  if (value === null) return <span className="text-xs text-slate-500 dark:text-slate-400">n/a</span>
  const pct = Math.round(value * 100)
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
      className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
      <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
    </div>
  )
}
