import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { OAUTH_GOOGLE_URL, setToken } from '../api/client'
import { TokenCapture } from '../components/TokenCapture'
import { useState } from 'react'
import { useAuthToken } from '../auth/useAuthToken'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Trophy,
  Swords,
  LogOut,
  Menu,
  Home,
} from 'lucide-react'

export function RootLayout() {
  const [token, settoken1] = useState<string | null>(useAuthToken())
  const navigate = useNavigate()

  const navItems = [
    { to: '/', label: 'Home', icon: Home, end: true, always: true },
    { to: '/matches', label: 'Matches', icon: Swords, end: false, always: false },
    { to: '/leaderboard', label: 'Season Board', icon: Trophy, end: false, always: false },
  ]

  const signOut = () => {
    setToken(null)
    settoken1(null)
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TokenCapture setroot={settoken1} />

      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
        <div className="container flex h-14 items-center justify-between">

          {/* Brand */}
          <NavLink
            to="/"
            end
            className="flex items-center gap-2 font-bold text-lg tracking-tight text-foreground hover:no-underline"
          >
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Swords className="h-4 w-4 text-primary-foreground" />
            </div>
            <span>FantasyF</span>
          </NavLink>

          {/* Desktop nav — hidden on mobile */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main">
            {navItems
              .filter((item) => item.always || token !== null)
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:no-underline ${
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
          </nav>

          {/* Desktop auth — hidden on mobile */}
          <div className="hidden md:flex items-center gap-2">
            {token ? (
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            ) : (
              <Button asChild size="sm">
                <a href={OAUTH_GOOGLE_URL}>Sign in with Google</a>
              </Button>
            )}
          </div>

          {/* Mobile dropdown — hidden on desktop */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-52">
                {navItems
                  .filter((item) => item.always || token !== null)
                  .map((item) => (
                    <DropdownMenuItem
                      key={item.to}
                      onClick={() => navigate(item.to)}
                    >
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                      <span>{item.label}</span>
                    </DropdownMenuItem>
                  ))}

                <DropdownMenuSeparator />

                {token ? (
                  <DropdownMenuItem
                    onClick={signOut}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild>
                    <a href={OAUTH_GOOGLE_URL} className="flex items-center gap-2.5 w-full">
                      <Swords className="h-4 w-4 text-muted-foreground" />
                      Sign in with Google
                    </a>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer — only shown when logged out */}
      {!token && (
        <footer className="border-t py-6">
          <div className="container flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>FantasyF — Cricket fantasy dream teams</p>
            <p className="text-muted-foreground/60">Built with passion for cricket</p>
          </div>
        </footer>
      )}
    </div>
  )
}
