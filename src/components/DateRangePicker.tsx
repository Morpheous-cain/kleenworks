'use client'

import { useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type DateRange = { from: string; to: string }

type Preset = { label: string; from: () => string; to: () => string }

const today = () => new Date().toISOString().split('T')[0]
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().split('T')[0]
const startOfMonth = () => {
  const d = new Date(); d.setDate(1)
  return d.toISOString().split('T')[0]
}
const startOfWeek = () => {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().split('T')[0]
}

const PRESETS: Preset[] = [
  { label: 'Today',        from: today,         to: today         },
  { label: 'This Week',    from: startOfWeek,   to: today         },
  { label: 'This Month',   from: startOfMonth,  to: today         },
  { label: 'Last 7 Days',  from: () => daysAgo(7),  to: today     },
  { label: 'Last 30 Days', from: () => daysAgo(30), to: today     },
  { label: 'Last 90 Days', from: () => daysAgo(90), to: today     },
]

interface Props {
  value: DateRange
  onChange: (range: DateRange) => void
  className?: string
}

export function DateRangePicker({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false)

  function applyPreset(preset: Preset) {
    onChange({ from: preset.from(), to: preset.to() })
    setOpen(false)
  }

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 h-10 px-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-[#00A8CC] transition-colors"
      >
        <Calendar className="size-4 text-slate-400" />
        <span>{value.from} → {value.to}</span>
        <ChevronDown className={cn('size-3.5 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-50 bg-white dark:bg-[#0F1F3D] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4 w-80 space-y-3">

            {/* Presets */}
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Quick Select</p>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  className="px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#00A8CC] hover:text-white transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom range */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Custom Range</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">From</label>
                  <input
                    type="date"
                    value={value.from}
                    max={value.to}
                    onChange={e => onChange({ ...value, from: e.target.value })}
                    className="w-full h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#00A8CC] [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">To</label>
                  <input
                    type="date"
                    value={value.to}
                    min={value.from}
                    onChange={e => onChange({ ...value, to: e.target.value })}
                    className="w-full h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#00A8CC] [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="w-full h-9 rounded-xl bg-[#00A8CC] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#0090B0] transition-colors"
            >
              Apply Range
            </button>
          </div>
        </>
      )}
    </div>
  )
}
