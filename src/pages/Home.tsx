import { Link } from 'react-router-dom'
import { OAUTH_GOOGLE_URL } from '../api/client'
import { useAuthToken } from '../auth/useAuthToken'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Swords,
  Users,
  BarChart3,
  Target,
  Zap,
  Shield,
  ArrowRight,
} from 'lucide-react'

export function Home() {
  const token = useAuthToken()

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,197,94,0.08),transparent)]" />
        <div className="container relative py-20 md:py-32 flex flex-col items-center text-center gap-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <Swords className="h-3.5 w-3.5 text-primary" />
            Cricket Fantasy
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl leading-[1.1]">
            Pick your XI.{' '}
            <span className="text-primary">Captain.</span>{' '}
            Vice-captain.{' '}
            <span className="text-primary">Points.</span>
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl leading-relaxed">
            Choose real fixtures, build an 11-player squad under fantasy rules,
            set your captain and vice-captain, then follow scorecards and
            leaderboards match by match.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
            {!token && (
              <Button asChild size="lg" className="gap-2">
                <a href={OAUTH_GOOGLE_URL}>
                  Sign in with Google
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            )}
            {token !== null && (
              <>
                <Button asChild size="lg" className="gap-2">
                  <Link to="/matches">
                    View matches
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/leaderboard">Season Board</Link>
                </Button>
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {token
              ? "You're signed in — inkem? Kaanivuu kaanivuu.."
              : 'Sign in to save your team and compete on the leaderboard.'}
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="container py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            How it works
          </h2>
          <p className="text-muted-foreground mt-2">
            Three simple steps to start competing
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              step: '1',
              icon: Target,
              title: 'Choose a match',
              desc: 'Filter upcoming, live, or completed fixtures and open any card for the scorecard and match leaderboard.',
            },
            {
              step: '2',
              icon: Users,
              title: 'Create your dream team',
              desc: 'Stay within credits, balance WK / BAT / AR / BOWL, and max players per real team — then pick captain & VC.',
            },
            {
              step: '3',
              icon: BarChart3,
              title: 'Track the game',
              desc: 'Follow the match hub for live scores and fantasy standings as the game unfolds.',
            },
          ].map((item) => (
            <Card key={item.step} className="relative overflow-hidden group hover:border-primary/30 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-5xl font-bold text-muted-foreground/20 absolute top-4 right-6">
                    {item.step}
                  </span>
                </div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-t">
        <div className="container py-16 md:py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Why FantasyF
            </h2>
            <p className="text-muted-foreground mt-2">
              Built for cricket fans who love fantasies 🌚
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Swords,
                title: 'Cricket only',
                desc: 'Inkem kavaali enti? 😏',
              },
              {
                icon: Zap,
                title: 'Reliable and robust',
                desc: 'Match chudakunda wick gaadu bugs fix chesthaad!!',
              },
              {
                icon: Shield,
                title: 'Fair squad rules',
                desc: 'Wick gadiki nachinattu, ranking marchi dengthaad..',
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-4 p-4 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
