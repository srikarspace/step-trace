import { Copy } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/lib/format'

const PREVIEW_CHARS = 100_000

export function CodeBlock({ text, banner }: { text: string; banner?: string }) {
  const [expanded, setExpanded] = useState(false)
  const clipped = !expanded && text.length > PREVIEW_CHARS
  return (
    <>
      {banner ? <div className="mb-2 rounded bg-destructive-muted px-2 py-1.5 text-destructive">{banner}</div> : null}
      <div className="mb-1.5 flex justify-end">
        <Button onClick={() => void navigator.clipboard.writeText(text)}>
          <Copy className="size-3" aria-hidden /> Copy
        </Button>
      </div>
      <pre className="m-0 rounded border border-border-soft bg-code p-2 font-mono text-sm/[1.45] wrap-anywhere whitespace-pre-wrap">
        {clipped ? text.slice(0, PREVIEW_CHARS) : text}
      </pre>
      {clipped ? (
        <Button className="mt-2" onClick={() => setExpanded(true)}>
          Show all ({formatBytes(text.length)})
        </Button>
      ) : null}
    </>
  )
}
