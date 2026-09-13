'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/animate/reveal'
import { Stagger, StaggerItem } from '@/components/animate/stagger'

export function CTASection() {
  return (
    <section id="cta" className="relative w-full py-20 md:py-32 bg-transparent overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-primary/20 blur-[120px] -z-10" />
        <div className="absolute -bottom-40 left-0 h-96 w-96 rounded-full bg-chart-2/15 blur-[120px] -z-10" />

        <div className="relative rounded-3xl border border-primary/20 bg-gradient-to-br from-card/80 to-primary/5 backdrop-blur-xl p-8 md:p-16 space-y-8 text-center overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.06] -z-10"
            style={{
              backgroundImage:
                'linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          <Reveal>
            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground text-balance">
                Stop tracking your plan and your budget separately
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Set up your first project or event plan in minutes — roles,
                budgets, and tasks all connected from day one.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <Stagger>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <StaggerItem>
                  <Button asChild size="lg" className="gap-2 w-full sm:w-auto">
                    <Link href="/signup">
                      Get Started Now
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </StaggerItem>
                <StaggerItem>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto cursor-pointer bg-transparent hover:bg-primary/10 hover:text-primary hover:border-primary/40"
                  >
                    <Link href="/login">Already a Member? Sign In</Link>
                  </Button>
                </StaggerItem>
              </div>
            </Stagger>
          </Reveal>

          <Reveal delay={0.25}>
            <p className="text-sm text-muted-foreground">
              Need it for a larger team?{' '}
              <Link href="/contact" className="text-primary hover:underline">
                Contact sales
              </Link>
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}