export function ComingSoon({ title, phase }: { title: string; phase: number }) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">
        Not built yet. Planned for Phase {phase}.
      </p>
    </div>
  )
}
