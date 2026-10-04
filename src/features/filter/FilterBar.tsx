import { ToolbarSeparator } from '@/components/ToolbarSeparator'
import type { Step } from '@/parser/types'
import { ChipBar } from './ChipBar'
import { chipOptions } from './filter'
import { FilterInput } from './FilterInput'
import { MoreFilters } from './MoreFilters'
import { PinMenu } from './PinMenu'
import { useWarmFilter } from './useWarmFilter'

export function FilterBar({ steps }: { steps: Step[] }) {
  const options = chipOptions(steps)
  useWarmFilter(steps)
  return (
    <div className="flex min-h-7 flex-wrap items-center gap-1.5 border-b border-border-soft bg-toolbar px-1.5">
      <FilterInput />
      <MoreFilters />
      <ToolbarSeparator />
      <ChipBar options={options} />
      <PinMenu options={options} />
    </div>
  )
}
