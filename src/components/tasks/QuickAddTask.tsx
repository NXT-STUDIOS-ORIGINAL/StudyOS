import { useState } from 'react'
import { useSubmit } from '../../hooks/useSubmit'
import { fieldCls, primaryBtn } from '../ui'

export type DueChoice = 'none' | 'today' | 'tomorrow'

export function QuickAddTask({ onAdd }: { onAdd: (title: string, due: DueChoice) => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState<DueChoice>('today')
  const { busy, error, run } = useSubmit()

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (title.trim() === '') return
        void run(async () => {
          await onAdd(title.trim(), due)
          setTitle('')
        })
      }}
    >
      <label className="min-w-48 flex-1 text-sm font-medium">
        New task
        <input
          className={fieldCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Solve 10 trigonometry questions"
        />
      </label>
      <label className="text-sm font-medium">
        Due
        <select className={fieldCls} value={due} onChange={(e) => setDue(e.target.value as DueChoice)}>
          <option value="today">Today</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="none">No date</option>
        </select>
      </label>
      <button type="submit" className={primaryBtn} disabled={busy}>
        Add
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </form>
  )
}
