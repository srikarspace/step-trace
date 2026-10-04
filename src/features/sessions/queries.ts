import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useUi } from '@/store/ui'
import { fetchSessions, forgetSession, loadSession } from './api'

const POLL_MS = 1000

export function useSessions() {
  const live = useUi((s) => s.live)
  return useQuery({
    queryKey: ['sessions'],
    queryFn: ({ signal }) => fetchSessions(signal),
    refetchInterval: live ? POLL_MS : false,
  })
}

export function useSession(file: string | null) {
  const live = useUi((s) => s.live)
  return useQuery({
    queryKey: ['session', file],
    queryFn: ({ signal }) => loadSession(file!, signal),
    enabled: file !== null,
    refetchInterval: live ? POLL_MS : false,
    structuralSharing: false,
    retry: false,
  })
}

export function useReload() {
  const client = useQueryClient()
  return (file: string | null) => {
    if (file) forgetSession(file)
    void client.refetchQueries({ queryKey: ['sessions'] })
    if (file) void client.refetchQueries({ queryKey: ['session', file] })
  }
}

export function createQueryClient() {
  const client = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } })
  client.getQueryCache().subscribe((event) => {
    const [kind, path] = event.query.queryKey
    if (event.type === 'removed' && kind === 'session' && typeof path === 'string') forgetSession(path)
  })
  return client
}

export function useActiveFile() {
  const sessions = useSessions()
  const chosen = useUi((s) => s.file)
  const live = useUi((s) => s.live)
  const setFile = useUi((s) => s.setFile)
  const newest = sessions.data?.sessions[0]?.path ?? null
  const previous = useRef(newest)

  useEffect(() => {
    const before = previous.current
    previous.current = newest
    if (chosen === null && newest) useUi.setState({ file: newest })
    else if (live && before && newest && newest !== before && chosen === before) setFile(newest)
  }, [newest, chosen, live, setFile])

  return {
    file: chosen ?? newest,
    root: sessions.data?.root ?? '',
    sessions: sessions.data?.sessions ?? [],
    error: sessions.error,
  }
}
