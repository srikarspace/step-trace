import { Button } from '@/components/ui/button'
import { toneVar } from '@/lib/tone'
import { useUi } from '@/store/ui'
import { chipButtons, type ChipOptions } from './filter'

export function ChipBar({ options }: { options: ChipOptions }) {
  const chips = useUi((s) => s.chips)
  const pinned = useUi((s) => s.pinned)
  const toggleChip = useUi((s) => s.toggleChip)
  const buttons = chipButtons(options, new Set(pinned))

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 py-[3px]">
      <Button variant="chip" size="none" aria-pressed={chips.size === 0} onClick={() => toggleChip(null, false)}>
        All
      </Button>
      {buttons.map((c) => (
        <Button
          key={c.id}
          variant="chip"
          size="none"
          aria-pressed={chips.has(c.id)}
          style={{ borderLeftColor: toneVar[c.effect] }}
          title={`${c.title ?? c.label}. Cmd/Ctrl-click to select several`}
          onClick={(e) => toggleChip(c.id, e.metaKey || e.ctrlKey)}
        >
          {c.label}
        </Button>
      ))}
    </div>
  )
}
