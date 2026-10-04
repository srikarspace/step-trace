export type Column = {
  id: string
  label: string
  width: number | null
  align?: 'right'
  compact?: boolean
}

export const COLUMNS: Column[] = [
  { id: 'index', label: '#', width: 40, align: 'right', compact: true },
  { id: 'name', label: 'Name', width: null, compact: true },
  { id: 'status', label: 'Status', width: 72 },
  { id: 'type', label: 'Type', width: 84 },
  { id: 'initiator', label: 'Initiator', width: 140 },
  { id: 'size', label: 'Size', width: 76, align: 'right' },
  { id: 'time', label: 'Time', width: 76, align: 'right' },
  { id: 'waterfall', label: 'Waterfall', width: null },
]

export const ROW_HEIGHT = 22
export const MIN_COLUMN_WIDTH = 32
export const MAX_COLUMN_WIDTH = 600

export function visibleColumns(compact: boolean): Column[] {
  return compact ? COLUMNS.filter((c) => c.compact) : COLUMNS
}

export function columnWidth(column: Column, widths: Record<string, number>): number | null {
  return column.width === null ? null : (widths[column.id] ?? column.width)
}

export function isResizable(column: Column): boolean {
  return column.width !== null && column.id !== 'index'
}

const DIGIT_WIDTH = 7
const CELL_PADDING = 13

export function indexWidth(rows: number): number {
  return Math.max(40, String(Math.max(0, rows - 1)).length * DIGIT_WIDTH + CELL_PADDING)
}

export function gridTemplate(compact: boolean, widths: Record<string, number>, rows: number): string {
  return visibleColumns(compact)
    .map((column) => {
      if (column.id === 'index') return `${indexWidth(rows)}px`
      if (column.id === 'name') return 'minmax(0, 1fr)'
      if (column.id === 'waterfall') return '18%'
      return `${columnWidth(column, widths)}px`
    })
    .join(' ')
}
