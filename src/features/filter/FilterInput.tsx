import { Filter } from 'lucide-react'
import { useUi } from '@/store/ui'
import { parseFilter } from './filter'

export function FilterInput() {
  const text = useUi((s) => s.text)
  const setText = useUi((s) => s.setText)
  const invalid = parseFilter(text).filter((t) => !t.valid)
  return (
    <>
      <label
        title="Text, or tool:Bash status:error kind:llm model:x. Prefix - to negate."
        className="flex h-5 w-[260px] max-w-full items-center gap-1 rounded-full border bg-background px-2 focus-within:border-ring"
      >
        <Filter className="size-3 text-muted-foreground" aria-hidden />
        <input
          id="filter"
          placeholder="Filter"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </label>
      {invalid.length > 0 ? (
        <span title="Ignored: unknown key or empty value" className="whitespace-nowrap text-error line-through">
          {invalid.map((t) => `${t.negate ? '-' : ''}${t.key}:${t.value}`).join(' ')}
        </span>
      ) : null}
    </>
  )
}
