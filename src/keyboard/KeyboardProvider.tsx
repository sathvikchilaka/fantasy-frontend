import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getDisabledShortcuts, setDisabledShortcuts } from './shortcuts'

// ── Types ──

type PageHandler = (e: KeyboardEvent) => boolean

export type KeyboardContextValue = {
  commandMenuOpen: boolean
  setCommandMenuOpen: (v: boolean) => void
  helpModalOpen: boolean
  setHelpModalOpen: (v: boolean) => void
  /** Open the help modal directly in customize mode. */
  helpCustomizing: boolean
  setHelpCustomizing: (v: boolean) => void
  registerPage: (id: string, handler: PageHandler) => void
  unregisterPage: (id: string) => void
  /** Set of disabled shortcut IDs (from localStorage). */
  disabledShortcuts: Set<string>
  /** Toggle a shortcut on/off. Persists to localStorage. */
  toggleShortcut: (id: string, enabled: boolean) => void
  /** Check if a shortcut ID is disabled. */
  isDisabled: (id: string) => boolean
}

export const KeyboardContext = createContext<KeyboardContextValue | null>(null)

// ── Guards ──

function isInputFocused(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

function isMobile(): boolean {
  return window.matchMedia('(max-width: 1023px)').matches
}

// ── Sequence timeout ──

const SEQUENCE_TIMEOUT = 500

// ── Provider ──

export function KeyboardProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()

  const [commandMenuOpen, setCommandMenuOpen] = useState(false)
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const [helpCustomizing, setHelpCustomizing] = useState(false)

  // Disabled shortcuts (persisted in localStorage)
  const [disabledShortcuts, setDisabledState] = useState(() => getDisabledShortcuts())
  const disabledRef = useRef(disabledShortcuts)
  useEffect(() => { disabledRef.current = disabledShortcuts }, [disabledShortcuts])

  const toggleShortcut = useCallback((id: string, enabled: boolean) => {
    setDisabledState((prev) => {
      const next = new Set(prev)
      if (enabled) next.delete(id)
      else next.add(id)
      setDisabledShortcuts(next)
      return next
    })
  }, [])

  const isDisabled = useCallback((id: string) => disabledRef.current.has(id), [])

  // Page handler registry (ref to avoid re-renders on registration)
  const pageHandlers = useRef(new Map<string, PageHandler>())

  const registerPage = useCallback((id: string, handler: PageHandler) => {
    pageHandlers.current.set(id, handler)
  }, [])

  const unregisterPage = useCallback((id: string) => {
    pageHandlers.current.delete(id)
  }, [])

  // Sequence tracking
  const pendingKey = useRef<string | null>(null)
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear pending sequence on route change
  useEffect(() => {
    pendingKey.current = null
    if (pendingTimer.current) clearTimeout(pendingTimer.current)
  }, [location.pathname])

  // Refs so keydown handler doesn't need state deps
  const cmdOpenRef = useRef(commandMenuOpen)
  const helpOpenRef = useRef(helpModalOpen)
  useEffect(() => { cmdOpenRef.current = commandMenuOpen }, [commandMenuOpen])
  useEffect(() => { helpOpenRef.current = helpModalOpen }, [helpModalOpen])

  useEffect(() => {
    function off(id: string) { return disabledRef.current.has(id) }

    function handleKeyDown(e: KeyboardEvent) {
      // Mobile guard
      if (isMobile()) return

      const meta = e.metaKey || e.ctrlKey
      const inputFocused = isInputFocused()
      const anyModalOpen = cmdOpenRef.current || helpOpenRef.current

      // ── Always-active shortcuts (work even in inputs) ──

      // Escape — close modals
      if (e.key === 'Escape' && !off('esc')) {
        if (cmdOpenRef.current) { setCommandMenuOpen(false); return }
        if (helpOpenRef.current) { setHelpModalOpen(false); return }
      }

      // Don't fire shortcuts while typing in inputs (except above)
      if (inputFocused) return

      // Don't fire page shortcuts while a modal is open
      if (anyModalOpen) return

      // ── Global shortcuts ──

      // ? — open help modal
      if ((e.key === '?' || (e.shiftKey && e.key === '/')) && !off('help')) {
        e.preventDefault()
        setHelpModalOpen(true)
        return
      }


      // Backspace — go back
      if (e.key === 'Backspace' && !meta && !e.shiftKey && !e.repeat && !off('go-back')) {
        if (document.querySelector('[data-state="open"][role="dialog"]')) return
        e.preventDefault()
        navigate(-1)
        return
      }

      // ── Sequence shortcuts (g + h/m/p) ──

      if (e.key === 'g' && !meta && !e.shiftKey) {
        pendingKey.current = 'g'
        if (pendingTimer.current) clearTimeout(pendingTimer.current)
        pendingTimer.current = setTimeout(() => { pendingKey.current = null }, SEQUENCE_TIMEOUT)
        return
      }

      if (pendingKey.current === 'g') {
        pendingKey.current = null
        if (pendingTimer.current) clearTimeout(pendingTimer.current)
        const navMap: Record<string, { route: string; id: string }> = {
          h: { route: '/', id: 'nav-home' },
          m: { route: '/matches', id: 'nav-matches' },
          p: { route: '/profile', id: 'nav-profile' },
        }
        const nav = navMap[e.key]
        if (nav && !off(nav.id)) {
          e.preventDefault()
          navigate(nav.route)
          return
        }
      }

      // ── Page handlers ──

      for (const handler of pageHandlers.current.values()) {
        if (handler(e)) return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  return (
    <KeyboardContext.Provider
      value={{
        commandMenuOpen,
        setCommandMenuOpen,
        helpModalOpen,
        setHelpModalOpen,
        helpCustomizing,
        setHelpCustomizing,
        registerPage,
        unregisterPage,
        disabledShortcuts,
        toggleShortcut,
        isDisabled,
      }}
    >
      {children}
    </KeyboardContext.Provider>
  )
}
