import { useEffect } from 'react'

export function useUrlSync(file: string | null, stepId: string | null) {
  useEffect(() => {
    const url = new URL(location.href)
    if (file) url.searchParams.set('file', file)
    if (stepId) url.searchParams.set('step', stepId)
    else url.searchParams.delete('step')
    history.replaceState(null, '', url)
  }, [file, stepId])
}
