import { cn } from '@/lib/utils'
import type { Step } from '@/parser/types'
import { StepIcon } from './StepIcon'

export function StepTitle({ step }: { step: Step }) {
  const error = step.status === 'error'
  return (
    <>
      <StepIcon step={step} />
      <span className={cn('flex-none font-semibold', error && 'text-error')}>{step.label}</span>
      {step.name ? (
        <span className={cn('min-w-0 truncate', step.resultPreview && 'max-w-[70%] flex-none', error && 'text-error')}>
          {step.name}
        </span>
      ) : null}
      {step.resultPreview ? (
        <span className="min-w-0 truncate text-muted-foreground before:mr-1.5 before:inline-block before:h-2.5 before:w-px before:bg-border before:align-[-1px] before:content-['']">
          Returned {step.resultPreview}
        </span>
      ) : null}
    </>
  )
}
