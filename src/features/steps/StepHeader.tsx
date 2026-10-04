import type { RefObject } from 'react'
import { cn } from '@/lib/utils'
import { useUi } from '@/store/ui'
import {
  columnWidth,
  gridTemplate,
  isResizable,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  ROW_HEIGHT,
  visibleColumns,
  type Column,
} from './columns'

type Props = { compact: boolean; rows: number; gridRef: RefObject<HTMLDivElement | null> }

export function StepHeader({ compact, rows, gridRef }: Props) {
  const widths = useUi((s) => s.columns)
  const setColumnWidth = useUi((s) => s.setColumnWidth)

  function startResize(e: React.PointerEvent<HTMLElement>, column: Column) {
    const grid = gridRef.current
    const startWidth = columnWidth(column, widths)
    if (!grid || startWidth === null) return
    const handle = e.currentTarget
    const startX = e.clientX
    let width = startWidth
    handle.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      width = Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, startWidth + ev.clientX - startX))
      grid.style.setProperty('--steps-grid', gridTemplate(compact, { ...widths, [column.id]: width }, rows))
    }
    const done = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('lostpointercapture', done)
      setColumnWidth(column.id, width)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('lostpointercapture', done)
  }

  return (
    <div
      role="row"
      className="sticky top-0 z-10 grid grid-cols-(--steps-grid) border-b bg-toolbar"
      style={{ height: ROW_HEIGHT }}
    >
      {visibleColumns(compact).map((column) => (
        <div
          key={column.id}
          role="columnheader"
          className={cn(
            'relative min-w-0 border-r border-border-soft px-1.5 leading-[21px]',
            column.align === 'right' && 'text-right',
          )}
        >
          <span className="block truncate">{column.label}</span>
          {isResizable(column) ? (
            <span
              aria-hidden
              onPointerDown={(e) => startResize(e, column)}
              className="absolute inset-y-0 right-0 z-10 w-2 translate-x-1/2 cursor-col-resize"
            />
          ) : null}
        </div>
      ))}
    </div>
  )
}
