import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUi } from '@/store/ui'

const MORE = [
  { label: 'Errors only', token: 'status:error' },
  { label: 'Pending only', token: 'status:pending' },
  { label: 'Hide system', token: '-kind:system' },
]

export function MoreFilters() {
  const text = useUi((s) => s.text)
  const setText = useUi((s) => s.setText)
  const words = text.split(/\s+/).filter(Boolean)

  function toggle(token: string) {
    setText(words.includes(token) ? words.filter((w) => w !== token).join(' ') : [...words, token].join(' '))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          More filters <ChevronDown className="size-3" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {MORE.map((m) => (
          <DropdownMenuCheckboxItem
            key={m.token}
            checked={words.includes(m.token)}
            onCheckedChange={() => toggle(m.token)}
            onSelect={(e) => e.preventDefault()}
          >
            {m.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
