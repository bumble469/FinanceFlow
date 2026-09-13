'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/animate/reveal'

export function HeroSection() {
  return (
    <section id="home" className="relative w-full pt-8 pb-16 md:pt-12 md:pb-20 lg:pt-14 lg:pb-24 overflow-hidden">
      <div className="relative z-10 mx-auto max-w-4xl px-6 lg:px-8 text-center space-y-7 md:space-y-8">
        
        {/* Top Badge */}
        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-primary font-medium">
              Projects, events & the money behind them
            </span>
          </div>
        </Reveal>

        {/* Original Headline */}
        <Reveal delay={0.1}>
          <h1 className="text-balance text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-foreground leading-[1.08] tracking-tight">
            Run the work.{' '}
            <span className="bg-gradient-to-r from-primary via-primary to-chart-2 bg-clip-text text-transparent">
              Track every rupee.
            </span>
          </h1>
        </Reveal>

        {/* Original Subtitle */}
        <Reveal delay={0.2}>
          <p className="text-balance mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground md:text-xl font-normal leading-relaxed">
            FinanceFlow is a multi-tenant project and event management platform
            with financial tracking built in — departments, phases, milestones
            and teams on one side; budgets, income and expenses on the other.
          </p>
        </Reveal>

        {/* Action Buttons styled like the reference layout */}
        <Reveal delay={0.3}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto h-12 px-7 rounded-lg bg-white text-black font-semibold hover:bg-zinc-200 transition-all active:scale-95 shadow-lg text-sm sm:text-base cursor-pointer gap-2"
            >
              <Link href="/signup">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full sm:w-auto h-12 px-7 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-white font-medium border border-zinc-700/60 hover:border-zinc-500 transition-all active:scale-95 text-sm sm:text-base cursor-pointer"
            >
              <Link href="#why">See Why</Link>
            </Button>
          </div>
        </Reveal>

        {/* Overview Card */}
        <Reveal delay={0.4}>
          <div className="relative mx-auto mt-14 max-w-4xl">
            <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
                <span className="ml-3 text-xs text-muted-foreground">Overview · Q4 Product Launch</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 text-left">
                <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-3">
                  <div className="text-xs text-muted-foreground">Budget Used</div>
                  <div className="text-2xl font-bold text-foreground">₹8.2L / ₹12L</div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full w-[68%] rounded-full bg-primary" />
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-3">
                  <div className="text-xs text-muted-foreground">Phases Active</div>
                  <div className="text-2xl font-bold text-foreground">4 / 6</div>
                  <div className="flex gap-1.5">
                    {[1, 1, 1, 1, 0, 0].map((v, i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full ${v ? 'bg-chart-2' : 'bg-muted'}`} />
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-3">
                  <div className="text-xs text-muted-foreground">Team Roles</div>
                  <div className="text-2xl font-bold text-foreground">12 members</div>
                  <div className="flex -space-x-2">
                    {['bg-primary', 'bg-chart-2', 'bg-chart-3', 'bg-chart-5'].map((c, i) => (
                      <div key={i} className={`h-6 w-6 rounded-full border-2 border-card ${c}`} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

      </div>
    </section>
  )
}