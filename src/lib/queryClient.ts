import { QueryClient } from '@tanstack/react-query'

const STALE_TIME = 5 * 60 * 1000 // 5 minutes
const GC_TIME = 10 * 60 * 1000   // 10 minutes

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME,
      gcTime: GC_TIME,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
})
