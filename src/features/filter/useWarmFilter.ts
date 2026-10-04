import { useEffect } from 'react'
import type { Step } from '@/parser/types'
import { haystack } from './filter'

export function useWarmFilter(steps: Step[]) {
  useEffect(() => {
    let next = 0
    let handle = 0
    const work = (deadline: IdleDeadline) => {
      while (next < steps.length && deadline.timeRemaining() > 1) haystack(steps[next++]!)
      if (next < steps.length) handle = requestIdleCallback(work)
    }
    handle = requestIdleCallback(work)
    return () => cancelIdleCallback(handle)
  }, [steps])
}
