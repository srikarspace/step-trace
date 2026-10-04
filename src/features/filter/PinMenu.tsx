import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toneVar } from '@/lib/tone'
import { useUi } from '@/store/ui'
import type { Chip, ChipOptions } from './filter'

function PinSection({ heading, chips, first }: { heading: string; chips: Chip[]; first?: boolean }) {
  const pinned = useUi((s) => s.pinned)
  const togglePin = useUi((s) => s.togglePin)
  if (chips.length === 0) return null
  return (
    <>
      {first ? null : <DropdownMenuSeparator />}
      <DropdownMenuLabel>{heading}</DropdownMenuLabel>
      {chips.map((c) => (
        <DropdownMenuCheckboxItem
          key={c.id}
          checked={pinned.includes(c.id)}
          onCheckedChange={() => togglePin(c.id)}
          onSelect={(e) => e.preventDefault()}
        >
          <span className="h-3 w-[3px] flex-none rounded-[1px]" style={{ background: toneVar[c.effect] }} />
          {c.label}
          {c.title && c.title !== c.label ? <span className="ml-auto pl-3 text-muted-foreground">{c.title}</span> : null}
        </DropdownMenuCheckboxItem>
      ))}
    </>
  )
}

export function PinMenu({ options }: { options: ChipOptions }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Choose filter buttons" className="ml-auto">
          <Settings />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[60vh]">
        <PinSection heading="Steps" chips={options.kinds} first />
        <PinSection heading="Tool groups" chips={options.groups} />
        <PinSection heading="Single tools" chips={options.tools} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
