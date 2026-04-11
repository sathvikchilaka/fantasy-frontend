import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { KeyboardProvider } from './keyboard/KeyboardProvider'
import { TourProvider } from './tours/TourProvider'
import { registerAllTours } from './tours/definitions'
import './index.css'
import App from './App.tsx'

// Register all tour definitions at startup
registerAllTours()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,   // 2 min before refetch
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <KeyboardProvider>
          <TourProvider>
            <App />
          </TourProvider>
        </KeyboardProvider>
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
)
