import { useEffect, useSyncExternalStore } from 'react'
import { useUi, type Theme } from '@/store/ui'

const darkQuery = matchMedia('(prefers-color-scheme: dark)')

function subscribe(onChange: () => void) {
  darkQuery.addEventListener('change', onChange)
  return () => darkQuery.removeEventListener('change', onChange)
}

export function useTheme(): Theme {
  const chosen = useUi((s) => s.theme)
  const systemDark = useSyncExternalStore(subscribe, () => darkQuery.matches)
  const theme = chosen ?? (systemDark ? 'dark' : 'light')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  return theme
}
